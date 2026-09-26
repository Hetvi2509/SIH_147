# ============================================================
# Wires the real fec_interlevaer/fec/slate_api.py (Viterbi FEC decode +
# interleaver de-interleaving) and bit_stream_anaylsis/bit_stream (Tier 1,
# training-free frame/CRC recovery) scripts to actual demodulated bits from
# the uploaded signal -- replacing the frontend's classification-confidence
# heuristics with real algorithm output.
# ============================================================
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

_FEC_ROOT = Path(__file__).parent.parent / "fec_interlevaer"
_BITSTREAM_ROOT = Path(__file__).parent.parent / "bit_stream_anaylsis"
for root in (_FEC_ROOT, _BITSTREAM_ROOT):
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

from fec.slate_api import (  # noqa: E402
    K, block_interleaver_perm, conv_encode_171_133, deinterleave, viterbi_decode,
)
from bit_stream.report import analyze as bitstream_analyze  # noqa: E402
from bit_stream.soft_correlate import scan_periods  # noqa: E402

import codem_demod  # noqa: E402 -- module-level attribute access: NO_BITSTREAM_MODULATIONS and the
# model singleton are populated by main.py's startup event, after this module is imported.

# Viterbi decode is a pure-Python O(n_steps * states) loop; bound the trial length so an
# interleaver-shape / bit-shift sweep stays fast. This is a real decode over a real subset of the
# stream, not a synthetic shortcut.
FEC_TRIAL_MAX_BITS = 4096
FEC_SUCCESS_MISMATCH = 0.03  # <=3% coded-bit mismatch after re-encode counts as a successful decode

# Blind demod has no preamble/sync word to align to, so the coded-bit stream may start at any
# offset relative to the true codeword boundary (pulse-shaping filter delay, unknown frame start).
# Sweep small bit shifts and keep the best-scoring one -- this is what a real receiver's frame
# sync would otherwise resolve. Bounded to keep the sweep fast.
FEC_SHIFT_RANGE = range(0, 48)


def _hard_bits_from_llr(llr: np.ndarray) -> np.ndarray:
    return (llr < 0).astype(np.uint8)


def try_fec_decode(llr: np.ndarray) -> dict | None:
    """Rate-1/2 K=7 (171,133) Viterbi decode, self-checked by re-encoding the decoded bits and
    comparing to the input hard bits -- the only verification possible without ground truth."""
    n = len(llr) - (len(llr) % 2)
    n = min(n, FEC_TRIAL_MAX_BITS)
    n_info = n // 2 - (K - 1)
    if n_info < 8:
        return None
    L = llr[:n]
    decoded = viterbi_decode(L, n_info_bits=n_info)
    reencoded = conv_encode_171_133(decoded)
    mismatch = float(np.mean(reencoded != _hard_bits_from_llr(L)))
    return dict(decoded_bits=decoded, mismatch=mismatch, n_info_bits=n_info, n_coded_bits=n)


def _best_shifted_decode(llr: np.ndarray, shifts) -> dict | None:
    """Try try_fec_decode at each bit shift in `shifts`, keep the lowest-mismatch result."""
    best = None
    for shift in shifts:
        if shift >= len(llr) - 16:
            break
        result = try_fec_decode(llr[shift:])
        if result is None:
            continue
        if best is None or result["mismatch"] < best["mismatch"]:
            best = result
        if best["mismatch"] <= FEC_SUCCESS_MISMATCH:
            break
    return best


def find_fec_interleaver(llr: np.ndarray):
    """Best-effort: try no interleaver (sweeping the unknown frame-start bit shift), then a
    handful of plausible block-interleaver shapes, scoring each by post-decode re-encode
    mismatch. Returns (name, (rows, cols) | None, result) for the best attempt, or None if
    nothing could even be trialed."""
    n = len(llr) - (len(llr) % 2)
    n = min(n, FEC_TRIAL_MAX_BITS + max(FEC_SHIFT_RANGE))
    L = llr[:n]

    direct = _best_shifted_decode(L, FEC_SHIFT_RANGE)
    best = ("none", None, direct) if direct is not None else None
    if best is not None and best[2]["mismatch"] <= FEC_SUCCESS_MISMATCH:
        return best

    for rows in (8, 16, 32, 64):
        if n % rows == 0 and n // rows >= 2:
            cols = n // rows
            perm = block_interleaver_perm(rows, cols)
            candidate = deinterleave(L, perm)
            result = _best_shifted_decode(candidate, range(0, 16))
            if result is None:
                continue
            if best is None or result["mismatch"] < best[2]["mismatch"]:
                best = (f"block_{rows}x{cols}", (rows, cols), result)
            if best[2]["mismatch"] <= FEC_SUCCESS_MISMATCH:
                break
    return best


