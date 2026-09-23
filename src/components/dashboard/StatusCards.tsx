import {
  FileText, Radio, Activity, Cpu, RefreshCw, Waves, Shield, BarChart2
} from 'lucide-react';
import { useAnalysis } from '../../context/AnalysisContext';
import { useNavigate } from 'react-router-dom';

interface StatusCardDef {
  label: string;
  icon: React.ReactNode;
  getValue: (state: ReturnType<typeof useAnalysis>['state']) => string;
  getStatus: (state: ReturnType<typeof useAnalysis>['state']) => 'completed' | 'processing' | 'warning' | 'error' | 'pending';
  route: string;
}

const CARDS: StatusCardDef[] = [
  {
    label: 'File',
    icon: <FileText size={14} />,
    getValue: (s) => s.fileMetadata ? s.fileMetadata.fileType : 'None',
    getStatus: (s) => s.fileMetadata ? 'completed' : 'pending',
    route: '/upload',
  },
  {
    label: 'Signal',
    icon: <Activity size={14} />,
    getValue: (s) => s.parameters ? 'Detected' : '—',
    getStatus: (s) => s.parameters ? 'completed' : 'pending',
    route: '/visualizations',
  },
  {
    label: 'Parameters',
    icon: <Radio size={14} />,
    getValue: (s) => s.parameters ? 'Extracted' : '—',
    getStatus: (s) => s.parameters ? 'completed' : 'pending',
    route: '/parameters',
  },
  {
    label: 'Modulation',
    icon: <Cpu size={14} />,
    getValue: (s) => s.classification?.modulation ?? '—',
    getStatus: (s) => s.classification?.status === 'completed' ? 'completed' : s.classification?.status === 'running' ? 'processing' : 'pending',
    route: '/modulation',
  },
  {
    label: 'Sync',
    icon: <RefreshCw size={14} />,
    getValue: (s) => s.sync?.carrierLocked ? 'Locked' : s.sync ? 'Unlocked' : '—',
    getStatus: (s) => s.sync?.carrierLocked ? 'completed' : s.sync ? 'error' : 'pending',
    route: '/synchronization',
  },
  {
    label: 'Demod',
    icon: <Waves size={14} />,
    getValue: (s) => s.demodulation?.status === 'successful' ? 'OK' : s.demodulation ? 'Failed' : '—',
    getStatus: (s) => s.demodulation?.status === 'successful' ? 'completed' : s.demodulation ? 'error' : 'pending',
    route: '/demodulation',
  },
  {
    label: 'FEC',
    icon: <Shield size={14} />,
    getValue: (s) => s.fec?.detected === true ? s.fec.family : s.fec?.detected === false ? 'None' : '—',
    getStatus: (s) => s.fec?.detected === true ? 'completed' : s.fec?.detected === false ? 'warning' : 'pending',
    route: '/fec',
  },
  {
    label: 'Report',
    icon: <BarChart2 size={14} />,
    getValue: (s) => s.overallStatus === 'completed' ? 'Ready' : '—',
    getStatus: (s) => s.overallStatus === 'completed' ? 'completed' : 'pending',
    route: '/report',
  },
];

const VALUE_COLORS: Record<string, string> = {
  completed: '#5cb87a',
  error:     'var(--red)',
  warning:   'var(--amber)',
  processing:'var(--cyan)',
  pending:   'var(--text-muted)',
};

export default function StatusCards() {
  const { state } = useAnalysis();
  const navigate = useNavigate();

  return (
    <div className="status-grid">
      {CARDS.map((card) => {
        const status = card.getStatus(state);
        const value  = card.getValue(state);
        return (
          <div
            key={card.label}
            className={`status-card ${status}`}
            onClick={() => navigate(card.route)}
            title={`Go to ${card.label}`}
          >
            <div
              className="status-card-icon"
              style={{ color: VALUE_COLORS[status] ?? 'var(--text-muted)' }}
            >
              {card.icon}
            </div>
            <div className="status-card-info">
              <div className="status-card-label">{card.label}</div>
              <div
                className="status-card-value"
                style={{ color: VALUE_COLORS[status] }}
              >
                {value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
