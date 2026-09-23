# ============================================================
# SR-Mamba Official â€” Model Architecture
# Reverse-engineered from sr_mamba_official_best.pt weight keys.
# Pure-Python Mamba SSM (no mamba_ssm package required).
# ============================================================

import math
import torch
import torch.nn as nn
import torch.nn.functional as F

# -------------------------------------------------------------------
# Pure-Python Mamba SSM block
# Parameter layout matching the official checkpoint:
#   A_log, D, in_proj, conv1d, x_proj, dt_proj, out_proj
# -------------------------------------------------------------------

class MambaBlock(nn.Module):
    def __init__(self, d, d_state=16, expand=2, conv_kernel=4):
        super().__init__()
        self.d_inner = expand * d
        self.d_state = d_state
        dt_rank = math.ceil(d / 16)
        self.dt_rank = dt_rank
        self.A_log    = nn.Parameter(torch.zeros(self.d_inner, d_state))
        self.D        = nn.Parameter(torch.ones(self.d_inner))
        self.in_proj  = nn.Linear(d, 2 * self.d_inner, bias=False)
        self.conv1d   = nn.Conv1d(self.d_inner, self.d_inner, conv_kernel,
                                  padding=conv_kernel - 1, groups=self.d_inner)
        self.x_proj   = nn.Linear(self.d_inner, dt_rank + 2 * d_state, bias=False)
        self.dt_proj  = nn.Linear(dt_rank, self.d_inner)
        self.out_proj = nn.Linear(self.d_inner, d, bias=False)

    def forward(self, x):
        B, L, _ = x.shape
        xz = self.in_proj(x)
        x_part, z = xz.chunk(2, dim=-1)
        x_conv = self.conv1d(x_part.transpose(1, 2))[..., :L].transpose(1, 2)
        x_conv = F.silu(x_conv)
        xp = self.x_proj(x_conv)
        dt, B_ssm, C_ssm = xp.split([self.dt_rank, self.d_state, self.d_state], dim=-1)
        dt = F.softplus(self.dt_proj(dt))
        A  = -torch.exp(self.A_log)
        dA = torch.exp(dt.unsqueeze(-1) * A.unsqueeze(0).unsqueeze(0))
        dB = dt.unsqueeze(-1) * B_ssm.unsqueeze(2)
        h  = torch.zeros(B, self.d_inner, self.d_state, device=x.device, dtype=x.dtype)
        ys = []
        for i in range(L):
            h = dA[:, i] * h + dB[:, i] * x_conv[:, i].unsqueeze(-1)
            ys.append((h * C_ssm[:, i].unsqueeze(1)).sum(-1))
        y = torch.stack(ys, dim=1)
        y = y + x_conv * self.D.unsqueeze(0).unsqueeze(0)
        y = y * F.silu(z)
        return self.out_proj(y)


class BiMambaBlock(nn.Module):
    def __init__(self, d, d_state=16, expand=2, conv_kernel=4, dropout=0.2):
        super().__init__()
        self.norm  = nn.LayerNorm(d)
        self.conv  = nn.Conv1d(d, d, conv_kernel, padding=conv_kernel - 1, groups=d)
        self.gate  = nn.Linear(d, d)
        self.fwd   = MambaBlock(d, d_state, expand, conv_kernel)
        self.bwd   = MambaBlock(d, d_state, expand, conv_kernel)
        self.merge = nn.Linear(2 * d, d)
        self.drop  = nn.Dropout(dropout)

    def forward(self, x):
        h = self.norm(x)
        g = torch.sigmoid(self.gate(h))
        c = self.conv(h.transpose(1, 2))[..., :h.size(1)].transpose(1, 2)
        h = g * c
        f = self.fwd(h)
        b = torch.flip(self.bwd(torch.flip(h, [1])), [1])
        return x + self.drop(self.merge(torch.cat([f, b], dim=-1)))


