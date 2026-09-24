import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'good' | 'warn' | 'bad' | 'accent';
const TONE: Record<Tone, string> = { default: '', good: 'text-success', warn: 'text-warning', bad: 'text-destructive', accent: 'text-primary' };

export type InstrumentRow = [label: string, value: string, tone?: Tone];
export interface InstrumentGroup { title: string; rows: InstrumentRow[] }

/** Splits "2.450 MHz" / "+2.8 kHz" / "+13.4°" into value and unit so the number carries the weight. */
function Reading({ text, tone = 'default' }: { text: string; tone?: Tone }) {
  const m = text.match(/^([+\-−]?[\d.,]+)\s*(.*)$/);
  if (!m) return <span className={cn('text-[15px] font-medium', TONE[tone])}>{text}</span>;
  return (
    <>
      <span className={cn('display-num text-[20px]', TONE[tone])}>{m[1]}</span>
      {m[2] && <span className="ms-1 text-[12.5px] text-muted-foreground">{m[2]}</span>}
    </>
  );
}

function Group({ group }: { group: InstrumentGroup }) {
  return (
    <div className="min-w-0 px-0 md:px-6 md:first:ps-0 md:last:pe-0">
      <div className="label-caps pb-3">{group.title}</div>
      <dl>
        {group.rows.map(([k, v, tone], i) => (
          <div key={k} className={cn('flex items-baseline justify-between gap-4 whitespace-nowrap py-3', i > 0 && 'border-t border-border/70')}>
            <dt className="text-[14px] text-muted-foreground">{k}</dt>
            <dd className="tnum"><Reading text={v} tone={tone} /></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface InstrumentPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  groups: InstrumentGroup[];
  className?: string;
}

/** One measurement panel with labelled groups in columns. The dashboard's parameter panel, reusable. */
export default function InstrumentPanel({ title, description, action, groups, className }: InstrumentPanelProps) {
  const n = Math.min(groups.length, 3);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>
        <div
          className={cn('grid gap-6 md:gap-0 md:divide-x md:divide-border', n === 1 && 'md:grid-cols-1', n === 2 && 'md:grid-cols-2', n === 3 && 'md:grid-cols-3')}
        >
          {groups.map((g) => <Group key={g.title} group={g} />)}
        </div>
      </CardContent>
    </Card>
  );
}
