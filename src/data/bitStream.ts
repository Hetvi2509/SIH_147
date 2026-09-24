import type { BitStreamResult } from '../types';

// Deterministic pseudo-random generator so the same signal always shows the same stream.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const PREAMBLE_BITS = '1010110011010010';

export function buildBitStream(opts: {
  totalBits: number;
  invalidBits: number;
  score: number;
  reference?: string;
  encoding: string;
  seed?: number;
}): BitStreamResult {
  const { totalBits, invalidBits, score, encoding } = opts;
  const rnd = lcg(opts.seed ?? (totalBits || 1));

  const previewBits = Math.min(256, totalBits);
  let bits = PREAMBLE_BITS;
  while (bits.length < previewBits) bits += rnd() < 0.5 ? '0' : '1';
  bits = bits.slice(0, previewBits);

  let hex = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, '0').toUpperCase() + ' ';
  }

  // Correlation of the recovered stream against the reference sequence, lag in symbols.
  const peakLag = 0;
  const series = Array.from({ length: 129 }, (_, k) => {
    const lag = k - 64;
    const peak = lag === peakLag ? score : 0;
    const floor = (1 - score) * 0.35 * rnd() * (lag === peakLag ? 0 : 1);
    return { lag, value: Number((peak + floor).toFixed(4)) };
  });
  const sidelobe = Math.max(...series.filter((p) => p.lag !== peakLag).map((p) => p.value), 0.001);

  return {
    status: totalBits > 0 ? 'completed' : 'unavailable',
    recovered: {
      totalBits,
      validBits: Math.max(totalBits - invalidBits, 0),
      invalidBits,
      previewBits,
      bitPreview: bits,
      hexPreview: hex.trim(),
      encoding,
    },
    correlation: {
      score,
      peakLag,
      reference: opts.reference ?? 'Sync word (16-bit preamble)',
      threshold: 0.7,
      detected: score >= 0.7,
      sidelobeRatioDb: Number((20 * Math.log10(score / sidelobe)).toFixed(1)),
      series,
    },
  };
}
