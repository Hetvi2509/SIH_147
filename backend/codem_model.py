# ============================================================
# CoDeM -- joint AMC + demodulation model architecture.
#
# Verbatim port of D:/SIH-2026-PS147/notebooks/codem_model.py (the actual training source for
# codem_demodulation.pt, found after the fact -- an earlier version of this file was a best-effort
# shape-only reconstruction; this one matches the real forward pass, including:
#   - cond_encoder's real inputs: [class_probs, log2(sps_hat), conf_hat, snr_db/20, h_canon]
#   - the real [S]->[W] sync step: KAN/MLP residual sync head -> differentiable FFT-domain
#     fractional-delay + CFO derotation -> re-encode the corrected canonical signal
#   - quality_head reading the single pooled h_corrected vector, not per-token features
#   - LLR sign convention: llr > 0 => bit 1 (opposite of this repo's fec/demod convention of
#     llr < 0 => bit 1 -- codem_demod.py negates it at the boundary, see there)
# ============================================================
from __future__ import annotations

import math
import sys
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

from model_v2 import EncoderConfig, SRMambaAMCv2, repack_if_directory

# bit_stream_anaylsis/model/ has no __init__.py and its name collides with backend/model.py
# (v1's own top-level "model" module) depending on which dir sys.path finds first -- so this
# points straight at the model/ subdirectory instead of importing it as "model.efficient_kan".
_KAN_ROOT = Path(__file__).parent.parent / "bit_stream_anaylsis" / "model"
if str(_KAN_ROOT) not in sys.path:
    sys.path.insert(0, str(_KAN_ROOT))

from efficient_kan import EfficientKAN  # noqa: E402

MAX_BITS = 6  # 64QAM, the widest constellation in `classes`


class FiLM(nn.Module):
    """gamma * LayerNorm(x) + beta, projected from the conditioning vector c."""

    def __init__(self, cond_dim: int, d: int):
        super().__init__()
        self.norm = nn.LayerNorm(d)
        self.proj = nn.Linear(cond_dim, 2 * d)

    def forward(self, x, c):
        gamma, beta = self.proj(c).chunk(2, dim=-1)
        while gamma.dim() < x.dim():
            gamma = gamma.unsqueeze(1)
            beta = beta.unsqueeze(1)
        return gamma * self.norm(x) + beta


class ConditioningEncoder(nn.Module):
    """c = MLP([p(n_classes) || log2(sps_hat)(1) || conf(1) || snr_db(1) || H(d_model)]) -> (B, cond_dim)"""

    def __init__(self, n_classes: int, d_model: int, cond_dim: int):
        super().__init__()
        in_dim = n_classes + 1 + 1 + 1 + d_model
        self.net = nn.Sequential(
            nn.Linear(in_dim, cond_dim), nn.GELU(), nn.Linear(cond_dim, cond_dim),
        )

    def forward(self, p, log2_sps_hat, conf_hat, snr_db, H):
        x = torch.cat([p, log2_sps_hat.unsqueeze(-1), conf_hat.unsqueeze(-1),
                       (snr_db / 20).unsqueeze(-1), H], dim=-1)
        return self.net(x)


class AttentionPool(nn.Module):
    """Learned attention-weighted pool over the token axis, feeding [S]."""

    def __init__(self, d_model: int):
        super().__init__()
        self.query = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)
        self.attn = nn.MultiheadAttention(d_model, num_heads=4, batch_first=True)

    def forward(self, tokens):
        q = self.query.expand(tokens.shape[0], -1, -1)
        out, _ = self.attn(q, tokens, tokens, need_weights=False)
        return out.squeeze(1)


class SyncHead(nn.Module):
    """[S]: pool -> FiLM(c) -> KAN|MLP([d_model, 64, 3]) -> tanh -> rescale to physical units."""

    def __init__(self, d_model: int, cond_dim: int, kind: str = "kan",
                 kan_grid_size: int = 5, kan_spline_order: int = 3):
        super().__init__()
        self.kind = kind
        self.pool = AttentionPool(d_model)
        self.film = FiLM(cond_dim, d_model)
        if kind == "kan":
            self.net = EfficientKAN([d_model, 64, 3], grid_size=kan_grid_size, spline_order=kan_spline_order)
        elif kind == "mlp":
            self.net = nn.Sequential(nn.Linear(d_model, 64), nn.GELU(), nn.Linear(64, 3))
        else:
            raise ValueError(f"unknown SyncHead kind: {kind!r}")

    def forward(self, tokens, c, symbol_rate_hz):
        pooled = self.pool(tokens)
        pooled = self.film(pooled, c)
        raw = torch.tanh(self.net(pooled))
        d_tau = raw[:, 0] * 0.5
        d_f = raw[:, 1] * 0.1 * symbol_rate_hz
        d_phi = raw[:, 2] * math.pi
        return d_tau, d_f, d_phi


