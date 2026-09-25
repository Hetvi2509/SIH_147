"""SIFT Component C -- the field tagger (plan_bitstream_analysis.md Sec 4.4), the only learned
component in this plan. Proposes per-column BIO-style tags (SYNC/HDR/LEN/CNT/PAY/CRC/PAD); it
never asserts a CRC -- only crc_recover.py's algebraic verifier can do that (Sec 4.5).

Dual-branch, matching the pattern already used at Stages [10]/[15]: Branch 1 is a small 1-D CNN
over the folded matrix (BRFS-DL/EBPFI-style, Sec 3.4), Branch 2 is the hand-computed column
statistics from folding.py (Sec 4.3). A BiLSTM + linear-chain CRF head follows PREIUD (Sec 3.2)
-- the CRF encodes field-transition grammar (e.g. CRC follows PAY) that independent per-column
softmax cannot. No torchcrf dependency: implemented directly (~80 lines: batched, length-masked
forward algorithm for the loss and Viterbi for decoding).

MLP fusion by default; KAN is ablation-gated only (bounded-basis argument unchanged from Stages
[10]/[15], not exercised here -- config option only, per plan Sec 4.4).

Training entry point: see notebooks/sift_bitstream_analysis_training.ipynb Sec 12-13, which
trains this exact architecture with early stopping and saves runs/sift_field_tagger.pt. This
module holds the architecture + inference-time loading so the checkpoint can be reused without
re-running the notebook.
"""
from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn

TAG_NAMES = ("SYNC", "HDR", "LEN", "CNT", "PAY", "CRC", "PAD")


