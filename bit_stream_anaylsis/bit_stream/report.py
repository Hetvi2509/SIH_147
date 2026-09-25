"""Frame map + field regions + evidence report (plan_bitstream_analysis.md Sec 11.1), wiring
Tier 1 (folding.py's tier1_pipeline, training-free) and Tier 2 (tagger.py, the learned field
typer) into the four-independent-agreement-signal design (Sec 4.6) and the honest reporting
rules (Sec 8.4): state the Tier for every result, report the evidence budget alongside every
field claim, report CRC as verified parameters or "not found," never as a confidence score.
"""
from __future__ import annotations

import numpy as np

from .folding import tier1_pipeline, fold_stream


def analyze(
    bits: np.ndarray,
    r: np.ndarray,
    tagger_checkpoint: str | None = None,
    period_candidates: np.ndarray | None = None,
    alpha: float = 0.01,
) -> dict:
    """Full SIFT analysis: Tier 1 always runs (no neural network, plan Sec 5). If
    tagger_checkpoint is given, Tier 2 field typing runs on top of Tier 1's recovered period and
    is reported as a SEPARATE, secondary result -- never conflated with Tier 1's higher-confidence
    output (plan Sec 8.4: "State the Tier for every result").
    """
    tier1 = tier1_pipeline(bits, r, period_candidates=period_candidates, alpha=alpha)

    result = dict(tier1=tier1, tier2=None)
    if tier1["status"] != "ACCEPT":
        return result

    if tagger_checkpoint is not None:
        from .tagger import load_tagger, tag_stream

        model, ckpt = load_tagger(tagger_checkpoint)
        bit_mat, rel_mat = fold_stream(bits, r, tier1["period"])
        tags = tag_stream(model, bit_mat, rel_mat)
        result["tier2"] = dict(
            tags=tags,
            checkpoint_test_macro_f1=ckpt.get("test_macro_f1"),
            checkpoint_train_families=ckpt.get("train_family_names"),
            note=(
                "Tier 2 field typing is a proposal, not a decision (plan Sec 4.4) -- it never "
                "asserts a CRC; tier1['crc'] (the algebraic verifier) is the only component that "
                "can prove one. Reported here as a secondary result per plan Sec 8.4."
            ),
        )

    return result


def format_report(result: dict) -> str:
    """Human-readable report following plan Sec 8.4's rules: state the Tier, report the evidence
    budget, report CRC as verified parameters or 'not found' -- never as a confidence score."""
    tier1 = result["tier1"]
    lines = []

    if tier1["status"] == "REFUSE":
        lines.append(f"REFUSED: {tier1['reason']}")
        return "\n".join(lines)

    lines.append("TIER 1 (training-free, high confidence):")
    lines.append(f"  period recovered      = {tier1['period']} bits")
    lines.append(f"  frames available       = {tier1['n_frames']} (M_min={tier1['m_min']})")
    lines.append(f"  C_soft significance    = z={tier1['z_score']:.2f}, margin={tier1['c_soft_margin']:.4f}")
    lines.append(f"  constant columns       = {len(tier1['constant_columns'])} of {tier1['period']}")

    if tier1["crc"]:
        name, pass_frac, n_pass, n_reliable, n_frames = tier1["crc"]
        lines.append(
            f"  CRC recovered           = {name}, verified on {n_pass}/{n_reliable} reliable "
            f"frames ({n_frames} total)"
        )
    else:
        lines.append("  CRC recovered           = not found")

    if result.get("tier2"):
        lines.append("\nTIER 2 (learned field typing, medium confidence, secondary result):")
        lines.append(f"  tagger test macro F1    = {result['tier2']['checkpoint_test_macro_f1']:.4f}")
        lines.append(f"  per-column tags         = {' '.join(result['tier2']['tags'][:20])}"
                      + (" ..." if len(result['tier2']['tags']) > 20 else ""))

    return "\n".join(lines)


def demo():
    from .soft_correlate import _generate_frame, _inject_residual_errors

    rng = np.random.default_rng(0)
    clean = np.concatenate([_generate_frame(rng) for _ in range(40)])
    noisy, r = _inject_residual_errors(clean, 1e-3, rng)

    result = analyze(noisy, r)
    print(format_report(result))
    assert result["tier1"]["status"] == "ACCEPT"


if __name__ == "__main__":
    demo()
