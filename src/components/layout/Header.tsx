import { useNavigate } from 'react-router-dom';
import { Upload, Bell, Settings, Radio } from 'lucide-react';
import { useAnalysis } from '../../context/AnalysisContext';
import StatusBadge from '../common/StatusBadge';

export default function Header() {
  const { state } = useAnalysis();
  const navigate = useNavigate();

  const systemStatus = (() => {
    switch (state.overallStatus) {
      case 'idle':      return { label: 'SYSTEM READY',   status: 'ready'      as const };
      case 'uploading': return { label: 'UPLOADING',      status: 'processing' as const };
      case 'analyzing': return { label: 'ANALYZING',      status: 'processing' as const };
      case 'completed': return { label: 'COMPLETE',       status: 'completed'  as const };
      case 'error':     return { label: 'ERROR',          status: 'error'      as const };
      default:          return { label: 'SYSTEM READY',   status: 'ready'      as const };
    }
  })();

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-logo">
        <div className="header-logo-icon">
          <Radio size={15} color="#90b8de" />
        </div>
        <div className="header-title-group">
          <div className="header-title">Automated Signal Analysis Dashboard</div>
          <div className="header-subtitle">.IQ / .WAV Signal Analysis & Classification</div>
        </div>
      </div>

      <div className="header-sep" />

      {/* Current file */}
      <div className="header-file-info">
        {state.fileMetadata ? (
          <>
            <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
              File
            </span>
            <span
              className="header-file-name"
              title={state.fileMetadata.fileName}
            >
              {state.fileMetadata.fileName}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {state.fileMetadata.format}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No file loaded
          </span>
        )}
      </div>

      {/* Status */}
      <StatusBadge status={systemStatus.status} label={systemStatus.label} />

      {/* Actions */}
      <div className="header-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/upload')}
        >
          <Upload size={12} />
          Upload
        </button>
        <button className="btn btn-ghost btn-icon" title="Notifications" style={{ padding: 5 }}>
          <Bell size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
        <button className="btn btn-ghost btn-icon" title="Settings" style={{ padding: 5 }}>
          <Settings size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OP</span>
        </div>
      </div>
    </header>
  );
}
