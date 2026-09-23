# ============================================================
# SR-Mamba AMC â€” FastAPI Backend
# ============================================================
# Startup: uvicorn main:app --reload --host 0.0.0.0 --port 8000
# ============================================================

from __future__ import annotations

import sys
import os
import time
import logging
from pathlib import Path
from typing import List, Optional

# Ensure the backend/ directory is on sys.path so `model` and `preprocess`
# are importable whether uvicorn is launched from the project root or backend/.
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import SRMambaAMC
from preprocess import preprocess

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger("amc-backend")

# -------------------------------------------------------------------
# Paths
# -------------------------------------------------------------------

MODEL_PATH = Path(__file__).parent.parent / "sr_mamba_official_best.pt"

# -------------------------------------------------------------------
# App
# -------------------------------------------------------------------

app = FastAPI(
    title="SR-Mamba AMC API",
    description="Automatic Modulation Classification using the SR-Mamba model.",
    version="1.0.0",
)

# Allow the Vite dev server (and any localhost port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# Model singleton â€” loaded once at startup
# -------------------------------------------------------------------

_model: Optional[SRMambaAMC] = None
_classes: List[str] = []
_config: dict = {}
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_feat_mean: Optional[torch.Tensor] = None
_feat_std:  Optional[torch.Tensor] = None


def _load_model():
    global _model, _classes, _config, _feat_mean, _feat_std

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    logger.info(f"Loading checkpoint from {MODEL_PATH} on {_device} â€¦")
    ckpt = torch.load(MODEL_PATH, map_location=_device, weights_only=False)

    # Pull metadata stored in the checkpoint
    _classes = ckpt.get("class_names", [
        "OOK", "PAM", "2FSK", "4FSK", "CPFSK", "GMSK",
        "BPSK", "QPSK", "8PSK", "16QAM", "64QAM",
        "AM", "FM", "NOISE",
    ])
    _config  = ckpt.get("configuration", {})

    ws  = int(_config.get("window_size",      1024))
    ps  = int(_config.get("patch_size",          8))
    ed  = int(_config.get("embedding_dim",      256))
    mb  = int(_config.get("mamba_blocks",         8))
    ds  = int(_config.get("d_state",             16))
    me  = int(_config.get("mamba_expand",          2))
    tb  = int(_config.get("transformer_blocks",    2))
    ah  = int(_config.get("attention_heads",       4))
    do  = float(_config.get("dropout",           0.2))
    nc  = len(_classes)

    # Auto-detect conv_kernel from the saved weight shape so the architecture
    # always matches the checkpoint even when no config dict is stored.
    state = ckpt["model_state_dict"]
    _ck_default = int(_config.get("conv_kernel", 4))
    _ck_key = next((k for k in state if "blocks." in k and k.endswith(".conv.weight")), None)
    ck = int(state[_ck_key].shape[-1]) if _ck_key else _ck_default
    logger.info(f"conv_kernel={ck}, mamba_expand={me} (from checkpoint)")

    _model = SRMambaAMC(
        num_classes=nc, window_size=ws, patch_size=ps,
        embedding_dim=ed, mamba_blocks=mb, d_state=ds,
        conv_kernel=ck, mamba_expand=me, transformer_blocks=tb,
        attention_heads=ah, dropout=do,
    ).to(_device)

    _model.load_state_dict(ckpt["model_state_dict"])
    _model.eval()

    # Load feature normalization statistics stored in the checkpoint
    if "feature_mean" in ckpt and "feature_std" in ckpt:
        _feat_mean = torch.tensor(ckpt["feature_mean"], dtype=torch.float32).to(_device)
        _feat_std  = torch.tensor(ckpt["feature_std"],  dtype=torch.float32).to(_device)
        logger.info(f"Feature normalisation stats loaded (dim={_feat_mean.shape})")
    else:
        logger.warning("No feature_mean/feature_std in checkpoint â€” features will not be normalised.")

    logger.info(f"Model loaded. Classes ({nc}): {_classes}")


@app.on_event("startup")
async def startup_event():
    _load_model()


# -------------------------------------------------------------------
# Response schemas
# -------------------------------------------------------------------

class TopKItem(BaseModel):
    modulation: str
    confidence: float   # 0-100


class ClassifyResponse(BaseModel):
    modulation:      str
    family:          str
    confidence:      float       # 0-100
    topK:            List[TopKItem]
    inferenceTimeMs: float
    modelVersion:    str
    status:          str
    preview:         dict


