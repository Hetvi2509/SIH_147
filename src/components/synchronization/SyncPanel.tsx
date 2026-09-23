import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import type { SyncParameters } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { formatCFO, formatPhase } from '../../utils/formatters';

interface SyncPanelProps {
  sync: SyncParameters;
}

function SyncValue({ locked, label }: { locked: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {locked
        ? <CheckCircle size={12} style={{ color: 'var(--color-success)' }} />
        : <XCircle size={12} style={{ color: 'var(--color-error)' }} />
      }
      <span style={{ color: locked ? 'var(--color-success)' : 'var(--color-error)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
        {locked ? `✓ ${label}` : `✕ ${label}`}
      </span>
    </div>
  );
}

export default function SyncPanel({ sync }: SyncPanelProps) {
  const overallLocked = sync.carrierLocked && sync.timingLocked;

  return (
    <div>
      {/* Overall status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: overallLocked ? 'var(--color-success-bg)' : 'var(--color-error-bg)', borderRadius: 'var(--radius-md)', border: `1px solid ${overallLocked ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}` }}>
        {overallLocked
          ? <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
          : <XCircle size={16} style={{ color: 'var(--color-error)' }} />
        }
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: overallLocked ? 'var(--color-success)' : 'var(--color-error)' }}>
          {overallLocked ? 'Synchronization Locked' : 'Synchronization Failed'}
        </span>
        <StatusBadge status={overallLocked ? 'completed' : 'error'} label={sync.status.toUpperCase()} size="sm" />
      </div>

      {/* Processing chain */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
          Synchronization Chain
        </div>
        {[
          { label: 'Carrier / Frequency Sync', locked: sync.carrierLocked },
          { label: 'Symbol Timing Recovery', locked: sync.timingLocked },
          { label: 'Matched Filtering', locked: sync.matchedFilterApplied },
          { label: 'Sync-Word Detection', locked: sync.syncWordDetected },
        ].map((item) => (
          <div key={item.label} className="sync-row">
            <span className="sync-key">{item.label}</span>
            <SyncValue locked={item.locked} label={item.locked ? 'Completed' : 'Failed'} />
          </div>
        ))}
      </div>

      {/* Numeric parameters */}
      <div className="card card-sm">
        <div className="card-header">
          <span className="card-title">Estimated Parameters</span>
        </div>
        <table className="kv-table">
          <tbody>
            <tr><td>CFO Estimate</td><td style={{ color: sync.cfoEstimate !== 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{formatCFO(sync.cfoEstimate)}</td></tr>
            <tr><td>Phase Offset</td><td style={{ color: 'var(--color-warning)' }}>{formatPhase(sync.phaseOffset)}</td></tr>
            <tr><td>Timing Offset</td><td>{sync.timingOffset.toFixed(1)} samples</td></tr>
            <tr><td>Carrier Locked</td><td style={{ color: sync.carrierLocked ? 'var(--color-success)' : 'var(--color-error)' }}>{sync.carrierLocked ? '✓ Yes' : '✕ No'}</td></tr>
            <tr><td>Symbol Timing Locked</td><td style={{ color: sync.timingLocked ? 'var(--color-success)' : 'var(--color-error)' }}>{sync.timingLocked ? '✓ Yes' : '✕ No'}</td></tr>
            <tr><td>Burst Detected</td><td>{sync.burstDetected ? 'Yes' : 'No'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
