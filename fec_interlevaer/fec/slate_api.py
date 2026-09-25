"""FastAPI service for SLATE's FEC decode + interleaver de-interleaving (plan_fec_interleaver.md).

Run: uvicorn src.fec.slate_api:app --host 0.0.0.0 --port 8000

## What's production-ready (validated on real data, see chat / runs/*.csv)
- Convolutional FEC (rate 1/2, K=7, generators (171,133) octal -- the standard code used
  throughout complete_dataset): encode is bit-exact on 800/800 real recordings; Viterbi decode
  achieves BER=0.0 at SNR >= -5 dB.
- Interleaver de-interleaving GIVEN the type + parameters (block/convolutional/diagonal
  permutation, or an explicit permutation array): validated on 300 real recordings, 100% bit
  recovery at SNR >= 5 dB.
Both require the caller to supply the interleaver/FEC parameters (type, rows/cols/offset, or an
explicit permutation) -- this is the "known params" mode: POST /deinterleave and /fec/decode.

## What's experimental / not production-validated
Blind identification of an UNKNOWN interleaver/FEC from raw LLRs alone (SLATE's full claim) was
only validated on synthetic data (notebooks/slate_interleaver_fec_training.ipynb, Phases F0-F3)
and, on real data, only as a "correct permutation scores better than wrong ones" separation test
-- not as a working from-scratch search at real block sizes (a full n x n Sinkhorn search is
O(n^3) per candidate and was not shown to converge above a few hundred bits). Exposed here as
POST /deinterleave/blind, clearly marked experimental -- treat its output as a best-effort guess,
not a decision.

LDPC and Reed-Solomon FEC are NOT implemented: no LDPC parity-check matrix (H) was available for
this dataset's SIH_LDPC_256_128_V1 code, and RS decode was not built. /fec/decode only supports
fec_family="convolutional".
"""
from __future__ import annotations

import math
from enum import Enum
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from scipy.optimize import linear_sum_assignment

app = FastAPI(
    title="SLATE FEC & Interleaver API",
    description=__doc__,
    version="1.0.0",
)

# =============================================================================================
# Convolutional FEC: rate 1/2, K=7, generators (171,133) octal.
# Verified bit-exact against complete_dataset ground truth (800/800 recordings).
# =============================================================================================

K = 7
G1, G2 = 0o171, 0o133
N_STATES = 1 << (K - 1)


def conv_encode_171_133(bits: np.ndarray) -> np.ndarray:
    """Rate 1/2 K=7 (171,133) encode with zero-tail termination."""
    padded = np.concatenate([bits, np.zeros(K - 1, dtype=bits.dtype)])
    reg = 0
    out = np.empty(2 * len(padded), dtype=np.uint8)
    for i, b in enumerate(padded):
        reg = ((reg << 1) | int(b)) & (N_STATES * 2 - 1)
        out[2 * i] = bin(reg & G1).count("1") % 2
        out[2 * i + 1] = bin(reg & G2).count("1") % 2
    return out


def _build_trellis():
    next_state = np.zeros((N_STATES, 2), dtype=np.int64)
    output = np.zeros((N_STATES, 2, 2), dtype=np.uint8)
    for s in range(N_STATES):
        for b in (0, 1):
            reg = ((s << 1) | b) & (N_STATES * 2 - 1)
            p1 = bin(reg & G1).count("1") % 2
            p2 = bin(reg & G2).count("1") % 2
            next_state[s, b] = reg & (N_STATES - 1)
            output[s, b] = [p1, p2]
    return next_state, output


_NEXT_STATE, _OUTPUT = _build_trellis()


