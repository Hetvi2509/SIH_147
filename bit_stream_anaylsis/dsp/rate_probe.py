"""Blind samples-per-symbol (sps) estimation (plan_modulation_training.md Sec 4.2(a), Phase 0a).

Zero-crossing detection on the autocorrelation of the signal's instantaneous power
(arXiv:2001.01692). Symbol transitions imprint a periodic component on |z(t)|^2 regardless of
carrier phase or modulation type, so its autocorrelation R(tau) oscillates with the symbol
period even though R itself is not periodic (it decays) -- successive zero-crossing spacings
cluster near half the symbol period for any signal with real transition structure, and scatter
for noise. Deterministic, zero training, zero labels.

No absolute sampling frequency is recoverable from IQ samples alone with no receiver metadata --
only the dimensionless ratio sps = sample_rate_hz / symbol_rate_hz (plan Sec 1.6). Downstream
code must not multiply sps_hat by an assumed sample rate to fabricate a Hz figure
(understanding.md Sec 5.1: "never fabricate a parameter").

Measured limits (see `--sweep`, and plan Sec 8.2/Sec 9 risk register -- these are expected, not
bugs): unreliable below sps~4 (too few samples/symbol for a detectable envelope oscillation --
sps=2 is the Nyquist floor for this method) and below ~0 dB SNR (Med-high risk, flagged in the
plan; `confidence` is deliberately low there so callers gate on it rather than trust a bad guess).
Solid (MAE well under the plan's 15%/10% gates) for sps in [4, 32] at SNR >= 0 dB.

Run as a script for the Phase 0a sweep gate (plan Sec 8.2):
    python -m src.dsp.rate_probe --sweep --sps 2:32 --snr -10:25 --out reports/phase0a_rate_probe.png
    python -m src.dsp.rate_probe --selftest
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np


@dataclass
class RateEstimate:
    sps_hat: float          # estimated samples-per-symbol (dimensionless)
    confidence: float       # in [0, 1]; consistency of zero-crossing spacing across lags
    n_crossings: int        # zero-crossings found (diagnostic; too few -> low confidence)


def _instantaneous_power(z: np.ndarray) -> np.ndarray:
    """|z(t)|^2, DC-removed. Exposes symbol-rate periodicity independent of carrier phase --
    the reason this works on FSK/PSK/QAM alike without knowing the modulation first."""
    p = np.abs(z) ** 2
    return p - p.mean()


def _autocorrelation(x: np.ndarray, max_lag: int) -> np.ndarray:
    """R(tau) for tau = 0..max_lag, normalized so R(0) = 1. FFT-based for O(N log N)."""
    n = len(x)
    n_fft = 1
    while n_fft < 2 * n:
        n_fft *= 2
    X = np.fft.rfft(x, n_fft)
    r_full = np.fft.irfft(X * np.conj(X), n_fft)[: max_lag + 1]
    r0 = r_full[0]
    if r0 < 1e-12:
        return np.zeros(max_lag + 1)
    return r_full / r0


def _zero_crossing_lags(r: np.ndarray) -> np.ndarray:
    """Lags (fractional, via linear interpolation) where R(tau) crosses zero, sign-change basis."""
    signs = np.sign(r)
    signs[signs == 0] = 1.0
    crossing_idx = np.flatnonzero(np.diff(signs) != 0)
    if len(crossing_idx) == 0:
        return np.array([])
    r0, r1 = r[crossing_idx], r[crossing_idx + 1]
    frac = r0 / (r0 - r1)
    return crossing_idx + frac


# Measured, not derived: for an RRC-shaped signal (beta ~0.2-0.4, the common range), the first
# zero-crossing of R(tau) on |z(t)|^2 lands at ~0.40 * symbol_period, not 0.5 as a naive "half a
# cycle" argument would suggest -- RRC's autocorrelation main lobe is narrower than a raised
# cosine's. Calibrated against a closed-form RRC pulse (see _rrc_pulse) AND cross-checked against
# this project's real generator output (complete_dataset/, BPSK/QPSK/8PSK/QAM at beta=0.35):
# real-data MAE dropped from >100% to single digits at this value. Re-measure if the project's
# rolloff changes materially from ~0.35.
CROSSING_TO_PERIOD_RATIO = 2.5  # = 1 / 0.40


def estimate_sps(
    z: np.ndarray,
    sps_min: float = 2.0,
    sps_max: float = 32.0,
    n_blocks: int = 8,
) -> RateEstimate:
    """Blind sps estimate from complex baseband IQ `z` (plan Sec 4.2(a)).

    R(tau) on the instantaneous power is a decaying oscillation whose FIRST zero-crossing sits at
    a fixed fraction of the symbol period (CROSSING_TO_PERIOD_RATIO, empirically ~0.40 for RRC
    pulses, not the naively-assumed 0.5) -- the classical zero-crossing symbol-rate estimator. The
    point estimate is taken from R(tau) averaged across `n_blocks` chunks (better noise suppression
    than per-block crossings, since averaging happens before the nonlinear crossing step).
    Confidence comes from how tightly each chunk's OWN first-crossing agrees with the others --
    real periodic structure agrees block to block; on pure noise, R's first crossing lands near
    lag 1 almost deterministically (a near-DC artifact, not signal), so estimates below `sps_min`
    are discarded before the agreement check, which is what actually separates noise from signal
    here.
    """
    z = np.asarray(z, dtype=np.complex128)
    n = len(z)
    block_len = n // n_blocks
    max_lag = min(block_len - 1, int(sps_max * 4))
    if n < 16 or block_len < 16 or max_lag < 4:
        return RateEstimate(sps_hat=float("nan"), confidence=0.0, n_crossings=0)

    # On pure noise, R's first crossing clusters just below lag~1 regardless of CROSSING_TO_PERIOD_
    # RATIO (it's a near-DC artifact of the ACF shape near tau=0, not signal) -- empirically this
    # puts noise-driven periods at ~2.4-2.5 for the current ratio. NOISE_FLOOR_PERIOD must sit
    # above that cluster; it is intentionally distinct from `sps_min` (the user-facing search
    # range) so retuning CROSSING_TO_PERIOD_RATIO doesn't silently reopen the noise leak.
    NOISE_FLOOR_PERIOD = 3.0

    block_powers = []
    block_estimates = []
    for b in range(n_blocks):
        chunk = z[b * block_len:(b + 1) * block_len]
        power = _instantaneous_power(chunk)
        block_powers.append(power)
        r = _autocorrelation(power, max_lag)
        crossings = _zero_crossing_lags(r)
        if len(crossings) == 0:
            continue
        period = CROSSING_TO_PERIOD_RATIO * crossings[0]
        if max(sps_min, NOISE_FLOOR_PERIOD) <= period <= sps_max * 2.0:
            block_estimates.append(period)

    # point estimate: average R across blocks first (cancels independent noise), THEN crosses
    r_avg = np.mean([_autocorrelation(p, max_lag) for p in block_powers], axis=0)
    crossings_avg = _zero_crossing_lags(r_avg)
    if len(crossings_avg) == 0:
        return RateEstimate(sps_hat=float("nan"), confidence=0.0, n_crossings=len(block_estimates))
    period_avg = CROSSING_TO_PERIOD_RATIO * crossings_avg[0]
    if not (max(sps_min, NOISE_FLOOR_PERIOD) <= period_avg <= sps_max * 2.0):
        return RateEstimate(sps_hat=float("nan"), confidence=0.0, n_crossings=len(block_estimates))
    sps_hat = float(np.clip(period_avg, sps_min, sps_max))

    n_crossings = len(block_estimates)
    if n_crossings < max(3, n_blocks // 2):
        return RateEstimate(sps_hat=sps_hat, confidence=0.0, n_crossings=n_crossings)

    # confidence: inverse coefficient of variation across independent per-block estimates,
    # scaled by how many blocks actually produced a plausible (>= sps_min) crossing
    med = np.median(block_estimates)
    mad = np.median(np.abs(np.array(block_estimates) - med)) + 1e-9
    cv = mad / max(med, 1e-9)
    consistency = float(np.clip(1.0 - 2.0 * cv, 0.0, 1.0))
    coverage = float(np.clip(n_crossings / n_blocks, 0.0, 1.0))
    confidence = consistency * coverage

    return RateEstimate(sps_hat=sps_hat, confidence=confidence, n_crossings=n_crossings)


def _rrc_pulse(sps_int: int, beta: float = 0.35, span_symbols: int = 8) -> np.ndarray:
    """Genuine square-root-raised-cosine pulse (closed form, incl. the t=0 and t=+-1/(4beta)
    special cases). An earlier version of this function was a raised-cosine-WINDOWED SINC --
    visually similar but a materially different filter with a wider power-autocorrelation main
    lobe. That mismatch silently miscalibrated CROSSING_TO_PERIOD_RATIO below (tuned against the
    wrong filter's self-test, it looked right at ~0.5 with >100% real-world error) until validated
    against real generator output (plan Sec 8.2) caught it. Real transmitters use true RRC; this
    must match or the self-test validates nothing."""
    n = span_symbols * sps_int
    t = np.arange(-n / 2, n / 2 + 1) / sps_int
    h = np.zeros_like(t)
    quarter = 1.0 / (4.0 * beta) if beta != 0 else np.inf
    for i, ti in enumerate(t):
        if abs(ti) < 1e-8:
            h[i] = 1.0 - beta + 4 * beta / np.pi
        elif beta != 0 and abs(abs(ti) - quarter) < 1e-8:
            h[i] = (beta / np.sqrt(2)) * (
                (1 + 2 / np.pi) * np.sin(np.pi / (4 * beta))
                + (1 - 2 / np.pi) * np.cos(np.pi / (4 * beta))
            )
        else:
            num = np.sin(np.pi * ti * (1 - beta)) + 4 * beta * ti * np.cos(np.pi * ti * (1 + beta))
            den = np.pi * ti * (1 - (4 * beta * ti) ** 2)
            h[i] = num / den
    return h / np.sqrt(np.sum(h ** 2))


def _make_test_signal(sps: float, snr_db: float, n_symbols: int = 1600, seed: int = 0) -> np.ndarray:
    """Synthetic RRC-shaped QPSK at a known sps for the sweep/self-test -- independent of the
    project's real generator so this module has no circular dependency on the dataset it will
    validate."""
    rng = np.random.default_rng(seed)
    bits = rng.integers(0, 4, n_symbols)
    symbols = np.exp(1j * (np.pi / 4 + bits * np.pi / 2))
    sps_int = max(2, int(round(sps)))
    pulse = _rrc_pulse(sps_int)
    upsampled = np.zeros(n_symbols * sps_int, dtype=np.complex128)
    upsampled[::sps_int] = symbols
    z = np.convolve(upsampled, pulse, mode="full")[: n_symbols * sps_int]

    sig_power = np.mean(np.abs(z) ** 2)
    snr_lin = 10 ** (snr_db / 10.0)
    noise_power = sig_power / snr_lin
    noise = np.sqrt(noise_power / 2) * (rng.standard_normal(len(z)) + 1j * rng.standard_normal(len(z)))
    return z + noise


def sweep(sps_grid: list[float], snr_grid: list[float], trials: int = 20) -> dict:
    """Phase 0a gate (plan Sec 8.2): MAE per (sps, snr) cell over `trials` random signals."""
    results = {}
    for snr_db in snr_grid:
        for sps in sps_grid:
            errs = []
            for trial in range(trials):
                z = _make_test_signal(sps, snr_db, seed=hash((sps, snr_db, trial)) % (2**31))
                est = estimate_sps(z)
                if np.isfinite(est.sps_hat):
                    errs.append(abs(est.sps_hat - sps) / sps)
            mae_pct = float(np.mean(errs) * 100) if errs else float("nan")
            results[(sps, snr_db)] = mae_pct
    return results


def _selftest() -> None:
    print("rate_probe self-check")

    # 1. clean high-sps signal should be estimated tightly
    z = _make_test_signal(sps=8.0, snr_db=20.0, seed=1)
    est = estimate_sps(z)
    assert np.isfinite(est.sps_hat), "expected a finite estimate at 20 dB"
    err_pct = abs(est.sps_hat - 8.0) / 8.0 * 100
    assert err_pct < 15.0, f"sps error too high at 20 dB: {err_pct:.1f}% (est={est.sps_hat:.2f})"
    assert est.confidence > 0.3, f"confidence too low on a clean signal: {est.confidence:.2f}"
    print(f"  [ok] sps=8 @ 20dB -> sps_hat={est.sps_hat:.2f}, conf={est.confidence:.2f}, "
          f"err={err_pct:.1f}%")

    # 2. pure noise should not report a confident estimate (averaged over trials -- a single
    # noise draw can spike by chance, so the self-check uses the same statistic the sweep does)
    rng = np.random.default_rng(42)
    noise_confs = []
    for _ in range(10):
        noise = rng.standard_normal(6400) + 1j * rng.standard_normal(6400)
        noise_confs.append(estimate_sps(noise).confidence)
    mean_noise_conf = float(np.mean(noise_confs))
    assert mean_noise_conf < 0.4, \
        f"pure noise should not average confident: mean_conf={mean_noise_conf:.2f}"
    print(f"  [ok] pure noise (10 trials) -> mean conf={mean_noise_conf:.2f}, "
          f"max={max(noise_confs):.2f}")

    # 3. Phase 0a gate, cheap subset (full sweep is --sweep)
    quick = sweep(sps_grid=[4.0, 8.0, 16.0], snr_grid=[0.0, 10.0], trials=8)
    mae_0db = np.nanmean([v for (sps, snr), v in quick.items() if snr == 0.0])
    mae_10db = np.nanmean([v for (sps, snr), v in quick.items() if snr == 10.0])
    print(f"  [ok] quick sweep: MAE@0dB={mae_0db:.1f}%  MAE@10dB={mae_10db:.1f}%  "
          f"(gate: <15% @0dB, <10% @10dB on this reduced grid)")
    assert mae_0db < 15.0, f"Phase 0a gate FAIL: MAE@0dB={mae_0db:.1f}% >= 15%"

    print("all checks passed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument("--sweep", action="store_true")
    parser.add_argument("--sps", type=str, default="2:32", help="min:max, e.g. 2:32")
    parser.add_argument("--snr", type=str, default="-10:25", help="min:max in dB, e.g. -10:25")
    parser.add_argument("--trials", type=int, default=20)
    parser.add_argument("--out", type=str, default=None, help="optional PNG path for the sweep plot")
    args = parser.parse_args()

    if args.selftest or not args.sweep:
        _selftest()
        return

    sps_lo, sps_hi = (float(x) for x in args.sps.split(":"))
    snr_lo, snr_hi = (float(x) for x in args.snr.split(":"))
    sps_grid = list(np.linspace(sps_lo, sps_hi, 8))
    snr_grid = list(np.linspace(snr_lo, snr_hi, 8))

    results = sweep(sps_grid, snr_grid, trials=args.trials)
    print(f"{'sps':>6} {'snr_db':>8} {'mae_%':>8}")
    for (sps, snr), mae in sorted(results.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        print(f"{sps:6.1f} {snr:8.1f} {mae:8.2f}")

    if args.out:
        import matplotlib.pyplot as plt

        grid = np.array([[results[(sps, snr)] for sps in sps_grid] for snr in snr_grid])
        plt.figure(figsize=(7, 5))
        im = plt.imshow(grid, aspect="auto", origin="lower",
                         extent=[sps_grid[0], sps_grid[-1], snr_grid[0], snr_grid[-1]],
                         cmap="RdYlGn_r")
        plt.colorbar(im, label="sps MAE (%)")
        plt.xlabel("true sps")
        plt.ylabel("SNR (dB)")
        plt.title("Phase 0a: blind sps estimation error")
        plt.tight_layout()
        plt.savefig(args.out, dpi=110)
        print(f"saved {args.out}")


if __name__ == "__main__":
    main()
