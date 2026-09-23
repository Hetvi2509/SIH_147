interface ParameterCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  highlight?: boolean;
  accent?: 'success' | 'warning' | 'error' | 'info' | 'cyan';
}

const ACCENT_COLORS: Record<string, string> = {
  success: 'var(--green)',
  warning: 'var(--amber)',
  error:   'var(--red)',
  info:    'var(--blue)',
  cyan:    'var(--cyan)',
};

export default function ParameterCard({ label, value, unit, sub, highlight, accent }: ParameterCardProps) {
  const valueColor = accent ? ACCENT_COLORS[accent] : 'var(--text-primary)';

  return (
    <div className="param-card" style={highlight ? { borderColor: 'var(--border-accent)' } : undefined}>
      <div className="param-label">{label}</div>
      <div className="param-value" style={{ color: valueColor }}>
        {value}
        {unit && <span className="param-unit">{unit}</span>}
      </div>
      {sub && <div className="param-sub">{sub}</div>}
    </div>
  );
}
