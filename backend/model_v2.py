# ============================================================
# SR-Mamba AMC v2 -- model architecture.
# Copied from SIH-2026-PS147/notebooks/srmamba_amc_v2_encoder.py, the source file the
# srmamba_amc_v2_post_training checkpoint was trained against (FiLM-conditioned dual-view
# encoder + cross-attention analytic fusion). Trimmed of the __main__ self-check.
# ============================================================
from __future__ import annotations

import os
import zipfile
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

CLASS_NAMES = ["OOK", "PAM", "2FSK", "4FSK", "CPFSK", "GMSK", "BPSK", "QPSK",
               "8PSK", "16QAM", "64QAM", "AM", "FM", "NOISE"]


@dataclass
class EncoderConfig:
    window_len: int = 1024
    patch_size: int = 16
    canonical_sps: float = 8.0
    d_model: int = 256
    n_mamba_blocks: int = 4
    d_state: int = 16
    mamba_expand: int = 2
    n_transformer_blocks: int = 2
    n_heads: int = 4
    ffn_dim: int = 1024
    dropout: float = 0.15
    analytic_dim: int = 12


class SelectiveSSM(nn.Module):
    """Minimal pure-PyTorch selective state-space scan (Mamba-style), one direction."""

    def __init__(self, d_model: int, d_state: int = 16, expand: int = 2):
        super().__init__()
        self.d_inner = d_model * expand
        self.d_state = d_state
        self.in_proj = nn.Linear(d_model, self.d_inner)
        self.x_proj = nn.Linear(self.d_inner, d_state * 2 + 1)  # -> B, C, dt
        self.A_log = nn.Parameter(
            torch.log(torch.arange(1, d_state + 1, dtype=torch.float32)).repeat(self.d_inner, 1))
        self.D = nn.Parameter(torch.ones(self.d_inner))
        self.out_proj = nn.Linear(self.d_inner, d_model)

    def forward(self, x):  # x: (B, L, d_model)
        B_, L, _ = x.shape
        u = self.in_proj(x)
        proj = self.x_proj(u)
        Bc, Cc, dt = torch.split(proj, [self.d_state, self.d_state, 1], dim=-1)
        dt = F.softplus(dt).clamp(max=1.0)

        A = -torch.exp(self.A_log.clamp(max=5.0))
        h = torch.zeros(B_, self.d_inner, self.d_state, device=x.device, dtype=x.dtype)
        ys = []
        for t in range(L):
            dA = torch.exp((dt[:, t].unsqueeze(-1) * A).clamp(min=-20.0, max=0.0))
            dBu = (dt[:, t].unsqueeze(-1) * Bc[:, t].unsqueeze(1)) * u[:, t].unsqueeze(-1)
            h = dA * h + dBu
            h = torch.nan_to_num(h, nan=0.0, posinf=1e4, neginf=-1e4)
            ys.append((h * Cc[:, t].unsqueeze(1)).sum(-1))
        y = torch.stack(ys, dim=1) + u * self.D
        return self.out_proj(y)


class FiLMConditioner(nn.Module):
    """Shared MLP trunk + per-block linear heads. Input = (log2(sps_hat), conf_hat) from the
    BLIND rate probe -- never ground-truth sps."""

    def __init__(self, d_model: int, n_blocks: int, hidden: int = 64):
        super().__init__()
        self.trunk = nn.Sequential(nn.Linear(2, hidden), nn.GELU())
        self.heads = nn.ModuleList([nn.Linear(hidden, 2 * d_model) for _ in range(n_blocks)])
        self.d_model = d_model

    def forward(self, sps_hat, conf_hat):
        log2_sps = torch.log2(sps_hat.clamp(min=1e-3))
        h = self.trunk(torch.stack([log2_sps, conf_hat], dim=-1))
        return [head(h) for head in self.heads]


