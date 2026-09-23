import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { DemodulationResult } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { formatBER, formatSamples } from '../../utils/formatters';

interface DemodPanelProps {
  demod: DemodulationResult;
}

const STATUS_CONFIG = {
  successful: { label: 'Demodulation Successful', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle },
  failed: { label: 'Demodulation Failed', color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: XCircle },
  uncertain: { label: 'Demodulation Configuration Uncertain', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle },
  unsupported: { label: 'Unsupported / Unknown Waveform', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle },
  'sync-required': { label: 'Synchronization Required', color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: XCircle },
};

export default function DemodPanel({ demod }: DemodPanelProps) {
  const cfg = STATUS_CONFIG[demod.status] ?? STATUS_CONFIG['uncertain'];
  const Icon = cfg.icon;

  return (
    <div>
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: cfg.bg, borderRadius: 'var(--radius-md)', border: `1px solid ${cfg.color}55` }}>
        <Icon size={16} style={{ color: cfg.color }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </div>

      {/* Detected info */}
      <div className="card card-sm" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Demodulator Configuration</span>
        </div>
        <table className="kv-table">
          <tbody>
            <tr><td>Detected Modulation</td><td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{demod.detectedModulation}</td></tr>
            <tr><td>Demodulator</td><td>{demod.demodulatorFamily}</td></tr>
            <tr><td>Status</td><td>
              <StatusBadge status={demod.status === 'successful' ? 'completed' : demod.status === 'uncertain' ? 'warning' : 'error'} label={demod.status.toUpperCase()} size="sm" />
            </td></tr>
          </tbody>
        </table>
      </div>

      {/* Recovery results */}
      {demod.status === 'successful' && (
        <div className="card card-sm" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <span className="card-title">Recovered Data</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '4px 0' }}>
            {[
              { label: 'Recovered Symbols', value: formatSamples(demod.recoveredSymbols), color: 'var(--accent-cyan)' },
              { label: 'Recovered Bits', value: formatSamples(demod.recoveredBits), color: 'var(--accent-cyan)' },
              { label: 'BER (Before Decoding)', value: formatBER(demod.berBeforeDecoding), color: 'var(--color-warning)' },
              { label: 'BER (After Decoding)', value: demod.berAfterDecoding != null ? formatBER(demod.berAfterDecoding) : 'N/A', color: 'var(--color-success)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncertainty notice */}
      {(demod.status === 'uncertain' || demod.status === 'unsupported') && (
        <div style={{ padding: '8px 12px', background: 'var(--color-warning-bg)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-warning)' }}>
          <HelpCircle size={12} style={{ display: 'inline', marginRight: 6 }} />
          {demod.status === 'uncertain'
            ? 'Demodulation configuration is uncertain. Insufficient signal information to determine correct demodulator parameters. Manual configuration may be required.'
            : 'This waveform type is not currently supported by the demodulator.'
          }
        </div>
      )}
    </div>
  );
}