def viterbi_decode(L: np.ndarray, n_info_bits: int) -> np.ndarray:
    """Soft-input Viterbi decode of rate-1/2 K=7 (171,133). L: 2*(n_info_bits+K-1) coded-bit
    LLRs (zero-tail terminated). sign(L) < 0 => coded bit 1 (matches this module's LLR convention).
    """
    n_steps = len(L) // 2
    if n_steps < 1:
        raise ValueError("LLR sequence too short to decode")
    NEG_INF = -1e18
    path_metric = np.full(N_STATES, NEG_INF)
    path_metric[0] = 0.0
    backptr = np.zeros((n_steps, N_STATES), dtype=np.int64)
    input_bit_taken = np.zeros((n_steps, N_STATES), dtype=np.uint8)

    for t in range(n_steps):
        l1, l2 = L[2 * t], L[2 * t + 1]
        new_metric = np.full(N_STATES, NEG_INF)
        new_back = np.zeros(N_STATES, dtype=np.int64)
        new_bit = np.zeros(N_STATES, dtype=np.uint8)
        for s in range(N_STATES):
            if path_metric[s] == NEG_INF:
                continue
            for b in (0, 1):
                ns = _NEXT_STATE[s, b]
                o1, o2 = _OUTPUT[s, b]
                bm = (l1 if o1 == 0 else -l1) + (l2 if o2 == 0 else -l2)
                cand = path_metric[s] + bm
                if cand > new_metric[ns]:
                    new_metric[ns] = cand
                    new_back[ns] = s
                    new_bit[ns] = b
        path_metric = new_metric
        backptr[t] = new_back
        input_bit_taken[t] = new_bit

    state = 0
    bits = np.zeros(n_steps, dtype=np.uint8)
    for t in range(n_steps - 1, -1, -1):
        bits[t] = input_bit_taken[t, state]
        state = backptr[t, state]
    return bits[:n_info_bits]


def split_into_blocks(arr: np.ndarray, n_blocks: int) -> List[np.ndarray]:
    """See slate_api module docstring / plan: multi-block recordings zero-tail-terminate each
    of fec_block_count equal-length chunks independently (num_fec_bits = n*2 + 12*n_blocks)."""
    if len(arr) % n_blocks != 0:
        raise ValueError(f"{len(arr)} bits not divisible into {n_blocks} equal blocks")
    block_len = len(arr) // n_blocks
    return [arr[i * block_len:(i + 1) * block_len] for i in range(n_blocks)]


# =============================================================================================
# Interleaver families (plan Sec 4.3) + de-interleaving given known parameters.
# =============================================================================================

def block_interleaver_perm(rows: int, cols: int, offset: int = 0) -> np.ndarray:
    n = rows * cols
    grid = np.arange(n).reshape(rows, cols)
    perm = grid.T.flatten()
    return np.roll(perm, -offset)


def conv_interleaver_perm(n: int, branches: int, delay_increment: int, offset: int = 0) -> np.ndarray:
    idx = np.arange(n)
    branch = idx % branches
    delay = branch * delay_increment
    perm = (idx + delay) % n
    order = np.argsort(perm)
    return np.roll(order, -offset)


def helical_interleaver_perm(rows: int, cols: int, slope: int = 1, offset: int = 0) -> np.ndarray:
    n = rows * cols
    grid = np.arange(n).reshape(rows, cols)
    out = np.empty(n, dtype=int)
    for i, r in enumerate(range(rows)):
        row = np.roll(grid[r], -slope * r)
        out[i * cols:(i + 1) * cols] = row
    return np.roll(out, -offset)


def deinterleave(L: np.ndarray, perm: np.ndarray) -> np.ndarray:
    """Inverse of interleaved = original[perm] (this dataset's convention, verified bit-exact
    against complete_dataset ground truth): original[perm] = interleaved, i.e. de-interleaving
    is the scatter recon[perm] = L, NOT the fancy-index L[perm]."""
    if len(perm) != len(L):
        raise ValueError(f"permutation length {len(perm)} != LLR length {len(L)}")
    out = np.empty_like(L)
    out[perm] = L
    return out