def _make_preview(raw: torch.Tensor) -> dict:
    """Build compact preview data from the exact normalized IQ window sent to the model."""
    z = raw[0, 0].cpu().numpy().astype(np.float32) + 1j * raw[0, 1].cpu().numpy().astype(np.float32)
    n = len(z)
    display_idx = np.linspace(0, n - 1, min(512, n), dtype=int)
    iq = [{
        "time": int(i),
        "i": round(float(z[i].real), 6), "q": round(float(z[i].imag), 6),
        "amplitude": round(float(abs(z[i])), 6),
        "phase": round(float(np.degrees(np.angle(z[i]))), 4),
    } for i in display_idx]

    fft_n = min(256, n)
    fft = np.fft.fftshift(np.fft.fft(z[:fft_n] * np.hanning(fft_n)))
    power = 20 * np.log10(np.maximum(np.abs(fft) / max(float(np.max(np.abs(fft))), 1e-12), 1e-8))
    noise = round(float(np.percentile(power, 25)), 3)
    spectrum = [{"freq": round((i - fft_n / 2) / fft_n, 5), "power": round(float(p), 3), "noise": noise} for i, p in enumerate(power)]

    phase = np.unwrap(np.angle(z))
    inst_freq = np.concatenate(([0.0], np.diff(phase))) / (2 * np.pi)
    frequency = [{"time": int(i), "frequency": round(float(inst_freq[i]), 6)} for i in display_idx]

    rows, cols = 32, 128
    waterfall = []
    for start in np.linspace(0, max(0, n - cols), rows, dtype=int):
        frame = z[start:start + cols]
        frame_fft = np.fft.fftshift(np.fft.fft(frame * np.hanning(len(frame)), n=cols))
        frame_db = 20 * np.log10(np.maximum(np.abs(frame_fft), 1e-8))
        waterfall.append(np.round(frame_db - np.max(frame_db), 2).tolist())

    eye = [np.round(z.real[i:i + 32], 6).tolist() for i in range(0, n - 32, 32)][:32]
    return {
        "iq": iq, "spectrum": spectrum, "frequency": frequency,
        "waterfall": waterfall, "eye": eye, "sampleCount": n,
        "meanAmplitude": round(float(np.mean(np.abs(z))), 6),
        "paprDb": round(float(10 * np.log10(np.max(np.abs(z) ** 2) / max(np.mean(np.abs(z) ** 2), 1e-12))), 3),
    }

# Map modulation to family (covers both old and official checkpoint labels)
_FAMILY_MAP = {
    # Official checkpoint classes
    "OOK":    "ASK",
    "PAM":    "ASK",
    "2FSK":   "FSK",
    "4FSK":   "FSK",
    "CPFSK":  "FSK",
    "GMSK":   "FSK",
    "BPSK":   "PSK",
    "QPSK":   "PSK",
    "8PSK":   "PSK",
    "16QAM":  "QAM",
    "64QAM":  "QAM",
    "AM":     "AM",
    "FM":     "FM",
    "NOISE":  "None",
    # Legacy labels (AMC checkpoint)
    "OOK/ASK":   "ASK",
    "2-FSK":     "FSK",
    "4-FSK":     "FSK",
    "GFSK/GMSK": "FSK",
    "8-PSK":     "PSK",
    "16-QAM":    "QAM",
    "64-QAM":    "QAM",
    "Noise":     "None",
}

# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".iq", ".wav", ".bin"}


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": _model is not None,
        "device": str(_device),
        "classes": _classes,
        "num_classes": len(_classes),
        "feature_normalisation": _feat_mean is not None,
    }


@app.post("/api/v1/classify", response_model=ClassifyResponse)
async def classify(file: UploadFile = File(...)):
    """
    Accept a .iq / .wav / .bin file and return the AMC result.
    """
    if _model is None:
        raise HTTPException(503, "Model not loaded yet. Try again in a moment.")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '{suffix}'. "
            f"Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Uploaded file is empty.")

    # Minimum size check: need at least 1024 * 2 * 4 = 8 192 bytes for float32 IQ
    ws = int(_config.get("window_size", 1024))

    try:
        batch = preprocess(data, file.filename or "signal.iq", window_size=ws)
    except Exception as exc:
        logger.error(f"Preprocessing failed: {exc}")
        raise HTTPException(422, f"Failed to parse signal file: {exc}")

    preview = _make_preview(batch["raw"])

    # Run inference
    t0 = time.perf_counter()
    with torch.no_grad():
        batch = {k: v.to(_device) for k, v in batch.items()}
        # Apply feature normalisation if stats were saved in the checkpoint
        if _feat_mean is not None and _feat_std is not None:
            batch["features"] = (batch["features"] - _feat_mean) / (_feat_std + 1e-8)
        out    = _model(batch["raw"], batch["canonical"], batch["features"])
        logits = out["logits"]                       # [1, num_classes]

    elapsed_ms = (time.perf_counter() - t0) * 1000

    probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()   # [num_classes]
    top_k = int(min(5, len(_classes)))
    top_indices = np.argsort(probs)[::-1][:top_k]

    predicted_idx  = int(top_indices[0])
    predicted_class = _classes[predicted_idx]
    confidence      = float(probs[predicted_idx]) * 100.0
    family          = _FAMILY_MAP.get(predicted_class, "Unknown")

    top_k_items = [
        TopKItem(
            modulation=_classes[i],
            confidence=round(float(probs[i]) * 100.0, 2),
        )
        for i in top_indices
    ]

    logger.info(
        f"Classified '{file.filename}' â†’ {predicted_class} "
        f"({confidence:.1f}%) in {elapsed_ms:.1f} ms"
    )

    return ClassifyResponse(
        modulation=predicted_class,
        family=family,
        confidence=round(confidence, 2),
        topK=top_k_items,
        inferenceTimeMs=round(elapsed_ms, 2),
        modelVersion="sr_mamba_official_best",
        status="completed",
        preview=preview,
    )
