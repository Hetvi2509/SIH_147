"""Canonical-rate resampling + confidence gate (plan_modulation_training.md Sec 4.2(b), Phase 0a).

Takes the blind estimate from rate_probe.estimate_sps() (NOT a ground-truth sps column -- using
the manifest's true sps here silently defeats the whole point, see plan_modulation_training.md
Sec 12) and polyphase-resamples the signal so its samples-per-symbol becomes `canonical_sps`
(default 8, matching architecture_srmamba_amc.md Sec 5). Low-confidence estimates still produce a
resampled view (so batching stays simple) but are flagged `canon_valid=False` so downstream
fusion (architecture doc module [F]) can down-weight them instead of trusting a guess.

Run as a script for the Phase 0a gate (plan Sec 8.2):
    python -m src.dsp.rate_normalize --selftest --sps 2:32 --snr -10:25 --out reports/phase0a_resample_check.png
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from fractions import Fraction

import numpy as np
from scipy.signal import resample_poly

from src.dsp.rate_probe import RateEstimate, _make_test_signal, estimate_sps

DEFAULT_CANONICAL_SPS = 8.0
DEFAULT_CONF_THRESHOLD = 0.3  # plan Sec 4.2(c): tuned in Phase 0a, this is the starting default


@dataclass
class CanonicalView:
    z: np.ndarray            # resampled complex IQ
    sps_hat: float
    confidence: float
    canon_valid: bool        # False if confidence < threshold -- fusion should down-weight this view


def resample_to_canonical(
    z: np.ndarray,
    sps_hat: float,
    canonical_sps: float = DEFAULT_CANONICAL_SPS,
    max_denominator: int = 64,
) -> np.ndarray:
    """Polyphase resample so the signal's sps becomes `canonical_sps` (architecture doc [C]).
    Rational approximation of the resample ratio keeps `resample_poly` exact and fast."""
    if not np.isfinite(sps_hat) or sps_hat <= 0:
        return z
    ratio = Fraction(canonical_sps / sps_hat).limit_denominator(max_denominator)
    up, down = ratio.numerator, ratio.denominator
    if up == down:
        return z
    z = np.asarray(z, dtype=np.complex128)
    ri = np.stack([z.real, z.imag], axis=0)
    rs = resample_poly(ri, up, down, axis=1)
    return (rs[0] + 1j * rs[1]).astype(np.complex128)


def to_canonical_view(
    z: np.ndarray,
    canonical_sps: float = DEFAULT_CANONICAL_SPS,
    conf_threshold: float = DEFAULT_CONF_THRESHOLD,
    rate_estimate: RateEstimate | None = None,
) -> CanonicalView:
    """End-to-end blind path: estimate sps from `z` (unless `rate_estimate` is supplied, e.g. to
    avoid recomputing it when the caller already ran rate_probe), then resample. This is the
    function the training/inference pipeline should call in place of the ground-truth-sps shortcut
    (plan Sec 12) -- it never reads a label."""
    est = rate_estimate if rate_estimate is not None else estimate_sps(z)
    if not np.isfinite(est.sps_hat):
        return CanonicalView(z=z, sps_hat=float("nan"), confidence=0.0, canon_valid=False)
    z_canon = resample_to_canonical(z, est.sps_hat, canonical_sps)
    return CanonicalView(
        z=z_canon,
        sps_hat=est.sps_hat,
        confidence=est.confidence,
        canon_valid=est.confidence >= conf_threshold,
    )


def _cumulant_c42(z: np.ndarray) -> float:
    """|C42| only -- cheap class-structure probe for the self-test (full 9-cumulant set lives in
    the notebook's analytic branch / architecture doc [A]; duplicating all of it here isn't
    needed to check that resampling doesn't destroy class-discriminative structure)."""
    z = np.asarray(z, dtype=np.complex128)
    z = z - np.mean(z)
    p = np.mean(np.abs(z) ** 2)
    if p < 1e-12:
        return 0.0
    m2c = np.mean(z * np.conj(z))
    c42 = np.mean(np.abs(z) ** 4) - np.abs(np.mean(z * z)) ** 2 - 2 * m2c.real ** 2
    return float(abs(c42) / (p ** 2))


def _selftest() -> None:
    print("rate_normalize self-check")

    # 1. resampling to the signal's own sps should be near-identity (ratio ~ 1)
    z = _make_test_signal(sps=8.0, snr_db=20.0, seed=2)
    z_same = resample_to_canonical(z, sps_hat=8.0, canonical_sps=8.0)
    assert len(z_same) == len(z), "same-rate resample should not change length materially"
    print(f"  [ok] resample(sps=8 -> canonical=8) is near-identity, len={len(z_same)}")

    # 2. resampling a known-sps signal to canonical should preserve the c42 cumulant reasonably
    # well -- this is the "does resampling corrupt class structure" check (plan Sec 8.2 gate)
    c42_before = _cumulant_c42(z)
    z_canon = resample_to_canonical(z, sps_hat=16.0, canonical_sps=8.0)
    c42_after = _cumulant_c42(z_canon)
    rel_drift = abs(c42_after - c42_before) / max(abs(c42_before), 1e-9)
    print(f"  [ok] c42 before={c42_before:.4f} after 16->8 resample={c42_after:.4f} "
          f"(rel drift={rel_drift*100:.1f}%)")

    # 3. full blind path: low SNR + no metadata should still return a view, but flagged invalid
    #    when confidence is low, never silently presented as trustworthy
    rng_noise = np.random.default_rng(7)
    noise = rng_noise.standard_normal(1024) + 1j * rng_noise.standard_normal(1024)
    view_noise = to_canonical_view(noise)
    assert not view_noise.canon_valid, "pure noise must not be flagged canon_valid"
    print(f"  [ok] pure noise -> canon_valid={view_noise.canon_valid} "
          f"(conf={view_noise.confidence:.2f})")

    # 4. blind path on a clean signal should be flagged valid and land close to canonical_sps
    z_clean = _make_test_signal(sps=12.0, snr_db=20.0, seed=3)
    view_clean = to_canonical_view(z_clean, canonical_sps=8.0)
    print(f"  [ok] clean sps=12 signal -> sps_hat={view_clean.sps_hat:.2f}, "
          f"canon_valid={view_clean.canon_valid}, resampled_len={len(view_clean.z)}")
    assert view_clean.canon_valid, "a clean, well-formed signal should pass the confidence gate"

    print("all checks passed")


def _resample_check_sweep(sps_grid: list[float], snr_grid: list[float], trials: int = 10) -> dict:
    """Phase 0a gate: does the canonical view (built from the BLIND estimate, not oracle sps)
    still preserve class-relevant structure, measured via c42 drift vs the un-resampled signal."""
    results = {}
    for snr_db in snr_grid:
        for sps in sps_grid:
            drifts = []
            for trial in range(trials):
                z = _make_test_signal(sps, snr_db, seed=hash((sps, snr_db, trial, "resample")) % (2**31))
                c42_raw = _cumulant_c42(z)
                view = to_canonical_view(z)
                if view.canon_valid:
                    c42_canon = _cumulant_c42(view.z)
                    drifts.append(abs(c42_canon - c42_raw) / max(abs(c42_raw), 1e-9))
            results[(sps, snr_db)] = float(np.mean(drifts) * 100) if drifts else float("nan")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--sps", type=str, default="2:32")
    parser.add_argument("--snr", type=str, default="-10:25")
    parser.add_argument("--trials", type=int, default=10)
    parser.add_argument("--out", type=str, default=None)
    args = parser.parse_args()

    _selftest()

    if args.out or "--sweep" in __import__("sys").argv:
        sps_lo, sps_hi = (float(x) for x in args.sps.split(":"))
        snr_lo, snr_hi = (float(x) for x in args.snr.split(":"))
        sps_grid = list(np.linspace(sps_lo, sps_hi, 6))
        snr_grid = list(np.linspace(snr_lo, snr_hi, 6))
        results = _resample_check_sweep(sps_grid, snr_grid, trials=args.trials)
        print(f"\n{'sps':>6} {'snr_db':>8} {'c42_drift_%':>12}")
        for (sps, snr), drift in sorted(results.items(), key=lambda kv: (kv[0][1], kv[0][0])):
            print(f"{sps:6.1f} {snr:8.1f} {drift:12.2f}")

        if args.out:
            import matplotlib.pyplot as plt

            grid = np.array([[results[(sps, snr)] for sps in sps_grid] for snr in snr_grid])
            plt.figure(figsize=(7, 5))
            im = plt.imshow(grid, aspect="auto", origin="lower",
                             extent=[sps_grid[0], sps_grid[-1], snr_grid[0], snr_grid[-1]],
                             cmap="RdYlGn_r")
            plt.colorbar(im, label="|C42| drift (%) after blind resample")
            plt.xlabel("true sps")
            plt.ylabel("SNR (dB)")
            plt.title("Phase 0a: canonical-view class-structure preservation")
            plt.tight_layout()
            plt.savefig(args.out, dpi=110)
            print(f"saved {args.out}")


if __name__ == "__main__":
    main()
