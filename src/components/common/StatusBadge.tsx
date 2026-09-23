type BadgeStatus = 'completed' | 'processing' | 'warning' | 'error' | 'pending' | 'idle' | 'ready';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={`status-badge ${status}`}
      style={size === 'sm' ? { fontSize: '0.62rem', padding: '1px 6px' } : undefined}
    >
      <span className="dot" />
      {label}
    </span>
  );
}

export type { BadgeStatus };
