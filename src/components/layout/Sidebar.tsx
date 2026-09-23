import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Upload, BarChart2, Sliders, Cpu,
  RefreshCw, Waves, Shield, FileText, Radio
} from 'lucide-react';

interface NavItem { to: string; icon: React.ReactNode; label: string; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Input',
    items: [
      { to: '/dashboard', icon: <LayoutDashboard size={14} />, label: 'Dashboard' },
      { to: '/upload',    icon: <Upload size={14} />,          label: 'File Upload' },
    ],
  },
  {
    label: 'Signal Analysis',
    items: [
      { to: '/visualizations', icon: <BarChart2 size={14} />, label: 'Visualizations' },
      { to: '/parameters',     icon: <Sliders size={14} />,   label: 'Parameters' },
    ],
  },
  {
    label: 'AI Analysis',
    items: [
      { to: '/modulation',     icon: <Cpu size={14} />,       label: 'Modulation' },
      { to: '/synchronization',icon: <RefreshCw size={14} />, label: 'Synchronization' },
      { to: '/demodulation',   icon: <Waves size={14} />,     label: 'Demodulation' },
    ],
  },
  {
    label: 'Decoding',
    items: [
      { to: '/fec', icon: <Shield size={14} />, label: 'FEC / Interleaver' },
    ],
  },
  {
    label: 'Output',
    items: [
      { to: '/report', icon: <FileText size={14} />, label: 'Report' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Radio size={11} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            rf-ai / v1.0
          </span>
        </div>
      </div>
    </aside>
  );
}
