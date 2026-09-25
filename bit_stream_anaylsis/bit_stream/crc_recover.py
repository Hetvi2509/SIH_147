"""SIFT Component D -- the algebraic CRC verifier (plan_bitstream_analysis.md Sec 4.5),
deliberately not learned.

A CRC is an exact linear-algebraic relationship over GF(2), not a statistical pattern: it is a
proof obligation. So the field tagger (tagger.py) may PROPOSE a CRC region; only this module
PROVES one, by searching a standard catalogue and validating on held-out frames with reliability
gating -- a frame with a residual error fails an exact CRC check even under the correct
parameters, so only frames whose CRC-scope bits are all above a confidence floor are evaluated.
This reliability gating is what makes CRC recovery survive residual errors at all (plan's own
words: "the single clearest demonstration of the plan's central claim").

Covers exactly the six parameters 147.txt Sec 19 names: polynomial, initial value, reflection
(in/out), XOR-out, CRC position, frame length (the last two come from the caller's scope
arguments, set by folding.py's Tier 1 pipeline or the tagger's proposal).

Also implements additive/XOR/Fletcher checksums (Sec 4.5: "not every integrity field is a CRC,
and a system that only tests CRCs will report 'no CRC' on a stream with a simple checksum" --
this was previously missing and is the fix).
"""
from __future__ import annotations

import numpy as np

CRC_CATALOGUE = {
    "CRC-16/CCITT-FALSE": dict(width=16, poly=0x1021, init=0xFFFF, refin=False, refout=False, xorout=0x0000),
    "CRC-16/XMODEM": dict(width=16, poly=0x1021, init=0x0000, refin=False, refout=False, xorout=0x0000),
    "CRC-16/MODBUS": dict(width=16, poly=0x8005, init=0xFFFF, refin=True, refout=True, xorout=0x0000),
    "CRC-8/SMBUS": dict(width=8, poly=0x07, init=0x00, refin=False, refout=False, xorout=0x00),
    "CRC-32/ISO-HDLC": dict(
        width=32, poly=0x04C11DB7, init=0xFFFFFFFF, refin=True, refout=True, xorout=0xFFFFFFFF
    ),
}


def _reflect_bits(bits: np.ndarray) -> np.ndarray:
    return bits[::-1]


def compute_crc(payload_bits: np.ndarray, spec: dict) -> np.ndarray:
    """Bit-by-bit CRC over an arbitrary-width catalogue spec (poly/init/refin/refout/xorout)."""
    width, poly, init = spec["width"], spec["poly"], spec["init"]
    bits = _reflect_bits(payload_bits) if spec["refin"] else payload_bits
    byte_len = (len(bits) + 7) // 8
    padded = np.concatenate([bits, np.zeros(byte_len * 8 - len(bits), dtype=bits.dtype)])
    crc = init
    top_bit = 1 << (width - 1)
    mask = (1 << width) - 1
    for byte_start in range(0, len(padded), 8):
        byte_val = int(np.packbits(padded[byte_start : byte_start + 8].astype(np.uint8))[0])
        shift = width - 8
        crc ^= (byte_val << shift) & mask if shift >= 0 else byte_val >> (-shift)
        for _ in range(8):
            crc = ((crc << 1) ^ poly) & mask if crc & top_bit else (crc << 1) & mask
    if spec["refout"]:
        crc = int(f"{crc:0{width}b}"[::-1], 2)
    crc ^= spec["xorout"]
    return np.array([(crc >> (width - 1 - i)) & 1 for i in range(width)], dtype=np.uint8)


def recover_crc_params(
    bit_mat: np.ndarray,
    rel_mat: np.ndarray,
    payload_start: int,
    payload_end: int,
    crc_start: int,
    crc_end: int,
    reliability_floor: float = 0.5,
    min_pass_frac: float = 0.9,
) -> tuple | None:
    """plan Sec 4.5: search the catalogue, reliability-gate, accept only if the relation holds
    on >= min_pass_frac of frames whose CRC-scope bits are all confidently decoded.
    Returns (name, pass_frac, n_pass, n_reliable, n_frames) or None if nothing verifies."""
    if payload_end <= payload_start or crc_end <= crc_start:
        return None
    n_frames = bit_mat.shape[0]
    payload = ((bit_mat[:, payload_start:payload_end] + 1) / 2).astype(np.uint8)
    crc_actual = ((bit_mat[:, crc_start:crc_end] + 1) / 2).astype(np.uint8)
    scope_rel = np.minimum(
        rel_mat[:, payload_start:payload_end].min(axis=1),
        rel_mat[:, crc_start:crc_end].min(axis=1),
    )
    reliable_frames = scope_rel >= reliability_floor

    best = None
    for name, spec in CRC_CATALOGUE.items():
        if crc_end - crc_start != spec["width"]:
            continue
        n_reliable = reliable_frames.sum()
        if n_reliable == 0:
            continue
        n_pass = sum(
            1
            for f in np.where(reliable_frames)[0]
            if np.array_equal(compute_crc(payload[f], spec), crc_actual[f])
        )
        pass_frac = n_pass / n_reliable
        if pass_frac >= min_pass_frac and (best is None or pass_frac > best[1]):
            best = (name, pass_frac, n_pass, int(n_reliable), n_frames)
    return best