class BiMambaBlock(nn.Module):
    def __init__(self, d_model: int, d_state: int, expand: int, dropout: float):
        super().__init__()
        self.norm = nn.LayerNorm(d_model)
        self.conv = nn.Conv1d(d_model, d_model, kernel_size=4, padding=3, groups=d_model)
        self.gate = nn.Linear(d_model, d_model)
        self.fwd_ssm = SelectiveSSM(d_model, d_state, expand)
        self.bwd_ssm = SelectiveSSM(d_model, d_state, expand)
        self.merge = nn.Linear(2 * d_model, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, film_gamma_beta=None):
        residual = x
        h = self.norm(x)
        if film_gamma_beta is not None:
            gamma, beta = film_gamma_beta.chunk(2, dim=-1)
            h = gamma.unsqueeze(1) * h + beta.unsqueeze(1)
        h_conv = self.conv(h.transpose(1, 2))[:, :, :h.shape[1]].transpose(1, 2)
        h = h_conv * torch.sigmoid(self.gate(h))
        fwd = self.fwd_ssm(h)
        bwd = torch.flip(self.bwd_ssm(torch.flip(h, dims=[1])), dims=[1])
        merged = self.merge(torch.cat([fwd, bwd], dim=-1))
        return residual + self.dropout(merged)


class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, ffn_dim, dropout):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.norm2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, ffn_dim), nn.GELU(), nn.Dropout(dropout),
            nn.Linear(ffn_dim, d_model), nn.Dropout(dropout),
        )

    def forward(self, x):
        h = self.norm1(x)
        attn_out, _ = self.attn(h, h, h, need_weights=False)
        x = x + attn_out
        return x + self.ffn(self.norm2(x))


class SharedEncoder(nn.Module):
    """Checkpoint keys: patch_embed.*, pos_embed, film.*, mamba_blocks.N.*, transformer_blocks.N.*"""

    def __init__(self, cfg: EncoderConfig):
        super().__init__()
        n_patches = cfg.window_len // cfg.patch_size
        self.patch_embed = nn.Conv1d(2, cfg.d_model, kernel_size=cfg.patch_size, stride=cfg.patch_size)
        self.pos_embed = nn.Parameter(torch.randn(1, n_patches, cfg.d_model) * 0.02)
        self.film = FiLMConditioner(cfg.d_model, cfg.n_mamba_blocks)
        self.mamba_blocks = nn.ModuleList([
            BiMambaBlock(cfg.d_model, cfg.d_state, cfg.mamba_expand, cfg.dropout)
            for _ in range(cfg.n_mamba_blocks)
        ])
        self.transformer_blocks = nn.ModuleList([
            TransformerBlock(cfg.d_model, cfg.n_heads, cfg.ffn_dim, cfg.dropout)
            for _ in range(cfg.n_transformer_blocks)
        ])

    def forward(self, x, sps_hat, conf_hat):  # x: (B, 2, window_len)
        tokens = self.patch_embed(x).transpose(1, 2) + self.pos_embed
        for blk, fp in zip(self.mamba_blocks, self.film(sps_hat, conf_hat)):
            tokens = blk(tokens, film_gamma_beta=fp)
        for blk in self.transformer_blocks:
            tokens = blk(tokens)
        return tokens.mean(dim=1), tokens


class AnalyticBranch(nn.Module):
    def __init__(self, in_dim: int, d_model: int, dropout: float):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(in_dim, d_model), nn.GELU(), nn.Dropout(dropout))

    def forward(self, feats):
        return self.proj(feats)


class CrossAttentionFusion(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dropout: float):
        super().__init__()
        self.attn = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.norm = nn.LayerNorm(2 * d_model)
        self.fuse = nn.Sequential(nn.Linear(2 * d_model, d_model), nn.GELU(), nn.Dropout(dropout))

    def forward(self, neural_repr, analytic_repr):
        attended, attn_weights = self.attn(
            neural_repr.unsqueeze(1), analytic_repr.unsqueeze(1), analytic_repr.unsqueeze(1),
            need_weights=True)
        fused = self.norm(torch.cat([neural_repr, attended.squeeze(1)], dim=-1))
        return self.fuse(fused), attn_weights