def differentiable_correction(z_canon: torch.Tensor, d_tau: torch.Tensor, d_f: torch.Tensor,
                               d_phi: torch.Tensor, sample_rate_hz: torch.Tensor,
                               canonical_sps: float) -> torch.Tensor:
    """[W]: fractional-delay resample (phase-ramp in freq domain) then CFO derotation + phase
    correction. z_canon: (B,2,N) -> same shape, corrected. No learnable parameters."""
    B, _, N = z_canon.shape
    z = torch.complex(z_canon[:, 0], z_canon[:, 1])

    delay_samples = d_tau * canonical_sps
    freqs = torch.fft.fftfreq(N, device=z.device).unsqueeze(0)
    Z = torch.fft.fft(z, dim=-1)
    phase_ramp = torch.exp(-1j * 2 * math.pi * freqs * delay_samples.unsqueeze(-1))
    z = torch.fft.ifft(Z * phase_ramp, dim=-1)

    t = torch.arange(N, device=z.device, dtype=torch.float32).unsqueeze(0) / sample_rate_hz.unsqueeze(-1)
    derotate = torch.exp(-1j * (2 * math.pi * d_f.unsqueeze(-1) * t + d_phi.unsqueeze(-1)))
    z = z * derotate

    return torch.stack([z.real, z.imag], dim=1).float()


class SymbolAligner(nn.Module):
    """[M]: stride-based grouping of patch tokens into one d_model feature per symbol."""

    def __init__(self, d_model: int, patches_per_symbol: int):
        super().__init__()
        self.patches_per_symbol = max(1, patches_per_symbol)
        self.reduce = nn.Linear(d_model * self.patches_per_symbol, d_model)

    def forward(self, tokens):
        B, L, D = tokens.shape
        S = L // self.patches_per_symbol
        usable = S * self.patches_per_symbol
        grouped = tokens[:, :usable].reshape(B, S, self.patches_per_symbol * D)
        return self.reduce(grouped)


class LLRHead(nn.Module):
    """[R]: FiLM(c) -> Linear(d_model,128) -> GELU -> Linear(128, MAX_BITS). Unbounded output.
    Convention: llr > 0 => bit 1 (see codem_loss's `hard_bits = (llr > 0)` in the training source)."""

    def __init__(self, d_model: int, cond_dim: int, max_bits: int):
        super().__init__()
        self.film = FiLM(cond_dim, d_model)
        self.net = nn.Sequential(nn.Linear(d_model, 128), nn.GELU(), nn.Linear(128, max_bits))

    def forward(self, symbol_features, c):
        x = self.film(symbol_features, c)
        return self.net(x)


class QualityHead(nn.Module):
    """[Q]: FiLM(c) -> Linear(256,64) -> ReLU -> Linear(64,3) = [EVM_proxy, sync_lock, conf].
    Reads the single pooled h_corrected vector (B, d_model), not per-symbol features."""

    def __init__(self, d_model: int, cond_dim: int):
        super().__init__()
        self.film = FiLM(cond_dim, d_model)
        self.net = nn.Sequential(nn.Linear(d_model, 64), nn.ReLU(), nn.Linear(64, 3))

    def forward(self, pooled, c):
        return self.net(self.film(pooled, c))


@dataclass
class CoDeMConfig(EncoderConfig):
    codem_cond_dim: int = 128
    use_kan_sync: bool = True
    use_kan_refiner: bool = False  # not present in this checkpoint (RefinerHead omitted below)


