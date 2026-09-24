import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  tone?: 'default' | 'good' | 'warn' | 'accent';
  className?: string;
  children?: ReactNode;
}

const SIZE = { md: 'text-[22px]', lg: 'text-[28px]', xl: 'text-[42px]' };
const TONE = { default: '', good: 'text-success', warn: 'text-warning', accent: 'text-primary' };

/** One measured value. Display face for the number, Inter for the label and unit. */
export default function Stat({ label, value, unit, note, size = 'md', tone = 'default', className, children }: StatProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={cn('display-num mt-1.5 whitespace-nowrap', SIZE[size], TONE[tone])}>
        {value}
        {unit && <span className="ms-1 font-sans text-[13px] tracking-normal text-muted-foreground">{unit}</span>}
      </div>
      {children}
      {note && <div className="mt-1.5 text-[12.5px] text-muted-foreground">{note}</div>}
    </div>
  );
}