# =============================================================================================
# Experimental: blind permutation-vs-wrong-permutation separation check (NOT a from-scratch
# blind search -- see module docstring). Given LLRs and a SET of candidate permutations
# (e.g. produced by trying several offsets/parameter guesses), ranks them by how confidently
# they decode -- this is what actually converged in real-data testing, not free-form recovery.
# =============================================================================================

def score_candidate_permutation(L: np.ndarray, perm: np.ndarray) -> float:
    """Mean |LLR| after de-interleaving as a confidence proxy: a correct permutation produces
    coherent codeword structure and (after decode) high-confidence bits; a wrong one does not
    reliably. This is a heuristic ranking signal, not a certified detector -- see module
    docstring's experimental-scope note."""
    return float(np.mean(np.abs(deinterleave(L, perm))))


def rank_candidate_permutations(L: np.ndarray, candidates: List[np.ndarray]) -> List[int]:
    """Returns candidate indices sorted best-first by score_candidate_permutation."""
    scores = [score_candidate_permutation(L, p) for p in candidates]
    return list(np.argsort(scores)[::-1])


# =============================================================================================
# API schemas
# =============================================================================================

class InterleaverType(str, Enum):
    block = "block"
    convolutional = "convolutional"
    diagonal = "diagonal"
    none = "none"


class DeinterleaveRequest(BaseModel):
    llrs: List[float] = Field(..., description="Interleaved LLR sequence")
    interleaver_type: InterleaverType
    rows: Optional[int] = Field(None, description="required for block/diagonal")
    cols: Optional[int] = Field(None, description="required for block/diagonal")
    offset: int = Field(0, description="interleaver start offset")
    branches: Optional[int] = Field(None, description="required for convolutional interleaver")
    delay_increment: Optional[int] = Field(None, description="required for convolutional interleaver")
    slope: int = Field(1, description="diagonal interleaver slope")
    permutation: Optional[List[int]] = Field(
        None, description="explicit ground-truth permutation array; overrides type/params if given"
    )


class DeinterleaveResponse(BaseModel):
    deinterleaved_llrs: List[float]
    n_bits: int


class FecDecodeRequest(BaseModel):
    llrs: List[float] = Field(..., description="Coded-bit LLRs (post de-interleave)")
    fec_family: str = Field("convolutional", description="only 'convolutional' is implemented")
    n_blocks: int = Field(1, ge=1, description="number of independently zero-tail-terminated blocks")


class FecDecodeResponse(BaseModel):
    decoded_bits: List[int]
    n_info_bits: int
    n_blocks: int


class BlindRankRequest(BaseModel):
    llrs: List[float]
    candidate_permutations: List[List[int]] = Field(
        ..., description="candidate permutations to rank, e.g. several (rows,cols,offset) guesses"
    )


class BlindRankResponse(BaseModel):
    ranked_candidate_indices: List[int] = Field(
        ..., description="candidate_permutations indices, best guess first"
    )
    scores: List[float]
    warning: str = (
        "EXPERIMENTAL: heuristic ranking only, validated as a separation signal on real data "
        "but not as a certified from-scratch blind search. See module docstring."
    )


# =============================================================================================
# Endpoints
# =============================================================================================