# ------------------------------------------------------------------------------------------
# Additive / XOR / Fletcher checksums (Sec 4.5: "also required" -- not every integrity field
# is a CRC).
# ------------------------------------------------------------------------------------------

def compute_additive_checksum(payload_bytes: np.ndarray, width: int = 8) -> int:
    """Sum of bytes mod 2^width."""
    return int(payload_bytes.astype(np.uint32).sum()) % (1 << width)


def compute_xor_checksum(payload_bytes: np.ndarray) -> int:
    """XOR (LRC) of bytes."""
    return int(np.bitwise_xor.reduce(payload_bytes.astype(np.uint8))) if len(payload_bytes) else 0


def compute_fletcher16(payload_bytes: np.ndarray) -> int:
    """Fletcher-16 checksum, standard two-accumulator form (mod 255)."""
    s1 = s2 = 0
    for b in payload_bytes.astype(np.uint32):
        s1 = (s1 + int(b)) % 255
        s2 = (s2 + s1) % 255
    return (s2 << 8) | s1


CHECKSUM_CATALOGUE = {
    "additive-8": (compute_additive_checksum, 8),
    "additive-16": (lambda b: compute_additive_checksum(b, 16), 16),
    "xor-8": (compute_xor_checksum, 8),
    "fletcher-16": (compute_fletcher16, 16),
}


def _bits_to_bytes(bits: np.ndarray) -> np.ndarray:
    byte_len = (len(bits) + 7) // 8
    padded = np.concatenate([bits, np.zeros(byte_len * 8 - len(bits), dtype=bits.dtype)])
    return np.packbits(padded.astype(np.uint8))


def recover_checksum_params(
    bit_mat: np.ndarray,
    rel_mat: np.ndarray,
    payload_start: int,
    payload_end: int,
    sum_start: int,
    sum_end: int,
    reliability_floor: float = 0.5,
    min_pass_frac: float = 0.9,
) -> tuple | None:
    """Same reliability-gated search as recover_crc_params, but over the additive/XOR/Fletcher
    catalogue instead of CRCs. Returns (name, pass_frac, n_pass, n_reliable, n_frames) or None."""
    if payload_end <= payload_start or sum_end <= sum_start:
        return None
    n_frames = bit_mat.shape[0]
    payload = ((bit_mat[:, payload_start:payload_end] + 1) / 2).astype(np.uint8)
    checksum_actual = ((bit_mat[:, sum_start:sum_end] + 1) / 2).astype(np.uint8)
    scope_rel = np.minimum(
        rel_mat[:, payload_start:payload_end].min(axis=1),
        rel_mat[:, sum_start:sum_end].min(axis=1),
    )
    reliable_frames = scope_rel >= reliability_floor
    sum_width = sum_end - sum_start

    best = None
    for name, (fn, width) in CHECKSUM_CATALOGUE.items():
        if width != sum_width:
            continue
        n_reliable = reliable_frames.sum()
        if n_reliable == 0:
            continue
        n_pass = 0
        for f in np.where(reliable_frames)[0]:
            payload_bytes = _bits_to_bytes(payload[f])
            predicted = fn(payload_bytes)
            actual = int("".join(str(x) for x in checksum_actual[f]), 2)
            if predicted == actual:
                n_pass += 1
        pass_frac = n_pass / n_reliable
        if pass_frac >= min_pass_frac and (best is None or pass_frac > best[1]):
            best = (name, pass_frac, n_pass, int(n_reliable), n_frames)
    return best


def demo():
    rng = np.random.default_rng(0)
    payload = rng.integers(0, 2, size=72).astype(np.uint8)
    crc = compute_crc(payload, CRC_CATALOGUE["CRC-16/CCITT-FALSE"])
    assert len(crc) == 16

    payload_bytes = _bits_to_bytes(payload)
    add8 = compute_additive_checksum(payload_bytes)
    xor8 = compute_xor_checksum(payload_bytes)
    fl16 = compute_fletcher16(payload_bytes)
    assert 0 <= add8 < 256 and 0 <= xor8 < 256 and 0 <= fl16 < 65536
    print(f"demo() OK: CRC-16 sample={crc}, additive8={add8}, xor8={xor8}, fletcher16={fl16}")


if __name__ == "__main__":
    demo()