class LinearChainCRF(nn.Module):
    """Minimal linear-chain CRF: learnable (n_tags, n_tags) transition matrix, batched
    length-masked forward algorithm for the negative log-likelihood loss, Viterbi for decoding.
    """

    def __init__(self, n_tags: int):
        super().__init__()
        self.n_tags = n_tags
        self.transitions = nn.Parameter(torch.randn(n_tags, n_tags) * 0.1)
        self.start_transitions = nn.Parameter(torch.randn(n_tags) * 0.1)
        self.end_transitions = nn.Parameter(torch.randn(n_tags) * 0.1)

    def _forward_alg(self, emissions: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        batch, seq_len, n_tags = emissions.shape
        alpha = self.start_transitions.unsqueeze(0) + emissions[:, 0]
        for t in range(1, seq_len):
            emit = emissions[:, t].unsqueeze(1)
            trans = self.transitions.unsqueeze(0)
            new_alpha = torch.logsumexp(alpha.unsqueeze(2) + trans + emit, dim=1)
            m = mask[:, t].unsqueeze(1)
            alpha = torch.where(m, new_alpha, alpha)
        return torch.logsumexp(alpha + self.end_transitions.unsqueeze(0), dim=1)

    def _score_sequence(
        self, emissions: torch.Tensor, tags: torch.Tensor, mask: torch.Tensor
    ) -> torch.Tensor:
        batch, seq_len, _ = emissions.shape
        score = self.start_transitions[tags[:, 0]] + emissions[:, 0].gather(1, tags[:, :1]).squeeze(1)
        last_tag = tags[:, 0]
        for t in range(1, seq_len):
            step_score = (
                self.transitions[last_tag, tags[:, t]]
                + emissions[:, t].gather(1, tags[:, t : t + 1]).squeeze(1)
            )
            m = mask[:, t]
            score = score + torch.where(m, step_score, torch.zeros_like(step_score))
            last_tag = torch.where(m, tags[:, t], last_tag)
        return score + self.end_transitions[last_tag]

    def neg_log_likelihood(
        self, emissions: torch.Tensor, tags: torch.Tensor, mask: torch.Tensor
    ) -> torch.Tensor:
        return (self._forward_alg(emissions, mask) - self._score_sequence(emissions, tags, mask)).mean()

    @torch.no_grad()
    def decode(self, emissions: torch.Tensor, mask: torch.Tensor = None) -> list:
        """Returns a list of variable-length tag sequences (one per batch element)."""
        batch, seq_len, n_tags = emissions.shape
        if mask is None:
            mask = torch.ones(batch, seq_len, dtype=torch.bool, device=emissions.device)
        backptrs = torch.zeros(batch, seq_len, n_tags, dtype=torch.long, device=emissions.device)
        score = self.start_transitions.unsqueeze(0) + emissions[:, 0]
        for t in range(1, seq_len):
            broadcast = score.unsqueeze(2) + self.transitions.unsqueeze(0)
            best_score, best_prev = broadcast.max(dim=1)
            new_score = best_score + emissions[:, t]
            m = mask[:, t].unsqueeze(1)
            score = torch.where(m, new_score, score)
            backptrs[:, t] = best_prev

        lengths = mask.sum(dim=1)
        results = []
        for b in range(batch):
            L = int(lengths[b].item())
            end_score = score[b] + self.end_transitions
            best_last = int(end_score.argmax().item())
            path = [best_last]
            for t in range(L - 1, 0, -1):
                best_last = int(backptrs[b, t, best_last].item())
                path.append(best_last)
            path.reverse()
            results.append(path)
        return results


class FieldTagger(nn.Module):
    """Dual-branch: 1-D CNN over the (2, P) folded-matrix summary (bits + reliability, averaged
    over frames into a per-column profile) + hand-computed column stats (folding.py), concat,
    BiLSTM, linear-chain CRF over the column axis."""

    def __init__(
        self,
        n_tags: int = len(TAG_NAMES),
        n_stat_features: int = 3,
        cnn_channels: int = 16,
        lstm_hidden: int = 48,
        kind: str = "mlp",
    ):
        super().__init__()
        if kind != "mlp":
            raise ValueError(
                f"kind={kind!r} not implemented -- MLP fusion is the default and only backend "
                "wired here (plan Sec 4.4: KAN is ablation-gated only, ablation K, not exercised)"
            )
        self.cnn = nn.Sequential(
            nn.Conv1d(2, cnn_channels, kernel_size=5, padding=2), nn.ReLU(),
            nn.Conv1d(cnn_channels, cnn_channels, kernel_size=3, padding=1), nn.ReLU(),
        )
        fused_dim = cnn_channels + n_stat_features
        self.fuse = nn.Sequential(nn.Linear(fused_dim, lstm_hidden), nn.ReLU())
        self.lstm = nn.LSTM(lstm_hidden, lstm_hidden, batch_first=True, bidirectional=True)
        self.emit = nn.Linear(lstm_hidden * 2, n_tags)
        self.crf = LinearChainCRF(n_tags)

    def features(self, folded_summary: torch.Tensor, stat_feats: torch.Tensor) -> torch.Tensor:
        cnn_out = self.cnn(folded_summary).transpose(1, 2)
        fused = torch.cat([cnn_out, stat_feats], dim=-1)
        fused = self.fuse(fused)
        lstm_out, _ = self.lstm(fused)
        return self.emit(lstm_out)

    def loss(self, folded_summary, stat_feats, tags, mask):
        emissions = self.features(folded_summary, stat_feats)
        return self.crf.neg_log_likelihood(emissions, tags, mask)

    def predict(self, folded_summary, stat_feats, mask=None):
        emissions = self.features(folded_summary, stat_feats)
        return self.crf.decode(emissions, mask)


def load_tagger(checkpoint_path: str, device: str = "cpu") -> tuple:
    """Loads a trained checkpoint (see notebooks/sift_bitstream_analysis_training.ipynb Sec 16).
    Returns (model, metadata_dict)."""
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    cfg = ckpt["config"]
    model = FieldTagger(
        n_tags=cfg["n_tags"], lstm_hidden=cfg["tagger_lstm_hidden"], kind="mlp"
    ).to(device)
    model.load_state_dict(ckpt["tagger_state"])
    model.eval()
    return model, ckpt


def tag_stream(model: FieldTagger, bit_mat: np.ndarray, rel_mat: np.ndarray, device: str = "cpu") -> list[str]:
    """Runs the tagger on one folded (bit_mat, rel_mat) pair, returns a list of tag name strings,
    one per column."""
    folded_summary = (
        torch.from_numpy(np.stack([bit_mat.mean(0), rel_mat.mean(0)], axis=0))
        .float()
        .unsqueeze(0)
        .to(device)
    )
    from .folding import column_features

    stat_feats = torch.from_numpy(column_features(bit_mat, rel_mat)).float().unsqueeze(0).to(device)
    with torch.no_grad():
        pred = model.predict(folded_summary, stat_feats)[0]
    return [TAG_NAMES[t] for t in pred]


def demo():
    """Smallest runnable self-check: random-initialized model, forward + loss + decode shapes."""
    torch.manual_seed(0)
    model = FieldTagger()
    batch, period = 4, 32
    folded = torch.randn(batch, 2, period)
    stats = torch.randn(batch, period, 3)
    tags = torch.randint(0, len(TAG_NAMES), (batch, period))
    mask = torch.ones(batch, period, dtype=torch.bool)

    loss = model.loss(folded, stats, tags, mask)
    assert torch.isfinite(loss) and loss.item() > 0
    loss.backward()

    decoded = model.predict(folded, stats, mask)
    assert len(decoded) == batch and all(len(d) == period for d in decoded)
    print(f"demo() OK: loss={loss.item():.3f}, decoded {batch} sequences of length {period}")


if __name__ == "__main__":
    demo()
