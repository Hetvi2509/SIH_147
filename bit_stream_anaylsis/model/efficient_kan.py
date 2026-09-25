"""Efficient KAN (Kolmogorov-Arnold Network) layer.

Vanilla KAN evaluates learnable B-spline activations on every edge, which is
numerically unstable and slow. "Efficient KAN" (the variant that actually
works, per the ablation in arXiv:2411.14904 Table III: vanilla KAN F1 0.30 vs
Efficient KAN F1 0.69-0.70, competitive with MLP's 0.62-0.64) reformulates the
spline evaluation as a linear combination of fixed B-spline basis functions
plus a residual base-activation path, so it is a single batched matmul instead
of per-edge symbolic spline evaluation.

Reference: https://github.com/Blealtan/efficient-kan (the standard reference
implementation this follows), and the config used in arXiv:2411.14904's own
comparison: grid_size=5, spline_order=3.

Used ONLY as the final classification head (see heads.py), not in the encoder
or decoder -- per the plan's Sec 4.2(i) rationale: KAN has documented reduced
effectiveness on noisy inputs (arXiv:2411.14904, Sec II), so it must only see
already-denoised, already-fused features, never raw IQ.
"""
import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class EfficientKANLinear(nn.Module):
    """One KAN layer: din -> dout, replacing one nn.Linear + activation.

    Output = spline_term(x) + base_term(x), where:
      - base_term is a standard linear layer on top of a fixed activation
        (silu), giving the layer a stable "MLP-like" fallback path.
      - spline_term is a linear combination of learnable coefficients over a
        fixed B-spline basis evaluated at each input coordinate -- this is
        where the actual nonlinear, edge-wise expressivity of KAN lives.
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        grid_size: int = 5,
        spline_order: int = 3,
        scale_noise: float = 0.1,
        scale_base: float = 1.0,
        scale_spline: float = 1.0,
        grid_range: tuple[float, float] = (-1.0, 1.0),
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.grid_size = grid_size
        self.spline_order = spline_order

        h = (grid_range[1] - grid_range[0]) / grid_size
        grid = (
            torch.arange(-spline_order, grid_size + spline_order + 1) * h
            + grid_range[0]
        ).expand(in_features, -1).contiguous()
        self.register_buffer("grid", grid)  # (in_features, grid_size + 2*spline_order + 1)

        self.base_weight = nn.Parameter(torch.empty(out_features, in_features))
        self.spline_weight = nn.Parameter(
            torch.empty(out_features, in_features, grid_size + spline_order)
        )

        self.scale_noise = scale_noise
        self.scale_base = scale_base
        self.scale_spline = scale_spline

        self.reset_parameters()

    def reset_parameters(self):
        nn.init.kaiming_uniform_(self.base_weight, a=math.sqrt(5) * self.scale_base)
        with torch.no_grad():
            # Small random init scaled down, matching the reference Efficient-KAN
            # implementation's noise magnitude -- simpler and numerically safer
            # than fitting a least-squares curve through random noise.
            std = self.scale_noise / math.sqrt(self.in_features)
            self.spline_weight.data.normal_(mean=0.0, std=std).mul_(self.scale_spline)

    def _b_splines(self, x: torch.Tensor) -> torch.Tensor:
        """x: (batch, in_features) -> (batch, in_features, grid_size + spline_order)."""
        grid = self.grid  # (in_features, n_knots)
        x = x.unsqueeze(-1)
        bases = ((x >= grid[:, :-1]) & (x < grid[:, 1:])).to(x.dtype)
        for k in range(1, self.spline_order + 1):
            left = (x - grid[:, : -(k + 1)]) / (grid[:, k:-1] - grid[:, : -(k + 1)])
            right = (grid[:, k + 1 :] - x) / (grid[:, k + 1 :] - grid[:, 1:-k])
            bases = left * bases[:, :, :-1] + right * bases[:, :, 1:]
        return bases.contiguous()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        base_out = F.linear(F.silu(x), self.base_weight)
        splines = self._b_splines(x)  # (batch, in_features, coeff)
        spline_out = torch.einsum(
            "bic,oic->bo", splines, self.spline_weight
        )
        return base_out + spline_out


class EfficientKAN(nn.Module):
    """Stack of EfficientKANLinear layers -- a drop-in MLP replacement.

    Config matches the arXiv:2411.14904 comparison that showed Efficient KAN
    competitive with MLP (F1 0.69-0.70 vs 0.62-0.64): grid_size=5. Depth/width
    kept small (2 layers) because this sits only at the classification head
    (Sec 4.2(i)) on a 256-dim already-fused, already-denoised feature vector --
    not a full sequence encoder.
    """

    def __init__(self, layer_sizes: list[int], grid_size: int = 5, spline_order: int = 3):
        super().__init__()
        self.layers = nn.ModuleList(
            [
                EfficientKANLinear(
                    layer_sizes[i], layer_sizes[i + 1],
                    grid_size=grid_size, spline_order=spline_order,
                )
                for i in range(len(layer_sizes) - 1)
            ]
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x)
        return x


def demo():
    """Smallest runnable self-check: shapes, gradient flow, no NaNs."""
    torch.manual_seed(0)
    kan = EfficientKAN([256, 64, 12], grid_size=5, spline_order=3)
    x = torch.randn(8, 256)
    out = kan(x)
    assert out.shape == (8, 12), f"bad output shape {out.shape}"
    assert torch.isfinite(out).all(), "non-finite output"

    loss = out.sum()
    loss.backward()
    n_grad = sum(p.grad is not None and torch.isfinite(p.grad).all() for p in kan.parameters())
    n_total = sum(1 for _ in kan.parameters())
    assert n_grad == n_total, f"gradient did not reach all params ({n_grad}/{n_total})"

    n_params = sum(p.numel() for p in kan.parameters())
    print(f"EfficientKAN([256,64,12]) OK: {n_params} params, output {out.shape}, "
          f"grads finite on {n_grad}/{n_total} tensors")


if __name__ == "__main__":
    demo()
