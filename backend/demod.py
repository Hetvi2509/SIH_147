# ============================================================
# Best-effort blind demodulator -- turns raw IQ into hard bits +
# LLR-style reliabilities so the real bit_stream_anaylsis / fec_interlevaer
# scripts have real data to run on, instead of the classification-confidence
# heuristics the frontend used before.
#
# Convention (matches fec_interlevaer/fec/slate_api.py): llr < 0 => bit 1.
#
# No ground-truth symbol timing / bit-mapping is available blindly, so this
# uses rate_probe's own zero-crossing sps estimate (bit_stream_anaylsis/dsp)
# and simple mid-symbol sampling + standard Gray-coded decision regions.
# Treat results as best-effort, not bit-exact -- exactly like rate_probe's
# own documented limits.
# ============================================================
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

_BITSTREAM_ROOT = Path(__file__).parent.parent / "bit_stream_anaylsis"
if str(_BITSTREAM_ROOT) not in sys.path:
    sys.path.insert(0, str(_BITSTREAM_ROOT))

from dsp.rate_probe import estimate_sps  # noqa: E402

# bit_stream_anaylsis/dsp/rate_normalize.py implements the same polyphase resample-to-canonical
# step but imports it via a `src.dsp.rate_probe` path that doesn't exist in this delivered
# layout (ModuleNotFoundError: No module named 'src') -- inlined here instead of depending on
# that broken wrapper; the resampling logic itself (Fraction + resample_poly) is theirs.
from fractions import Fraction

from scipy.signal import resample_poly

# A fixed-integer sampling stride only tracks the true (generally non-integer) symbol rate
# exactly at this canonical rate -- resampling first means the stride never drifts, however
# long the stream is.
CANONICAL_SPS = 8


def _resample_to_canonical(z: np.ndarray, sps_hat: float, canonical_sps: int = CANONICAL_SPS) -> np.ndarray:
    if not np.isfinite(sps_hat) or sps_hat <= 0:
        return z
    ratio = Fraction(canonical_sps / sps_hat).limit_denominator(64)
    up, down = ratio.numerator, ratio.denominator
    if up == down:
        return z
    ri = np.stack([z.real, z.imag], axis=0)
    rs = resample_poly(ri, up, down, axis=1)
    return (rs[0] + 1j * rs[1]).astype(np.complex128)

BITS_PER_SYMBOL = {
    "OOK": 1, "PAM": 2, "2FSK": 1, "4FSK": 2, "CPFSK": 1, "GMSK": 1,
    "BPSK": 1, "QPSK": 2, "8PSK": 3, "16QAM": 4, "64QAM": 6,
    "OOK/ASK": 1, "2-FSK": 1, "4-FSK": 2, "GFSK/GMSK": 1,
    "8-PSK": 3, "16-QAM": 4, "64-QAM": 6,
}

NO_BITSTREAM_MODULATIONS = {"AM", "FM", "NOISE", "Noise"}

_PSK_MODS = {"BPSK", "QPSK", "8PSK", "8-PSK"}
_QAM_MODS = {"16QAM", "64QAM", "16-QAM", "64-QAM"}
_ASK_MODS = {"OOK", "PAM", "OOK/ASK"}
_FSK_MODS = {"2FSK", "4FSK", "CPFSK", "GMSK", "2-FSK", "4-FSK", "GFSK/GMSK"}

MIN_SYMBOLS = 32


def _best_timing_phase(z: np.ndarray, sps_i: int) -> int:
    """Blind symbol-timing phase search: for a Nyquist-shaped pulse, samples taken at the pulse
    peak (the correct symbol instant) carry the most energy, while samples taken between symbols
    (worst-case ISI) carry the least -- so the phase that maximizes mean |z|^2 across the sampled
    grid is a reasonable coarse timing estimate, without a full Gardner/Mueller-Muller loop."""
    power = np.abs(z) ** 2
    best_phase, best_energy = 0, -1.0
    for phase in range(sps_i):
        samples = power[phase::sps_i]
        if len(samples) == 0:
            continue
        energy = float(np.mean(samples))
        if energy > best_energy:
            best_energy, best_phase = energy, phase
    return best_phase


# estimate_sps has a real, documented error margin (~single-digit % at good SNR, worse below
# 0 dB): a single global resample ratio built from it drifts by a full symbol over a long
# stream. Re-locking the timing phase every BLOCK_SYMBOLS symbols (a coarse, block-wise stand-in
# for a continuous Gardner/Mueller-Muller timing loop) keeps that drift from accumulating past a
# sub-symbol error within each block.
BLOCK_SYMBOLS = 25


def _symbol_samples(z: np.ndarray, sps_hat: float) -> np.ndarray:
    """Resample to a fixed integer canonical sps first (polyphase, tracks the true possibly
    non-integer symbol rate), then take a fixed-stride symbol grid whose phase is re-locked every
    BLOCK_SYMBOLS symbols so residual sps error can't drift the grid off the true symbol centers."""
    z_canon = _resample_to_canonical(z, sps_hat, canonical_sps=CANONICAL_SPS)
    n_symbols_total = len(z_canon) // CANONICAL_SPS
    if n_symbols_total < MIN_SYMBOLS:
        return np.array([], dtype=np.complex128)

    block_len = BLOCK_SYMBOLS * CANONICAL_SPS
    out = []
    for start in range(0, len(z_canon) - block_len + 1, block_len):
        block = z_canon[start:start + block_len]
        phase = _best_timing_phase(block, CANONICAL_SPS)
        idx = phase + np.arange(BLOCK_SYMBOLS) * CANONICAL_SPS
        out.append(block[idx[idx < len(block)]])
    if not out:
        return np.array([], dtype=np.complex128)
    return np.concatenate(out)


