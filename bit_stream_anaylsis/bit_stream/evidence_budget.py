"""SIFT Component E -- the evidence budget (plan_bitstream_analysis.md Sec 4.7).

Before claiming any field, answer: do we have enough frames for this claim to be statistically
meaningful? Direct analogue of SLATE's reliability budget (plan_fec_interleaver.md Sec 4.4).

Under a uniform-random null, P(column looks constant over M frames by chance) = 2^-(M-1); with
P columns tested the expected spurious-constant count is P * 2^-(M-1), so bounding that below
alpha gives:

    M_min >= 1 + log2(P / alpha)

With reliability weighting the correct quantity is EFFECTIVE frame count
M_eff = sum_frames tanh(r/2), not the raw count.

This is the multiple-comparisons discipline that plan Sec 9's risk register calls the single
most likely route to a confident wrong answer ("Spurious fields from multiple comparisons --
High probability").
"""
from __future__ import annotations

import numpy as np


def m_min(n_columns: int, alpha: float) -> int:
    """plan Sec 4.7: minimum frame count before a "constant column" claim is admissible."""
    return int(np.ceil(1 + np.log2(n_columns / alpha)))


def effective_frame_count(r_per_frame: np.ndarray) -> float:
    """M_eff = sum_frames tanh(r/2) -- unreliable frames buy less evidence than clean ones."""
    return float(np.sum(np.tanh(r_per_frame / 2.0)))


def spurious_constant_column_rate(
    n_columns: int, n_frames: int, n_trials: int, rng: np.random.Generator
) -> float:
    """Monte-Carlo: generate n_trials sets of (n_frames, n_columns) uniform-random bits, measure
    how often a column is constant across all frames purely by chance."""
    hits = 0
    for _ in range(n_trials):
        mat = rng.integers(0, 2, size=(n_frames, n_columns))
        col_constant = np.all(mat == mat[0], axis=0)
        hits += col_constant.sum()
    return hits / (n_trials * n_columns)


def selftest(n_columns: int = 64, alpha: float = 0.01, n_trials: int = 4000):
    """plan Sec 7 (B0b): empirical spurious-constant-column rate must be <= the predicted bound."""
    rng = np.random.default_rng(42)
    m = m_min(n_columns, alpha)
    print(f"n_columns={n_columns}  alpha={alpha}  -> M_min={m}")

    empirical_rate = spurious_constant_column_rate(n_columns, m, n_trials, rng)
    per_column_theory = 2.0 ** (-(m - 1))
    print(
        f"empirical spurious-column rate at M_min frames: {empirical_rate:.5f} "
        f"(theory: {per_column_theory:.5f})"
    )
    assert empirical_rate <= per_column_theory * 3, (
        "empirical spurious rate far exceeds theoretical bound -- evidence budget formula is wrong"
    )

    fewer = spurious_constant_column_rate(n_columns, max(m - 3, 2), n_trials, rng)
    assert fewer > empirical_rate, "spurious rate should decrease as frame count increases"
    print(f"rate at M_min-3 frames: {fewer:.5f} (higher, as expected)")
    print("PASSED: empirical spurious-field rate tracks the M_min bound.")


def demo():
    rng = np.random.default_rng(0)
    m = m_min(n_columns=64, alpha=0.01)
    assert m > 0
    meff = effective_frame_count(rng.uniform(0.1, 4.0, size=20))
    assert 0 <= meff <= 20
    print(f"demo() OK: M_min(64, 0.01)={m}, M_eff sample={meff:.2f}")


if __name__ == "__main__":
    selftest()