def run_bitstream_fec_analysis(z: np.ndarray, modulation: str, family: str) -> dict:
    if modulation in codem_demod.NO_BITSTREAM_MODULATIONS:
        return dict(
            demod=dict(ok=False, reason=f"{modulation} carries no discrete bitstream"),
            fec=dict(detected=None, family="None", codeRate="N/A", decodingStatus="unknown"),
            interleaver=dict(detected=None, type="None", deinterleavingStatus="unknown"),
            bitstream=dict(
                status="unavailable",
                recovered=dict(totalBits=0, validBits=0, invalidBits=0, previewBits=0,
                                bitPreview="", hexPreview="", encoding="N/A"),
                correlation=dict(score=0.0, peakLag=0, reference="N/A", threshold=0.0,
                                  detected=False, sidelobeRatioDb=0.0, series=[]),
            ),
        )

    demod_result = codem_demod.estimate_and_demod(z, modulation, family)
    if not demod_result["ok"]:
        return dict(
            demod=demod_result,
            fec=dict(detected=False, family="None", codeRate="N/A", decodingStatus="not-detected"),
            interleaver=dict(detected=False, type="None", deinterleavingStatus="not-detected"),
            bitstream=dict(
                status="unavailable",
                recovered=dict(totalBits=0, validBits=0, invalidBits=0, previewBits=0,
                                bitPreview="", hexPreview="", encoding="N/A"),
                correlation=dict(score=0.0, peakLag=0, reference=demod_result["reason"], threshold=0.0,
                                  detected=False, sidelobeRatioDb=0.0, series=[]),
            ),
        )

    llr = demod_result["llr"]
    hard_bits = _hard_bits_from_llr(llr)
    r = np.abs(llr).astype(np.float32)
    # P(bit error | LLR) = 1 / (1 + e^|LLR|) -- standard soft-decision error-probability estimate,
    # averaged into a pre-FEC BER estimate straight from the model's own LLR magnitudes (unlike
    # `reliable_mask` below, which is a median split and is always ~50/50 by construction).
    ber_estimate = float(np.mean(1.0 / (1.0 + np.exp(np.clip(r, 0, 40)))))

    # --- FEC + interleaver: real Viterbi decode / block de-interleaving ---
    best = find_fec_interleaver(llr)
    if best is not None and best[2]["mismatch"] <= FEC_SUCCESS_MISMATCH:
        name, params, result = best
        fec = dict(
            detected=True, family="Convolutional", codeRate="1/2", constraintLength=7,
            decodingStatus="successful", decodedBits=result["n_info_bits"],
            errorBits=int(round(result["mismatch"] * result["n_coded_bits"])),
        )
        if params is None:
            interleaver = dict(detected=False, type="None", deinterleavingStatus="not-detected")
        else:
            rows, _cols = params
            interleaver = dict(detected=True, type="Block", depth=rows, deinterleavingStatus="completed")
    else:
        fec = dict(detected=False, family="None", codeRate="N/A", decodingStatus="not-detected")
        interleaver = dict(detected=False, type="None", deinterleavingStatus="not-detected")

    # --- bit stream Tier 1 analysis: real, training-free period/CRC recovery ---
    total_bits = int(len(hard_bits))
    preview_n = min(256, total_bits)
    bit_str = "".join(str(int(b)) for b in hard_bits[:preview_n])
    hex_str = " ".join(
        format(int(bit_str[i:i + 8].ljust(8, "0"), 2), "02X")
        for i in range(0, len(bit_str), 8)
    )
    reliable_mask = r >= np.median(r)
    valid_bits = int(reliable_mask.sum())
    encoding = f"{modulation}, blind hard-decision"

    tier1 = bitstream_analyze(hard_bits, r)["tier1"]

    if tier1["status"] == "ACCEPT":
        period = tier1["period"]
        tau_grid = np.arange(max(4, period - 32), period + 33)
        scores = scan_periods(hard_bits, r, tau_grid)
        series = [dict(lag=int(t - period), value=round(float(s), 4)) for t, s in zip(tau_grid, scores)]
        peak_score = float(scores[list(tau_grid).index(period)])
        sidelobe = max((abs(p["value"]) for p in series if p["lag"] != 0), default=0.001)
        bitstream = dict(
            status="completed",
            recovered=dict(
                totalBits=total_bits, validBits=valid_bits, invalidBits=total_bits - valid_bits,
                previewBits=preview_n, bitPreview=bit_str, hexPreview=hex_str, encoding=encoding,
            ),
            correlation=dict(
                score=round(float(np.clip(peak_score, -1, 1)), 4), peakLag=int(period),
                reference="Recovered frame period (Tier 1 soft autocorrelation)", threshold=0.0,
                detected=True,
                sidelobeRatioDb=round(float(20 * np.log10(max(abs(peak_score), 1e-6) / sidelobe)), 1),
                series=series,
            ),
        )
    else:
        bitstream = dict(
            status="completed" if total_bits > 0 else "unavailable",
            recovered=dict(
                totalBits=total_bits, validBits=valid_bits, invalidBits=total_bits - valid_bits,
                previewBits=preview_n, bitPreview=bit_str, hexPreview=hex_str, encoding=encoding,
            ),
            correlation=dict(
                score=0.0, peakLag=0, reference=tier1.get("reason", "no periodicity found"),
                threshold=0.0, detected=False, sidelobeRatioDb=0.0, series=[],
            ),
        )

    return dict(
        demod=dict(ok=True, sps=demod_result["sps"], bitsPerSymbol=demod_result["bits_per_symbol"],
                    nBits=total_bits, nSymbols=demod_result["n_symbols"], berEstimate=round(ber_estimate, 6)),
        fec=fec, interleaver=interleaver, bitstream=bitstream,
    )