class ReconstructionDecoder(nn.Module):
    def __init__(self, d_model: int, window_len: int, dropout: float):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, d_model), nn.GELU(), nn.Dropout(dropout),
            nn.Linear(d_model, 2 * window_len),
        )
        self.window_len = window_len

    def forward(self, h):
        return self.net(h).view(-1, 2, self.window_len)


class SRMambaAMCv2(nn.Module):
    def __init__(self, cfg: EncoderConfig, n_classes: int = len(CLASS_NAMES)):
        super().__init__()
        self.cfg = cfg
        self.encoder = SharedEncoder(cfg)
        self.analytic_branch = AnalyticBranch(cfg.analytic_dim, cfg.d_model, cfg.dropout)
        self.fusion = CrossAttentionFusion(cfg.d_model, cfg.n_heads, cfg.dropout)
        self.classifier = nn.Linear(cfg.d_model, n_classes)
        self.raw_classifier = nn.Linear(cfg.d_model, n_classes)
        self.canon_classifier = nn.Linear(cfg.d_model, n_classes)
        self.sps_head = nn.Linear(cfg.d_model, 2)
        self.decoder = ReconstructionDecoder(cfg.d_model, cfg.window_len, cfg.dropout)

    def forward(self, raw, canon, analytic, sps_hat, conf_hat):
        h_raw, tokens_raw = self.encoder(raw, sps_hat, conf_hat)
        h_canon, tokens_canon = self.encoder(canon, sps_hat, conf_hat)

        neural_repr = (h_raw + h_canon) / 2
        fused, attn_weights = self.fusion(neural_repr, self.analytic_branch(analytic))

        sps_out = self.sps_head(fused)
        recon = self.decoder(fused)
        return {
            "logits": self.classifier(fused),
            "raw_logits": self.raw_classifier(h_raw),
            "canon_logits": self.canon_classifier(h_canon),
            "sps_mu": sps_out[:, 0], "sps_logvar": sps_out[:, 1],
            "recon": recon,
            "recon_err": F.mse_loss(recon, raw, reduction="none").mean(dim=(1, 2)),
            "fused": fused, "tokens_canon": tokens_canon, "tokens_raw": tokens_raw,
            "h_canon": h_canon, "attn_weights": attn_weights,
        }


def repack_if_directory(path: str, out_path: str | None = None) -> str:
    """A torch.save archive can land on disk pre-extracted (data.pkl + data/0..N + version/
    byteorder, e.g. after a zip auto-extract) -- torch.load cannot open a directory, so re-zip it
    into the archive layout it expects. Returns a loadable path."""
    if not os.path.isdir(path):
        return path
    if out_path is None:
        out_path = path.rstrip("/\\") + ".pt"
    if not os.path.exists(out_path):
        base = os.path.basename(path.rstrip("/\\"))
        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_STORED) as zf:
            for root, _, files in os.walk(path):
                for fname in files:
                    full = os.path.join(root, fname)
                    zf.write(full, f"{base}/{os.path.relpath(full, path)}".replace(os.sep, "/"))
    return out_path


def load_amc_v2(checkpoint_path: str, device="cpu", freeze: bool = True):
    """Load the v2 checkpoint into SRMambaAMCv2, strict. Accepts a .pt file or the
    unpacked-directory form. Returns (model, ckpt); frozen + eval by default."""
    ckpt = torch.load(repack_if_directory(checkpoint_path), map_location=device, weights_only=False)

    ck_cfg = ckpt.get("config", {})
    cfg = EncoderConfig(**{k: v for k, v in ck_cfg.items()
                            if k in EncoderConfig.__dataclass_fields__})

    classes = list(ckpt.get("classes", CLASS_NAMES))
    model = SRMambaAMCv2(cfg, n_classes=len(classes)).to(device)
    model.load_state_dict(ckpt["model_state"], strict=True)

    if freeze:
        for p in model.parameters():
            p.requires_grad_(False)
        model.eval()

    return model, ckpt, classes