class FeatureTokenizer(nn.Module):
    """
    Splits the 12-dim feature vector into 3 sub-groups and projects each to d.
    Matches checkpoint layout:
      tokens.c : LayerNorm(9)  -> Linear(9->d)   (9 cumulant features)
      tokens.h : LayerNorm(2)  -> Linear(2->d)   (2 Haar features: indices 9,10)
      tokens.s : LayerNorm(1)  -> Linear(1->d)   (1 SNR feature:   index 11)
    """
    def __init__(self, d):
        super().__init__()
        self.c = nn.Sequential(nn.LayerNorm(9), nn.Linear(9, d), nn.GELU())
        self.h = nn.Sequential(nn.LayerNorm(2), nn.Linear(2, d), nn.GELU())
        self.s = nn.Sequential(nn.LayerNorm(1), nn.Linear(1, d), nn.GELU())

    def forward(self, features):
        c_tok = self.c(features[:, :9])
        h_tok = self.h(features[:, 9:11])
        s_tok = self.s(features[:, 11:])
        return torch.stack((c_tok, h_tok, s_tok), dim=1)


# -------------------------------------------------------------------
# Main model â€” matches sr_mamba_official_best.pt exactly
# -------------------------------------------------------------------

class SRMambaOfficial(nn.Module):
    """
    SR-Mamba Official Automatic Modulation Classifier (14 classes).
    forward(raw, canonical, features) -> dict with 'logits' key.
    """

    def __init__(
        self,
        num_classes:        int   = 14,
        window_size:        int   = 1024,
        patch_size:         int   = 8,
        embedding_dim:      int   = 256,
        mamba_blocks:       int   = 8,
        d_state:            int   = 16,
        conv_kernel:        int   = 4,
        mamba_expand:       int   = 2,
        transformer_blocks: int   = 2,
        attention_heads:    int   = 4,
        dropout:            float = 0.2,
    ):
        super().__init__()
        d = embedding_dim
        t = window_size // patch_size

        self.patch = nn.Conv1d(2, d, patch_size, stride=patch_size)
        self.pos   = nn.Parameter(torch.zeros(1, t, d))

        self.blocks = nn.ModuleList([
            BiMambaBlock(d, d_state, mamba_expand, conv_kernel, dropout)
            for _ in range(mamba_blocks)
        ])

        # denoise: LayerNorm -> Linear -> GELU -> Dropout -> Linear
        # (indices 0,1,2,3,4 â€” GELU and Dropout have no params, hence gap at 2,3,4->4)
        self.denoise = nn.Sequential(
            nn.LayerNorm(d),
            nn.Linear(d, d),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d, d),
        )
        layer = nn.TransformerEncoderLayer(
            d, attention_heads, 4 * d, dropout,
            batch_first=True, norm_first=True,
        )
        self.transformer = nn.TransformerEncoder(layer, transformer_blocks)

        self.tokens = FeatureTokenizer(d)
        self.cross  = nn.MultiheadAttention(d, attention_heads, batch_first=True)

        # Notebook fusion: LayerNorm -> Linear -> GELU -> Dropout.
        self.fuse = nn.Sequential(
            nn.LayerNorm(2 * d),
            nn.Linear(2 * d, d),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        self.classifier = nn.Linear(d, num_classes)
        self.sps        = nn.Linear(d, 2)
        self.decoder    = nn.Linear(d, 2 * window_size)
        self._window_size = window_size

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        h = self.patch(x).transpose(1, 2) + self.pos
        for block in self.blocks:
            h = block(h)
        # The checkpoint was trained with the denoising residual before attention.
        return self.transformer(h + self.denoise(h)).mean(1)

    def forward(self, raw, canonical, features) -> dict:
        a = self.encode(raw)
        b = self.encode(canonical)
        q        = self.tokens(features)
        joint    = ((a + b) / 2).unsqueeze(1)
        cross, _ = self.cross(joint, q, q)
        h = self.fuse(torch.cat([joint.squeeze(1), cross.squeeze(1)], dim=-1))
        s = self.sps(h)
        return {
            'logits':              self.classifier(h),
            'sps_mean':            s[:, 0],
            'sps_logvar':          s[:, 1].clamp(-8, 8),
            'reconstruction':      self.decoder(h).view(-1, 2, self._window_size),
            'raw_embedding':       a,
            'canonical_embedding': b,
        }


# Alias â€” main.py imports SRMambaAMC; this keeps it working
SRMambaAMC = SRMambaOfficial
