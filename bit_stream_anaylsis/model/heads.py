"""Output heads for SR-MAMBA-AMC (plan Sec 4.2(i)).

Four heads read from the fused 256-dim representation produced by the
cross-attention fusion (Sec 4.2(h)):
  - classifier   : 12-way modulation class     (MLP or KAN, see below)
  - uncertainty  : log sigma^2, heteroscedastic confidence
  - sps regressor: mean, log-variance of log2(sps)
  - (calibration is a separate post-hoc module, see calibration.py)

Classifier head: MLP by default, EfficientKAN as an explicit alternative
(plan Sec 4.2(i)-KAN / Option A). Both share the same in/out contract so the
ablation ("MLP head" vs "KAN head") is a one-line config change, not two
separate models to maintain.

Why the KAN goes here and nowhere else: by this point the signal has already
passed through 8 Bi-Mamba blocks + 2 Transformer blocks + cross-attention
fusion -- all denoising, sequence-modelling work is done. The head sees a
clean, already-disentangled 256-dim vector, never raw noisy IQ. This sidesteps
KAN's documented "reduced effectiveness on functions with noise"
(arXiv:2411.14904) by construction: the noise has already been dealt with
upstream. Using KAN as a full sequence encoder or inside the decoder (which
reconstructs from noisy/masked input) would hit exactly that weakness --
hence KAN is a head-only component in this design (see plan Sec 4.2(i)-KAN).
"""
import torch
import torch.nn as nn

from src.models.efficient_kan import EfficientKAN


class ClassifierHead(nn.Module):
    """12-way modulation classifier, MLP or KAN backend.

    kind="mlp" (default): Linear(d_in, hidden) -> ReLU -> Dropout -> Linear(hidden, n_classes).
    kind="kan": EfficientKAN([d_in, hidden, n_classes]), grid_size=5 (the config
      arXiv:2411.14904 showed competitive with MLP: F1 0.69-0.70 vs 0.62-0.64).
    """

    def __init__(
        self,
        d_in: int = 256,
        hidden: int = 64,
        n_classes: int = 12,
        kind: str = "mlp",
        dropout: float = 0.1,
        kan_grid_size: int = 5,
        kan_spline_order: int = 3,
    ):
        super().__init__()
        self.kind = kind
        if kind == "mlp":
            self.net = nn.Sequential(
                nn.Linear(d_in, hidden),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden, n_classes),
            )
        elif kind == "kan":
            self.net = EfficientKAN(
                [d_in, hidden, n_classes],
                grid_size=kan_grid_size,
                spline_order=kan_spline_order,
            )
        else:
            raise ValueError(f"unknown ClassifierHead kind: {kind!r} (expected 'mlp' or 'kan')")

    def forward(self, fused: torch.Tensor) -> torch.Tensor:
        """fused: (batch, d_in) -> logits: (batch, n_classes)."""
        return self.net(fused)


class UncertaintyHead(nn.Module):
    """Heteroscedastic log-variance head. Kept as a plain MLP: it is a scalar
    regression target with no noise-robustness motivation for KAN, and it
    must be cheap since it runs alongside the classifier every forward pass.
    """

    def __init__(self, d_in: int = 256, hidden: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_in, hidden), nn.ReLU(), nn.Linear(hidden, 1),
        )

    def forward(self, fused: torch.Tensor) -> torch.Tensor:
        return self.net(fused).squeeze(-1)  # (batch,)


class SpsHead(nn.Module):
    """sps regressor: predicts (mean, log-variance) of log2(sps).

    Plain MLP by default. arXiv:2411.14904's own recommendation is KAN as a
    head for smooth, low-dimensional function approximation -- sps regression
    (log2(sps) from a 256-dim already-fused vector) is a better-motivated KAN
    candidate than 12-way classification, since it is closer to the smooth
    scientific-regression regime KAN was designed for (Kolmogorov-Arnold
    representation theorem) rather than a noisy discrete classification
    boundary. Exposed here as an option for the same reason as the classifier
    head, but MLP remains the default until an ablation says otherwise
    (plan Sec 7.1, to be added as a follow-up row alongside the classifier
    KAN-vs-MLP ablation).
    """

    def __init__(self, d_in: int = 256, hidden: int = 32, kind: str = "mlp",
                 kan_grid_size: int = 5, kan_spline_order: int = 3):
        super().__init__()
        self.kind = kind
        if kind == "mlp":
            self.net = nn.Sequential(
                nn.Linear(d_in, hidden), nn.ReLU(), nn.Linear(hidden, 2),
            )
        elif kind == "kan":
            self.net = EfficientKAN(
                [d_in, hidden, 2], grid_size=kan_grid_size, spline_order=kan_spline_order,
            )
        else:
            raise ValueError(f"unknown SpsHead kind: {kind!r} (expected 'mlp' or 'kan')")

    def forward(self, fused: torch.Tensor) -> torch.Tensor:
        """Returns (batch, 2): [:, 0] = mean log2(sps), [:, 1] = log-variance."""
        out = self.net(fused)
        return out


def demo():
    """Smallest runnable self-check for both heads, both backends."""
    torch.manual_seed(0)
    fused = torch.randn(4, 256)

    for kind in ("mlp", "kan"):
        clf = ClassifierHead(kind=kind)
        logits = clf(fused)
        assert logits.shape == (4, 12), f"{kind} classifier bad shape {logits.shape}"
        assert torch.isfinite(logits).all(), f"{kind} classifier non-finite output"

        sps = SpsHead(kind=kind)
        sps_out = sps(fused)
        assert sps_out.shape == (4, 2), f"{kind} sps head bad shape {sps_out.shape}"
        assert torch.isfinite(sps_out).all(), f"{kind} sps head non-finite output"

        n_params = sum(p.numel() for p in clf.parameters())
        print(f"ClassifierHead(kind={kind!r}): {n_params} params, logits {logits.shape} OK")

    unc = UncertaintyHead()
    logvar = unc(fused)
    assert logvar.shape == (4,), f"uncertainty head bad shape {logvar.shape}"
    print(f"UncertaintyHead: logvar {logvar.shape} OK")


if __name__ == "__main__":
    demo()
