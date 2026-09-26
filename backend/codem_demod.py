# ============================================================
# CoDeM-backed demodulator -- same (ok, bits, llr, sps, bits_per_symbol, n_symbols) contract as
# demod.py's blind DSP demodulator (see bitstream_fec.py), backed by codem_demodulation.pt via
# the real training-source architecture (backend/codem_model.py).
#
# symbol_rate_hz / sample_rate_hz: the real training pipeline reads these from ground-truth
# manifest metadata (primary_symbol_rate_hz), which a blindly-uploaded file has no equivalent
# of. Fed to the model anyway (CoDeM's [S]/[W] stage needs *some* physical time base), but the
# net effect of differentiable_correction() on the signal is provably invariant to the absolute
# value chosen here, AS LONG AS sample_rate_hz = symbol_rate_hz * canonical_sps (matching how
# the training loop derived it): d_f = raw*0.1*symbol_rate_hz and t = arange(N)/sample_rate_hz,
# so symbol_rate_hz cancels exactly out of the d_f*t phase term used for CFO derotation, and
# d_tau/delay_samples never involve it at all. So any positive placeholder is exact, not
# approximate, for the correction step itself; only the (unused, un-surfaced) reported d_f
# value in physical Hz would need the real symbol rate to mean anything.
#
# LLR sign convention: CoDeM's llr_head was trained with `hard_bits = (llr > 0)` (see
# codem_loss / collect_codem_predictions in the training notebook) -- the OPPOSITE of this
# repo's own convention (demod.py, fec_interlevaer/fec/slate_api.py: llr < 0 => bit 1). The
# sign is flipped once, right here, so everything downstream (bitstream_fec.py's Viterbi/
# interleaver/tier-1 analysis) can keep assuming its one documented convention.
#
# Scope note: like the /api/v1/classify endpoint, this analyzes one fixed-length canonical
# window (cfg.window_len samples, center-cropped/padded) per request, not the whole uploaded
# file. A window yields bits_per_symbol * symbols_per_window bits (e.g. 64QAM: 6*64=384).
# ============================================================
from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from codem_model import load_codem
from preprocess_v2 import preprocess_v2

CODEM_PATH = Path(__file__).parent.parent / "codem_demodulation.pt"

_model = None
_classes: list[str] = []
_class_bits: dict[str, int] = {}
_open_set_threshold = 0.5
_device = "cpu"

NO_BITSTREAM_MODULATIONS: set[str] = set()


def load_codem_singleton(checkpoint_path: str | Path = CODEM_PATH, device: str = "cpu"):
    global _model, _classes, _class_bits, _open_set_threshold, _device, NO_BITSTREAM_MODULATIONS
    if not Path(checkpoint_path).exists():
        raise FileNotFoundError(f"CoDeM checkpoint not found at {checkpoint_path}")
    _model, _classes, _class_bits, _open_set_threshold = load_codem(str(checkpoint_path), device=device)
    _device = device
    NO_BITSTREAM_MODULATIONS.clear()
    NO_BITSTREAM_MODULATIONS.update(m for m, b in _class_bits.items() if b <= 0)
    return _model


def estimate_and_demod(z: np.ndarray, modulation: str, family: str) -> dict:
    """Returns dict(ok, reason?, bits, llr, sps, bits_per_symbol, n_symbols, quality?,
    open_set_pass?, predicted_class?)."""
    if _model is None:
        return dict(ok=False, reason="CoDeM model not loaded")

    bps = _class_bits.get(modulation, 0)
    if bps <= 0:
        return dict(ok=False, reason=f"{modulation} carries no discrete bitstream")

    cfg = _model.cfg
    batch = preprocess_v2(np.asarray(z, dtype=np.complex128),
                           window_len=cfg.window_len, canonical_sps=cfg.canonical_sps)
    batch = {k: v.to(_device) for k, v in batch.items()}

    # See module docstring: any positive symbol_rate_hz is exact for the correction itself.
    symbol_rate_hz = torch.ones_like(batch["sps_hat"])
    sample_rate_hz = symbol_rate_hz * cfg.canonical_sps

    with torch.no_grad():
        out = _model(batch["canonical"], batch["raw"], batch["features"],
                      batch["sps_hat"], batch["conf_hat"], symbol_rate_hz, sample_rate_hz)

    predicted_class = _classes[int(out["pred_class"].item())]

    llr_full = out["llr"].squeeze(0).cpu().numpy().astype(np.float32)  # (n_tokens, MAX_BITS)
    llr2d = -llr_full[:, :bps]  # flip to this repo's llr<0=>bit1 convention (see module docstring)
    bits2d = (llr2d < 0).astype(np.uint8)

    return dict(
        ok=True,
        bits=bits2d.reshape(-1),
        llr=llr2d.reshape(-1),
        sps=round(float(batch["sps_hat"].item()), 3),
        bits_per_symbol=bps,
        n_symbols=int(llr2d.shape[0]),
        quality=out["quality"].squeeze(0).cpu().numpy().tolist(),
        open_set_pass=bool(out["open_set_pass"].item()),
        predicted_class=predicted_class,
    )
