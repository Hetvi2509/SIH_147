"""Additive / XOR / Fletcher checksum recovery (plan_bitstream_analysis.md Sec 4.5, Sec 11.1).

Implementation lives in crc_recover.py alongside the CRC catalogue since both share the same
reliability-gated search machinery (recover_crc_params / recover_checksum_params differ only in
which catalogue and byte-vs-bit scoring they use) -- re-exported here under the plan's own
Sec 11.1 file name so the module layout matches exactly.
"""
from .crc_recover import (  # noqa: F401
    CHECKSUM_CATALOGUE,
    compute_additive_checksum,
    compute_fletcher16,
    compute_xor_checksum,
    recover_checksum_params,
)

demo = None  # nothing to self-check beyond crc_recover.py's own demo()
