import type { ReactNode } from 'react';
import { CheckCircle, Circle, SpinnerGap, WarningCircle, XCircle } from '@phosphor-icons/react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StepStatus = 'done' | 'running' | 'warning' | 'failed' | 'pending';
export interface Step { name: string; status: StepStatus; note?: string; time?: string }

function Mark({ status }: { status: StepStatus }) {
  const c = 'size-[18px]';
  switch (status) {
    case 'done':    return <CheckCircle weight="fill" className={cn(c, 'text-success')} />;
    case 'running': return <SpinnerGap className={cn(c, 'animate-spin text-primary')} />;
    case 'warning': return <WarningCircle weight="fill" className={cn(c, 'text-warning')} />;
    case 'failed':  return <XCircle weight="fill" className={cn(c, 'text-destructive')} />;
    default:        return <Circle weight="bold" className={cn(c, 'text-border')} />;
  }
}

/** Vertical stage list with a connector. Used for pipeline progress, recovery chains and provenance. */
export default function Timeline({ title, description, meta, steps, className }: {
  title: string; description?: string; meta?: ReactNode; steps: Step[]; className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {meta && <CardAction><span className="tnum text-[13px] text-muted-foreground">{meta}</span></CardAction>}
      </CardHeader>
      <CardContent>
        <ol>
          {steps.map((s, i) => (
            <li key={s.name} className="relative flex items-start gap-3 py-[5px]">
              {i < steps.length - 1 && (
                <span aria-hidden className={cn('absolute start-[8.5px] top-[26px] h-[calc(100%-8px)] w-px', s.status === 'done' ? 'bg-success/40' : 'bg-border')} />
              )}
              <span className="relative z-10 mt-px grid size-[18px] place-items-center bg-card"><Mark status={s.status} /></span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[14px]', s.status === 'pending' ? 'text-muted-foreground' : 'text-foreground', s.status === 'running' && 'font-medium text-primary')}>{s.name}</span>
                {s.note && <span className="block text-[12.5px] text-muted-foreground">{s.note}</span>}
              </span>
              {s.time && <span className="tnum pt-0.5 text-[12.5px] text-muted-foreground">{s.time}</span>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
