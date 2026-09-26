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
from typing import List

# Ensure the backend/ directory is on sys.path so `model` and `preprocess`
# are importable whether uvicorn is launched from the project root or backend/.
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from preprocess import load_iq_bytes
from db import init_pool, close_pool
from auth import router as auth_router
from history import router as history_router
from bitstream_fec import run_bitstream_fec_analysis
from chat import router as chat_router
import codem_demod
from model_v2 import load_amc_v2
from preprocess_v2 import preprocess_v2

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger("amc-backend")

# -------------------------------------------------------------------
# Paths
# -------------------------------------------------------------------

MODEL_V2_PATH = Path(__file__).parent.parent / "srmamba_amc_v2_post_training.pt"
if not MODEL_V2_PATH.exists():
    MODEL_V2_PATH = Path(__file__).parent.parent / "srmamba_amc_v2_post_training"

CODEM_PATH = Path(__file__).parent.parent / "codem_demodulation.pt"

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

app.include_router(auth_router)
app.include_router(history_router)
app.include_router(chat_router)

# -------------------------------------------------------------------
# Model singleton â€” loaded once at startup. v1 (sr_mamba_official_best) is intentionally not
# loaded: srmamba_amc_v2_post_training is the only model used for modulation classification.
# -------------------------------------------------------------------

_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

_model_v2 = None
_classes_v2: List[str] = []
_ckpt_v2: dict = {}


def _load_model_v2():
    global _model_v2, _classes_v2, _ckpt_v2
    if not MODEL_V2_PATH.exists():
        raise FileNotFoundError(f"v2 checkpoint not found at {MODEL_V2_PATH}")
    logger.info(f"Loading SR-Mamba AMC v2 checkpoint from {MODEL_V2_PATH} …")
    _model_v2, _ckpt_v2, _classes_v2 = load_amc_v2(str(MODEL_V2_PATH), device=str(_device))
    logger.info(
        f"v2 model loaded (best_epoch={_ckpt_v2.get('best_epoch')}, "
        f"best_val_loss={_ckpt_v2.get('best_val_loss'):.4f}). Classes ({len(_classes_v2)}): {_classes_v2}"
    )


def _load_codem():
    if not CODEM_PATH.exists():
        raise FileNotFoundError(f"CoDeM checkpoint not found at {CODEM_PATH}")
    logger.info(f"Loading CoDeM demodulation checkpoint from {CODEM_PATH} …")
    codem_demod.load_codem_singleton(CODEM_PATH, device=str(_device))
    logger.info(
        f"CoDeM model loaded. Classes ({len(codem_demod._classes)}): {codem_demod._classes}, "
        f"bitstream-capable: {sorted(set(codem_demod._classes) - codem_demod.NO_BITSTREAM_MODULATIONS)}"
    )


@app.on_event("startup")
async def startup_event():
    _load_model_v2()
    _load_codem()
    init_pool()


@app.on_event("shutdown")
async def shutdown_event():
    close_pool()


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
        "model_loaded": _model_v2 is not None,
        "model_version": "srmamba_amc_v2_post_training",
        "device": str(_device),
        "classes": _classes_v2,
        "num_classes": len(_classes_v2),
        "codem_loaded": codem_demod._model is not None,
        "codem_bitstream_classes": sorted(set(codem_demod._classes) - codem_demod.NO_BITSTREAM_MODULATIONS),
    }


@app.post("/api/v1/classify", response_model=ClassifyResponse)
async def classify(file: UploadFile = File(...)):
    """
    Accept a .iq / .wav / .bin file and return the AMC result, backed by the
    srmamba_amc_v2_post_training checkpoint (FiLM-conditioned dual-view encoder + cross-attention
    analytic fusion; see backend/model_v2.py and backend/preprocess_v2.py).
    """
    if _model_v2 is None:
        raise HTTPException(503, "v2 model not loaded (checkpoint missing).")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '{suffix}'. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Uploaded file is empty.")

    try:
        z = load_iq_bytes(data, file.filename or "signal.iq")
        cfg = _model_v2.cfg
        batch = preprocess_v2(z, window_len=cfg.window_len, canonical_sps=cfg.canonical_sps)
    except Exception as exc:
        logger.error(f"v2 preprocessing failed: {exc}")
        raise HTTPException(422, f"Failed to parse signal file: {exc}")

    preview = _make_preview(batch["raw"])

    t0 = time.perf_counter()
    with torch.no_grad():
        batch = {k: v.to(_device) for k, v in batch.items()}
        out = _model_v2(batch["raw"], batch["canonical"], batch["features"],
                         batch["sps_hat"], batch["conf_hat"])
        logits = out["logits"]
    elapsed_ms = (time.perf_counter() - t0) * 1000

    probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
    top_k = int(min(5, len(_classes_v2)))
    top_indices = np.argsort(probs)[::-1][:top_k]

    predicted_idx = int(top_indices[0])
    predicted_class = _classes_v2[predicted_idx]
    confidence = float(probs[predicted_idx]) * 100.0
    family = _FAMILY_MAP.get(predicted_class, "Unknown")

    top_k_items = [
        TopKItem(modulation=_classes_v2[i], confidence=round(float(probs[i]) * 100.0, 2))
        for i in top_indices
    ]

    logger.info(
        f"[v2] Classified '{file.filename}' -> {predicted_class} "
        f"({confidence:.1f}%) in {elapsed_ms:.1f} ms"
    )

    return ClassifyResponse(
        modulation=predicted_class,
        family=family,
        confidence=round(confidence, 2),
        topK=top_k_items,
        inferenceTimeMs=round(elapsed_ms, 2),
        modelVersion="srmamba_amc_v2_post_training",
        status="completed",
        preview=preview,
    )


@app.post("/api/v1/bitstream-fec")
async def bitstream_fec(
    file: UploadFile = File(...),
    modulation: str = Form(...),
    family: str = Form(""),
):
    """
    Real FEC decode + interleaver de-interleaving (fec_interlevaer/fec/slate_api.py) and
    Tier 1 bit-stream frame/CRC recovery (bit_stream_anaylsis/bit_stream) run on bits blindly
    demodulated from the uploaded signal (backend/demod.py) -- not derived from classification
    confidence.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type '{suffix}'. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Uploaded file is empty.")

    try:
        z = load_iq_bytes(data, file.filename or "signal.iq")
    except Exception as exc:
        logger.error(f"IQ load failed: {exc}")
        raise HTTPException(422, f"Failed to parse signal file: {exc}")

    result = run_bitstream_fec_analysis(z, modulation, family)
    return result
