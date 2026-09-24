import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Stat from '@/components/common/Stat';
import { cn } from '@/lib/utils';

export interface SummaryItem {
  key: string;
  label: string;
  value?: ReactNode;
  unit?: string;
  tone?: 'default' | 'good' | 'warn' | 'accent';
  note?: ReactNode;
  /** 0-100. Renders a thin meter under the value. */
  meter?: number;
  /** Replaces the Stat entirely, for cells like a status pill or the hero modulation. */
  custom?: ReactNode;
  /** Relative width. Default 1. */
  grow?: number;
}

/**
 * The strip at the top of every results page: the handful of numbers a reader needs first.
 * Cells are divided by 1px gaps over a border-coloured backdrop, so dividers stay correct
 * however the row wraps.
 */
export default function SummaryBar({ items }: { items: SummaryItem[] }) {
  const cols = items.map((i) => `minmax(0,${i.grow ?? 1}fr)`).join(' ');
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div
        className="grid gap-px bg-border sm:grid-cols-2 xl:[grid-template-columns:var(--cols)]"
        style={{ ['--cols' as string]: cols }}
      >
        {items.map((i) => (
          <div key={i.key} className={cn('bg-card px-5 py-5', items.length % 2 === 1 && i === items[items.length - 1] && 'sm:col-span-2 xl:col-span-1')}>
            {i.custom ?? (
              <Stat label={i.label} value={i.value ?? '—'} unit={i.value != null && i.value !== '—' ? i.unit : undefined} tone={i.tone} size="lg" note={i.note}>
                {i.meter != null && <Progress value={i.meter} className="mt-3 h-1" />}
              </Stat>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
