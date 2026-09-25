"""SIFT Component B -- the folded bit-reliability matrix + column statistics
(plan_bitstream_analysis.md Sec 4.3), plus the Tier 1 end-to-end pipeline (Sec 4.1, Sec 5).

Once soft_correlate proposes a period P, fold the stream into an (M, P) matrix -- M frames, P
bits each -- the representation BRFS-DL and EBPFI independently converged on (plan Sec 3.4),
with reliability as a second channel (the one thing neither paper had). Column statistics are
reliability-weighted versions of the 147.txt Sec 18 methods.

tier1_pipeline() is the PS-mandated deliverable (Sec 5, Sec 7 Phase B3): unknown period -> C_soft
scan -> fold -> column map -> CRC search, entirely training-free.
"""
from __future__ import annotations

import numpy as np

from .soft_correlate import detect_period
from .evidence_budget import m_min
from .crc_recover import recover_crc_params


def fold_stream(bits: np.ndarray, r: np.ndarray, period: int) -> tuple[np.ndarray, np.ndarray]:
    """(M, P) bit matrix in {-1,+1} and reliability matrix tanh(r/2) in [0,1]."""
    n_frames = len(bits) // period
    usable = n_frames * period
    bit_mat = bits[:usable].reshape(n_frames, period).astype(np.float32) * 2 - 1
    rel_mat = np.tanh(r[:usable].reshape(n_frames, period) / 2.0)
    return bit_mat, rel_mat


def weighted_column_entropy(bit_mat: np.ndarray, rel_mat: np.ndarray) -> np.ndarray:
    """Per-column reliability-weighted entropy of p=P(bit=1). Low entropy -> constant field
    (147.txt Sec 18 method 3, field stability)."""
    b01 = (bit_mat + 1) / 2
    w = rel_mat
    p = (w * b01).sum(0) / np.clip(w.sum(0), 1e-6, None)
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return -(p * np.log2(p) + (1 - p) * np.log2(1 - p))


def weighted_column_variance(bit_mat: np.ndarray, rel_mat: np.ndarray) -> np.ndarray:
    """147.txt Sec 18 methods 3/7: field stability, cross-frame comparison."""
    w = rel_mat
    mean = (w * bit_mat).sum(0) / np.clip(w.sum(0), 1e-6, None)
    return (w * (bit_mat - mean) ** 2).sum(0) / np.clip(w.sum(0), 1e-6, None)


def weighted_transition_rate(bit_mat: np.ndarray, rel_mat: np.ndarray) -> np.ndarray:
    """Down-column bit-flip rate between consecutive frames, reliability-weighted -- low bits of
    a counter toggle every frame, high bits rarely (147.txt Sec 18 method 5)."""
    flips = (bit_mat[1:] != bit_mat[:-1]).astype(np.float32)
    w = np.minimum(rel_mat[1:], rel_mat[:-1])
    return (w * flips).sum(0) / np.clip(w.sum(0), 1e-6, None)


def column_features(bit_mat: np.ndarray, rel_mat: np.ndarray) -> np.ndarray:
    """(P, 3) hand-computed statistics -- Branch 2 of the Sec 4.4 dual-branch tagger."""
    return np.stack(
        [
            weighted_column_entropy(bit_mat, rel_mat),
            weighted_column_variance(bit_mat, rel_mat),
            weighted_transition_rate(bit_mat, rel_mat),
        ],
        axis=1,
    )


def tier1_pipeline(
    bits: np.ndarray,
    r: np.ndarray,
    period_candidates: np.ndarray | None = None,
    alpha: float = 0.01,
    entropy_threshold: float = 0.3,
) -> dict:
    """The PS deliverable (plan Sec 5 Tier 1, Sec 7 Phase B3): unknown period -> C_soft scan
    (with the Bonferroni significance gate) -> fold -> column entropy map -> CRC search. No
    neural network. Returns a dict with status ACCEPT/REFUSE (plan Sec 4.6/4.7's refusal path)."""
    if period_candidates is None:
        period_candidates = np.arange(16, min(len(bits) // 3, 300))

    period_report = detect_period(bits, r, period_candidates, alpha=alpha)
    if period_report["status"] == "REFUSE":
        return period_report

    period = period_report["period"]
    n_frames = len(bits) // period
    m_needed = m_min(period, alpha)
    if n_frames < m_needed:
        return dict(
            status="REFUSE",
            reason=(
                f"insufficient evidence: {n_frames} frames observed, {m_needed} needed for a "
                f"header claim at alpha={alpha}"
            ),
        )

    bit_mat, rel_mat = fold_stream(bits, r, period)
    ent = weighted_column_entropy(bit_mat, rel_mat)
    constant_cols = np.where(ent < entropy_threshold)[0]

    # CRC-scope guess: trailing 16 columns as the CRC itself, payload scope starting AFTER the
    # leading run of constant columns (almost certainly a SYNC word, which standard CRC framing
    # excludes from its protected scope -- verified against recover_crc_params directly: including
    # the sync word in the payload scope made recovery fail 0/40 frames; excluding it recovered
    # CRC-16/CCITT-FALSE on 34/34 reliable frames). Still a heuristic, not a certainty -- a precise
    # scope needs the field tagger (Sec 4.4) or known frame layout; Tier 1 alone cannot always be
    # sure where a header ends and payload begins if the header itself isn't constant.
    crc_found = None
    leading_constant_run = 0
    for c in range(period):
        if c in constant_cols:
            leading_constant_run += 1
        else:
            break
    if period - leading_constant_run >= 16:
        crc_start = period - 16
        crc_found = recover_crc_params(
            bit_mat, rel_mat, leading_constant_run, crc_start, crc_start, period
        )

    return dict(
        status="ACCEPT",
        period=period,
        c_soft_margin=period_report["margin"],
        z_score=period_report["z_score"],
        n_frames=n_frames,
        m_min=m_needed,
        constant_columns=constant_cols.tolist(),
        crc=crc_found,
    )


def demo():
    from .soft_correlate import _generate_frame, _inject_residual_errors

    rng = np.random.default_rng(0)
    clean = np.concatenate([_generate_frame(rng) for _ in range(40)])
    noisy, r = _inject_residual_errors(clean, 1e-3, rng)
    report = tier1_pipeline(noisy, r)
    assert report["status"] == "ACCEPT" and report["period"] == 96, report
    print(f"demo() OK: Tier 1 recovered period={report['period']}, crc={report['crc']}")


if __name__ == "__main__":
    demo()
