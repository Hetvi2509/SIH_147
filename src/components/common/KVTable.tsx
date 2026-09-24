import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type Tone = 'default' | 'good' | 'warn' | 'bad' | 'accent';

const TONE: Record<Tone, string> = {
  default: 'text-foreground',
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-destructive',
  accent: 'text-primary',
};

export type KVRow = [label: string, value: ReactNode, tone?: Tone];

/** Label / value list on the shadcn Table primitive. Values right-aligned with tabular figures. */
export default function KVTable({ rows, className }: { rows: KVRow[]; className?: string }) {
  return (
    <Table className={className}>
      <TableBody>
        {rows.map(([label, value, tone = 'default']) => (
          <TableRow key={label} className="hover:bg-transparent">
            <TableCell className="py-2.5 ps-0 text-[14.5px] text-muted-foreground">{label}</TableCell>
            <TableCell className={cn('tnum py-2.5 pe-0 text-end text-[14.5px] font-medium', TONE[tone])}>{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