class CoDeM(nn.Module):
    """Wires [C][S][W][M][R][Q] around a frozen `SRMambaAMCv2` encoder. `class_bit_mask`
    (n_classes, MAX_BITS) and `open_set_threshold` are supplied by the loader from the
    checkpoint's `class_bits` / `open_set_threshold` metadata (not part of the state_dict --
    the training source built the mask as a plain module-level tensor, not a submodule buffer)."""

    def __init__(self, cfg: CoDeMConfig, amc: SRMambaAMCv2, n_classes: int,
                 class_bit_mask: torch.Tensor, open_set_threshold: float):
        super().__init__()
        self.cfg = cfg
        self.amc = amc
        self.register_buffer("class_bit_mask", class_bit_mask, persistent=False)
        self.open_set_threshold = open_set_threshold
        d = cfg.d_model
        patches_per_symbol = max(1, round(cfg.canonical_sps / cfg.patch_size))

        self.cond_encoder = ConditioningEncoder(n_classes, d, cfg.codem_cond_dim)
        self.sync_head = SyncHead(d, cfg.codem_cond_dim, kind="kan" if cfg.use_kan_sync else "mlp")
        self.reencode_film = FiLM(cfg.codem_cond_dim, d)
        self.symbol_aligner = SymbolAligner(d, patches_per_symbol)
        self.llr_head = LLRHead(d, cfg.codem_cond_dim, MAX_BITS)
        self.quality_head = QualityHead(d, cfg.codem_cond_dim)

    def forward(self, canon, raw, analytic, sps_hat, conf_hat, symbol_rate_hz, sample_rate_hz):
        with torch.no_grad():
            out = self.amc(raw, canon, analytic, sps_hat, conf_hat)
            p = F.softmax(out["logits"], dim=-1)
            h_canon, tokens_canon = out["h_canon"], out["tokens_canon"]
            recon_err = out["recon_err"]

        log2_sps_hat = torch.log2(sps_hat.clamp(min=1e-3))
        snr_db_blind = analytic[:, -1]  # blind M2M4 SNR estimate, analytic feature 12
        open_set_pass = recon_err <= self.open_set_threshold

        c = self.cond_encoder(p, log2_sps_hat, conf_hat, snr_db_blind, h_canon)

        d_tau, d_f, d_phi = self.sync_head(tokens_canon, c, symbol_rate_hz)
        canon_corrected = differentiable_correction(
            canon, d_tau, d_f, d_phi, sample_rate_hz, self.cfg.canonical_sps)

        with torch.no_grad():
            h_corrected, tokens_corrected = self.amc.encoder(canon_corrected, sps_hat, conf_hat)
        tokens_corrected = self.reencode_film(tokens_corrected, c)

        symbol_feats = self.symbol_aligner(tokens_corrected)
        llr = self.llr_head(symbol_feats, c)

        pred_class = p.argmax(-1)
        bit_mask_pred = self.class_bit_mask[pred_class].unsqueeze(1).expand(-1, llr.shape[1], -1)
        llr = llr * bit_mask_pred

        quality = self.quality_head(h_corrected, c)

        return {
            "p": p, "d_tau": d_tau, "d_f": d_f, "d_phi": d_phi,
            "llr": llr, "quality": quality,
            "open_set_pass": open_set_pass, "recon_err": recon_err,
            "pred_class": pred_class,
        }


def load_codem(checkpoint_path: str, device: str = "cpu"):
    """Loads codem_demodulation.pt strictly. Returns (model, classes, class_bits,
    open_set_threshold). model is frozen + eval."""
    ckpt = torch.load(repack_if_directory(checkpoint_path), map_location=device, weights_only=False)

    ck_cfg = ckpt.get("config", {})
    cfg = CoDeMConfig(**{k: v for k, v in ck_cfg.items() if k in CoDeMConfig.__dataclass_fields__})

    classes = list(ckpt["classes"])
    class_bits = dict(ckpt["class_bits"])
    open_set_threshold = float(ckpt.get("open_set_threshold", 0.5))

    class_bit_mask = torch.zeros(len(classes), MAX_BITS)
    for i, cls in enumerate(classes):
        n = class_bits.get(cls, 0)
        class_bit_mask[i, :n] = 1.0

    # codem_state's "amc.*" keys are the same frozen encoder weights as amc_state (saved
    # twice by the training script) -- one strict load of codem_state onto a freshly
    # constructed CoDeM(amc=<uninitialized SRMambaAMCv2>) populates both.
    amc = SRMambaAMCv2(cfg, n_classes=len(classes)).to(device)
    model = CoDeM(cfg, amc, len(classes), class_bit_mask, open_set_threshold).to(device)
    model.load_state_dict(ckpt["codem_state"], strict=True)
    for p in model.parameters():
        p.requires_grad_(False)
    model.eval()

    return model, classes, class_bits, open_set_threshold
