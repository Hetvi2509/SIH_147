// ============================================================
// RF Signal Analysis Dashboard — Number / Unit Formatters
// ============================================================

export function formatFrequency(hz: number): string {
  if (Math.abs(hz) >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (Math.abs(hz) >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (Math.abs(hz) >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

export function formatSampleRate(mss: number | undefined | null): string {
  if (mss == null || isNaN(Number(mss))) return 'N/A MS/s';
  return `${Number(mss).toFixed(1)} MS/s`;
}

export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes == null || isNaN(Number(bytes))) return 'N/A';
  const b = Number(bytes);
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(Number(seconds))) return 'N/A';
  const sec = Number(seconds);
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${m}m ${s}s`;
  }
  return `${sec.toFixed(2)} s`;
}

export function formatBER(ber: number): string {
  if (ber === 0) return '0';
  const exp = Math.floor(Math.log10(ber));
  const mantissa = ber / Math.pow(10, exp);
  return `${mantissa.toFixed(1)} × 10⁻${Math.abs(exp)}`;
}

export function formatPower(dbm: number): string {
  return `${dbm.toFixed(1)} dBm`;
}

export function formatSNR(db: number): string {
  return `${db.toFixed(1)} dB`;
}

export function formatSymbolRate(ksyms: number): string {
  if (ksyms >= 1000) return `${(ksyms / 1000).toFixed(3)} MSym/s`;
  return `${ksyms.toFixed(1)} kSym/s`;
}

export function formatCFO(khz: number): string {
  const sign = khz >= 0 ? '+' : '';
  return `${sign}${khz.toFixed(1)} kHz`;
}

export function formatPhase(deg: number): string {
  const sign = deg >= 0 ? '+' : '';
  return `${sign}${deg.toFixed(1)}°`;
}

export function formatTimestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export function formatSamples(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(p: number): string {
  return `${p.toFixed(1)}%`;
}

export function formatEVM(evm: number): string {
  return `${evm.toFixed(1)}% RMS`;
}
