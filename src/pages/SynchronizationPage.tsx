import { RefreshCw } from 'lucide-react';
import { useAnalysis } from '../context/AnalysisContext';
import SyncPanel from '../components/synchronization/SyncPanel';
import FreqVsTime from '../components/visualization/FreqVsTime';
import PhaseVsTime from '../components/visualization/PhaseVsTime';
import StatusBadge from '../components/common/StatusBadge';

export default function SynchronizationPage() {
  const { state } = useAnalysis();
  const { sync } = state;

  if (!sync) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-title">No synchronization data</div>
          <div className="empty-state-desc">Analyze a signal to run synchronization.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title"><RefreshCw size={18} style={{ color: 'var(--accent-blue)' }} /> Synchronization</div>
          <div className="page-subtitle">Carrier recovery, timing synchronization, and matched filtering</div>
        </div>
        <StatusBadge status={sync.status === 'completed' ? 'completed' : 'warning'} label={sync.status.toUpperCase()} />
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <SyncPanel sync={sync} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Processing chain description */}
          <div className="card card-sm">
            <div className="card-header">
              <span className="card-title">Synchronization Pipeline</span>
            </div>
            {[
              { step: 1, name: 'Carrier / Frequency Synchronization', done: sync.carrierLocked, desc: 'CFO estimation and correction' },
              { step: 2, name: 'Symbol Timing Recovery', done: sync.timingLocked, desc: 'Gardner/Müller-Müller timing loop' },
              { step: 3, name: 'Matched Filtering', done: sync.matchedFilterApplied, desc: 'Root raised cosine filter applied' },
              { step: 4, name: 'Demodulation', done: true, desc: 'Coherent detection' },
              { step: 5, name: 'Sync-Word Detection', done: sync.syncWordDetected, desc: 'Preamble/header correlation' },
            ].map(({ step, name, done, desc }) => (
              <div key={step} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-mono)', background: done ? 'var(--color-success-bg)' : 'var(--bg-panel)', border: `1px solid ${done ? 'rgba(76,175,80,0.4)' : 'var(--border-subtle)'}`, color: done ? 'var(--color-success)' : 'var(--text-muted)', marginTop: 1 }}>
                  {done ? '✓' : step}
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', color: done ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: done ? 500 : 400 }}>{name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="flex-col">
        <FreqVsTime height={220} />
        <PhaseVsTime height={220} />
      </div>
    </div>
  );
}
