# ============================================================
# SR-Mamba AMC v2 -- preprocessing.
# Copied from SIH-2026-PS147/notebooks/srmamba_amc_training_v2.ipynb's preprocess_record /
# analytic_features cells (the exact pipeline the checkpoint was trained on) -- a different,
# BLIND-rate-estimate-driven pipeline from v1's backend/preprocess.py (different normalization,
# different analytic feature set: 9 cumulants + 2 Haar-DWT + 1 SNR, not v1's 9+2+1 with a
# different cumulant formula).
# ============================================================
from __future__ import annotations

import numpy as np
import pywt
import torch

from demod import _resample_to_canonical
from dsp.rate_probe import estimate_sps


def power_normalize(z: np.ndarray) -> np.ndarray:
    """Unit mean power -- matches the legacy inference scripts' preprocessing contract."""
    p = np.mean(np.abs(z) ** 2)
    if p < 1e-12:
        return z
    return z / np.sqrt(p)


def fixed_window(z: np.ndarray, length: int) -> np.ndarray:
    """Center-crop / zero-pad a complex IQ array to exactly `length` samples."""
    n = len(z)
    if n == length:
        return z
    if n > length:
        start = (n - length) // 2
        return z[start:start + length]
    out = np.zeros(length, dtype=z.dtype)
    start = (length - n) // 2
    out[start:start + n] = z
    return out


def complex_to_iq_array(z: np.ndarray) -> np.ndarray:
    return np.stack([z.real, z.imag], axis=0).astype(np.float32)


def compute_cumulants(z: np.ndarray) -> np.ndarray:
    """9 normalized cumulant magnitudes from complex baseband IQ `z`."""
    z = z - np.mean(z)
    m2 = np.mean(z * z)
    m2c = np.mean(z * np.conj(z))
    m4 = np.mean(z ** 4)
    m6 = np.mean(z ** 6)
    m8 = np.mean(z ** 8)

    c20 = m2
    c40 = m4 - 3 * m2 ** 2
    c41 = np.mean((z ** 3) * np.conj(z)) - 3 * m2 * m2c
    c42 = np.mean(np.abs(z) ** 4) - np.abs(m2) ** 2 - 2 * m2c ** 2
    c60 = m6 - 15 * m2 * m4 + 30 * m2 ** 3
    c61 = (np.mean((z ** 5) * np.conj(z)) - 5 * m2c * m4 - 10 * m2 * np.mean((z ** 3) * np.conj(z))
           + 30 * m2 ** 2 * m2c)
    c62 = (np.mean((z ** 4) * np.conj(z) ** 2) - 6 * m2 * np.mean(np.abs(z) ** 4)
           - 8 * m2c * np.mean((z ** 3) * np.conj(z)) + 6 * m2 ** 2 * m2c
           + 24 * m2c ** 3 + 12 * np.abs(m2) ** 2 * m2c)
    c63 = 0.0  # placeholder analytic slot; zero-contribution if not estimable from short windows
    c80 = m8 - 28 * m2 * m6 - 35 * m4 ** 2 + 420 * m2 ** 2 * m4 - 630 * m2 ** 4

    vals = [c20, c40, c41, c42, c60, c61, c62, c63, c80]
    p = max(m2c.real, 1e-3)
    feats = np.array([np.abs(v) / (p ** (i2 / 2)) for i2, v in
                       zip([1, 2, 2, 2, 3, 3, 3, 3, 4], vals)], dtype=np.float32)
    return np.nan_to_num(feats, nan=0.0, posinf=0.0, neginf=0.0).clip(-1e4, 1e4)


def compute_dwt_features(iq: np.ndarray) -> np.ndarray:
    """Haar-DWT detail-coefficient variance + mean."""
    amp = np.sqrt(iq[0] ** 2 + iq[1] ** 2)
    _, cd = pywt.dwt(amp, "haar")
    return np.array([np.var(cd), np.mean(np.abs(cd))], dtype=np.float32)


def estimate_snr_db(iq: np.ndarray) -> float:
    """Blind SNR estimate via M2M4 moments."""
    z = iq[0] + 1j * iq[1]
    m2 = np.mean(np.abs(z) ** 2)
    m4 = np.mean(np.abs(z) ** 4)
    if m2 <= 1e-12:
        return -20.0
    kurt = m4 / (m2 ** 2)
    snr_lin = np.sqrt(max(2 * kurt - 6, 1e-6)) if kurt > 3 else 1e-3
    return float(10 * np.log10(snr_lin + 1e-9))


def analytic_features(iq: np.ndarray) -> np.ndarray:
    z = iq[0] + 1j * iq[1]
    cum = compute_cumulants(z)
    dwt = compute_dwt_features(iq)
    snr = np.array([estimate_snr_db(iq)], dtype=np.float32)
    return np.concatenate([cum, dwt, snr]).astype(np.float32)  # 9 + 2 + 1 = 12


def preprocess_v2(z: np.ndarray, window_len: int = 1024, canonical_sps: float = 8.0) -> dict:
    """BLIND preprocessing pipeline (mirrors preprocess_record in the training notebook): sps
    is estimated from `z` itself via dsp.rate_probe -- never a label. `z` is the full-length
    complex signal (e.g. from preprocess.load_iq_bytes), not yet windowed."""
    z_raw = power_normalize(fixed_window(z, window_len))

    rate_est = estimate_sps(z)
    if np.isfinite(rate_est.sps_hat) and rate_est.sps_hat > 0:
        z_canon_full = _resample_to_canonical(z, rate_est.sps_hat, canonical_sps)
    else:
        z_canon_full = z
    z_canon = power_normalize(fixed_window(z_canon_full, window_len))

    def pair(a: np.ndarray) -> torch.Tensor:
        return torch.from_numpy(complex_to_iq_array(a)).unsqueeze(0)  # [1, 2, N]

    feats = analytic_features(complex_to_iq_array(z_raw))

    return {
        "raw": pair(z_raw),
        "canonical": pair(z_canon),
        "features": torch.from_numpy(feats).unsqueeze(0),          # [1, 12]
        "sps_hat": torch.tensor([rate_est.sps_hat if np.isfinite(rate_est.sps_hat) else canonical_sps],
                                 dtype=torch.float32),
        "conf_hat": torch.tensor([rate_est.confidence], dtype=torch.float32),
    }