def _gray(idx: np.ndarray) -> np.ndarray:
    return idx ^ (idx >> 1)


def _reliability_scale(residual: np.ndarray) -> float:
    """Larger decision-boundary distance / smaller spread => more reliable. Converts a raw
    residual into an LLR-like magnitude scale; not a calibrated noise estimate, just a
    consistent confidence proxy (same role as this project's other 'r' reliability signals)."""
    sigma = float(np.std(residual)) + 1e-6
    return 2.0 / (sigma ** 2)


def _pam_slice(values: np.ndarray, bits_per_dim: int) -> tuple[np.ndarray, np.ndarray]:
    """Uniform Gray-coded PAM decision on a real-valued axis (amplitude, frequency, or one QAM
    dimension). Returns (bits (n, bits_per_dim) uint8, llr (n, bits_per_dim) float32)."""
    m = 1 << bits_per_dim
    lo, hi = float(np.min(values)), float(np.max(values))
    span = max(hi - lo, 1e-9)
    scaled = (values - lo) / span * (m - 1)          # -> [0, m-1]
    idx = np.clip(np.round(scaled), 0, m - 1).astype(int)
    residual = scaled - idx
    scale = _reliability_scale(residual)
    gray = _gray(idx)

    bits = np.zeros((len(values), bits_per_dim), dtype=np.uint8)
    llr = np.zeros((len(values), bits_per_dim), dtype=np.float32)
    conf = (scale * (1.0 - np.abs(residual))).astype(np.float32)
    for k in range(bits_per_dim):
        b = (gray >> (bits_per_dim - 1 - k)) & 1
        bits[:, k] = b
        llr[:, k] = np.where(b == 1, -1.0, 1.0) * conf
    return bits, llr


def _psk_slice(symbols: np.ndarray, bits_per_symbol: int) -> tuple[np.ndarray, np.ndarray]:
    m = 1 << bits_per_symbol
    phase = np.angle(symbols)
    sector = np.round(phase / (2 * np.pi / m)).astype(int) % m
    ideal_phase = sector * 2 * np.pi / m
    residual = np.abs(np.angle(np.exp(1j * (phase - ideal_phase))))  # wrapped angular distance
    scale = _reliability_scale(residual)
    gray = _gray(sector)

    bits = np.zeros((len(symbols), bits_per_symbol), dtype=np.uint8)
    llr = np.zeros((len(symbols), bits_per_symbol), dtype=np.float32)
    conf = (scale * (1.0 - residual / (np.pi / m + 1e-9))).astype(np.float32)
    conf = np.clip(conf, 0.0, None)
    for k in range(bits_per_symbol):
        b = (gray >> (bits_per_symbol - 1 - k)) & 1
        bits[:, k] = b
        llr[:, k] = np.where(b == 1, -1.0, 1.0) * conf
    return bits, llr


def estimate_and_demod(z: np.ndarray, modulation: str, family: str) -> dict:
    """Returns dict(ok, reason?, bits, llr, sps, bits_per_symbol, n_symbols)."""
    z = np.asarray(z, dtype=np.complex128)

    rate = estimate_sps(z)
    if not np.isfinite(rate.sps_hat) or rate.confidence < 0.15:
        return dict(ok=False, reason="could not blindly estimate symbol timing (low SNR or too short)")

    symbols = _symbol_samples(z, rate.sps_hat)
    if len(symbols) == 0:
        return dict(ok=False, reason="signal too short after symbol-rate sampling")

    bps = BITS_PER_SYMBOL.get(modulation, 1)

    if modulation in _PSK_MODS:
        bits2d, llr2d = _psk_slice(symbols, bps)
    elif modulation in _QAM_MODS:
        half = bps // 2
        s = symbols / (np.sqrt(np.mean(np.abs(symbols) ** 2)) + 1e-12)
        i_bits, i_llr = _pam_slice(s.real, half)
        q_bits, q_llr = _pam_slice(s.imag, half)
        bits2d = np.concatenate([i_bits, q_bits], axis=1)
        llr2d = np.concatenate([i_llr, q_llr], axis=1)
    elif modulation in _ASK_MODS:
        amp = np.abs(symbols)
        bits2d, llr2d = _pam_slice(amp, bps)
    elif modulation in _FSK_MODS:
        phase = np.unwrap(np.angle(symbols))
        inst_freq = np.concatenate([[0.0], np.diff(phase)])
        bits2d, llr2d = _pam_slice(inst_freq, bps)
    else:
        return dict(ok=False, reason=f"no bitstream demodulator for modulation '{modulation}'")

    bits = bits2d.reshape(-1).astype(np.uint8)
    llr = llr2d.reshape(-1).astype(np.float32)

    return dict(
        ok=True,
        bits=bits,
        llr=llr,
        sps=round(float(rate.sps_hat), 3),
        bits_per_symbol=bps,
        n_symbols=len(symbols),
    )
