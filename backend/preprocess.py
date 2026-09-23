# ============================================================
# SR-Mamba AMC â€” Signal Preprocessing
# Mirrors the IQDataset / helper functions from the notebook.
# ============================================================

from __future__ import annotations

import math
from fractions import Fraction
from functools import lru_cache

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly


# -------------------------------------------------------------------
# Config mirrors (loaded from checkpoint, these are safe defaults)
# -------------------------------------------------------------------

WINDOW_SIZE = 1024   # CONFIG['window_size']
TARGET_SPS  = 8      # CONFIG['target_sps']

# Cumulant orders used for the 9-element moment feature vector
ORDERS = ((2,0),(4,0),(4,1),(4,2),(6,0),(6,1),(6,2),(6,3),(8,0))


# -------------------------------------------------------------------
# Combinatorics helpers (partition-based cumulant computation)
# -------------------------------------------------------------------

def _partitions(items):
    if not items:
        yield ()
        return
    first, rest = items[0], items[1:]
    for part in _partitions(rest):
        yield ((first,),) + part
        for i in range(len(part)):
            yield part[:i] + ((first,) + part[i],) + part[i + 1:]


@lru_cache(maxsize=None)
def _terms(p, q):
    kinds = (0,) * (p - q) + (1,) * q
    out: dict = {}
    for part in _partitions(tuple(range(p))):
        blocks = tuple(sorted(
            (len(b) - sum(kinds[i] for i in b), sum(kinds[i] for i in b))
            for b in part
        ))
        coef = math.factorial(len(part) - 1) * (-1) ** (len(part) - 1)
        out[blocks] = out.get(blocks, 0) + coef
    return [(v, k) for k, v in out.items() if v]


# -------------------------------------------------------------------
# Core signal utilities (verbatim from notebook)
# -------------------------------------------------------------------

def normalize(z: np.ndarray) -> np.ndarray:
    """Zero-mean, unit-power normalization."""
    z = np.asarray(z, np.complex64)
    z = z - z.mean()
    return z / np.sqrt(max(float(np.mean(np.abs(z) ** 2)), 1e-12))


def crop(z: np.ndarray, n: int = WINDOW_SIZE) -> np.ndarray:
    """Normalize â†’ pad if short â†’ center-crop to n samples."""
    z = normalize(z)
    z = np.pad(z, (0, max(0, n - len(z))))
    start = max(0, (len(z) - n) // 2)
    return z[start: start + n]


def analytic(z: np.ndarray) -> np.ndarray:
    """Exact 12-element feature vector from notebookc6abf7ff4f (1).ipynb."""
    x = normalize(z)
    power = np.mean(np.abs(x) ** 2)
    m20 = np.mean(x * x)
    even = x[: len(x) // 2 * 2]
    haar = (even[::2] + even[1::2]) / np.sqrt(2)
    detail = (even[::2] - even[1::2]) / np.sqrt(2)
    return np.asarray([
        abs(m20),
        abs(np.mean(x ** 4) - 3 * m20 * m20),
        abs(np.mean(x ** 3 * np.conj(x)) - 3 * m20 * power),
        abs(np.mean(np.abs(x) ** 4) - abs(m20) ** 2 - 2 * power * power),
        abs(np.mean(x ** 6)),
        abs(np.mean(x ** 5 * np.conj(x))),
        abs(np.mean(x ** 4 * np.conj(x) ** 2)),
        abs(np.mean(x ** 3 * np.conj(x) ** 3)),
        abs(np.mean(x ** 8)),
        np.mean(np.abs(haar)),
        np.var(np.abs(haar)),
        10 * np.log10(power / (np.var(detail) + 1e-12)),
    ], dtype=np.float32)
def canonical_signal(z: np.ndarray, sps: float = np.nan, n: int = WINDOW_SIZE) -> np.ndarray:
    """
    Resample signal to TARGET_SPS symbols/sample, then crop.
    Falls back to plain crop when sps is unknown/invalid.
    """
    if not np.isfinite(sps) or sps <= 0:
        return crop(z, n)
    r = Fraction(TARGET_SPS / float(sps)).limit_denominator(100)
    resampled = resample_poly(z, r.numerator, r.denominator).astype(np.complex64)
    return crop(resampled, n)


# -------------------------------------------------------------------
# File loaders
# -------------------------------------------------------------------

def load_iq_bytes(data: bytes, filename: str) -> np.ndarray:
    """
    Load IQ samples from raw bytes.

    Supported formats / file types:
      .wav  â€” stereo PCM (ch0 = I, ch1 = Q)
      .iq   â€” interleaved float32 raw IQ
      .bin  â€” same as .iq (interleaved float32)
    """
    ext = filename.rsplit('.', 1)[-1].lower()

    if ext == 'wav':
        import io
        rate, arr = wavfile.read(io.BytesIO(data))
        arr = np.asarray(arr)
        if arr.ndim == 2 and arr.shape[1] >= 2:
            # Stereo: ch0=I, ch1=Q
            return arr[:, 0].astype(np.float32) + 1j * arr[:, 1].astype(np.float32)
        # Mono signals remain real-valued; do not reinterpret neighbouring samples as I/Q.
        return arr.astype(np.float32) + 0j

    # .iq / .bin are complex64 little-endian (real/imag float32 pairs).
    sample_bytes = np.dtype(np.complex64).itemsize
    usable = len(data) - (len(data) % sample_bytes)
    if usable == 0:
        raise ValueError("IQ file does not contain a complete complex64 sample.")
    return np.frombuffer(data[:usable], dtype=np.complex64).copy()


# -------------------------------------------------------------------
# Full preprocessing pipeline â†’ tensors ready for model
# -------------------------------------------------------------------

import torch


def preprocess(data: bytes, filename: str, window_size: int = WINDOW_SIZE):
    """
    Load â†’ normalize â†’ crop â†’ compute analytic features.

    Returns a dict matching what the model's forward() expects
    (batch dimension = 1, already on CPU as float32 tensors).
    """
    z = load_iq_bytes(data, filename)

    raw_arr = crop(z, window_size)
    can_arr = canonical_signal(z, np.nan, window_size)  # sps unknown for inference
    feat_arr = analytic(raw_arr)

    def pair(a: np.ndarray) -> torch.Tensor:
        return torch.from_numpy(
            np.stack((a.real, a.imag)).astype(np.float32)
        ).unsqueeze(0)  # [1, 2, N]

    return {
        'raw':       pair(raw_arr),
        'canonical': pair(can_arr),
        'features':  torch.from_numpy(feat_arr).unsqueeze(0),  # [1, 12]
    }
