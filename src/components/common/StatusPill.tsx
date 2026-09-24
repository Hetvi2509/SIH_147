import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type PillVariant = 'success' | 'warning' | 'error' | 'active' | 'muted';

const MAP = {
  success: { badge: 'success' as const, dot: 'bg-success' },
  warning: { badge: 'warning' as const, dot: 'bg-warning' },
  error:   { badge: 'destructive' as const, dot: 'bg-white' },
  active:  { badge: 'soft' as const, dot: 'bg-primary animate-pulse' },
  muted:   { badge: 'muted' as const, dot: 'bg-muted-foreground/50' },
};

/** Small status label with a leading dot. Colour is never the only cue: the text always says the state. */
export default function StatusPill({ variant, children, className }: { variant: PillVariant; children: ReactNode; className?: string }) {
  const m = MAP[variant];
  return (
    <Badge variant={m.badge} className={cn('gap-1.5 pe-3 ps-2.5 text-[12.5px]', className)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {children}
    </Badge>
  );
}