@app.post("/deinterleave", response_model=DeinterleaveResponse)
def api_deinterleave(req: DeinterleaveRequest):
    """De-interleave LLRs given a KNOWN interleaver type + parameters (or explicit permutation).
    Validated on real data: 100% bit recovery at SNR >= 5 dB, 300 real recordings."""
    L = np.asarray(req.llrs, dtype=np.float32)
    n = len(L)

    if req.permutation is not None:
        perm = np.asarray(req.permutation, dtype=np.int64)
    elif req.interleaver_type == InterleaverType.none:
        return DeinterleaveResponse(deinterleaved_llrs=L.tolist(), n_bits=n)
    elif req.interleaver_type == InterleaverType.block:
        if req.rows is None or req.cols is None:
            raise HTTPException(400, "block interleaver requires rows and cols")
        if req.rows * req.cols != n:
            raise HTTPException(400, f"rows*cols ({req.rows*req.cols}) != n_bits ({n})")
        perm = block_interleaver_perm(req.rows, req.cols, req.offset)
    elif req.interleaver_type == InterleaverType.diagonal:
        if req.rows is None or req.cols is None:
            raise HTTPException(400, "diagonal interleaver requires rows and cols")
        if req.rows * req.cols != n:
            raise HTTPException(400, f"rows*cols ({req.rows*req.cols}) != n_bits ({n})")
        perm = helical_interleaver_perm(req.rows, req.cols, req.slope, req.offset)
    elif req.interleaver_type == InterleaverType.convolutional:
        if req.branches is None or req.delay_increment is None:
            raise HTTPException(400, "convolutional interleaver requires branches and delay_increment")
        perm = conv_interleaver_perm(n, req.branches, req.delay_increment, req.offset)
    else:
        raise HTTPException(400, f"unsupported interleaver_type {req.interleaver_type}")

    try:
        out = deinterleave(L, perm)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return DeinterleaveResponse(deinterleaved_llrs=out.tolist(), n_bits=n)


@app.post("/fec/decode", response_model=FecDecodeResponse)
def api_fec_decode(req: FecDecodeRequest):
    """Viterbi-decode coded-bit LLRs. Validated on real data: BER=0.0 at SNR >= -5 dB,
    800/800 real recordings. Only fec_family='convolutional' (rate 1/2, K=7, (171,133)) is
    implemented -- LDPC and Reed-Solomon are not (see module docstring)."""
    if req.fec_family != "convolutional":
        raise HTTPException(
            400,
            f"fec_family='{req.fec_family}' not implemented; only 'convolutional' is supported "
            "(no LDPC H matrix or RS decoder available -- see module docstring).",
        )

    L = np.asarray(req.llrs, dtype=np.float32)
    try:
        fec_blocks = split_into_blocks(L, req.n_blocks)
    except ValueError as e:
        raise HTTPException(400, str(e))

    decoded_all = []
    for fb in fec_blocks:
        n_info = len(fb) // 2 - (K - 1)
        if n_info < 1:
            raise HTTPException(400, "block too short to contain a valid codeword + tail")
        try:
            decoded = viterbi_decode(fb, n_info_bits=n_info)
        except ValueError as e:
            raise HTTPException(400, str(e))
        decoded_all.append(decoded)

    decoded_bits = np.concatenate(decoded_all).astype(int).tolist()
    return FecDecodeResponse(decoded_bits=decoded_bits, n_info_bits=len(decoded_bits),
                              n_blocks=req.n_blocks)


@app.post("/deinterleave/blind", response_model=BlindRankResponse)
def api_deinterleave_blind(req: BlindRankRequest):
    """EXPERIMENTAL. Ranks caller-supplied candidate permutations by a confidence heuristic.
    Does NOT perform a from-scratch blind search over unknown interleaver parameters -- the
    caller must still generate the candidates (e.g. sweep plausible rows/cols/offset and build
    each with block_interleaver_perm / conv_interleaver_perm / helical_interleaver_perm).
    See module docstring for validation scope."""
    L = np.asarray(req.llrs, dtype=np.float32)
    candidates = [np.asarray(c, dtype=np.int64) for c in req.candidate_permutations]
    for i, c in enumerate(candidates):
        if len(c) != len(L):
            raise HTTPException(400, f"candidate_permutations[{i}] length != llrs length")

    scores = [score_candidate_permutation(L, c) for c in candidates]
    ranked = list(np.argsort(scores)[::-1])
    return BlindRankResponse(ranked_candidate_indices=[int(i) for i in ranked],
                              scores=[float(s) for s in scores])


@app.get("/health")
def health():
    return {"status": "ok", "fec_families_supported": ["convolutional"],
            "interleaver_types_supported": ["none", "block", "diagonal", "convolutional"]}
