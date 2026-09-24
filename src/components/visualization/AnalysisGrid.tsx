import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import ChartFrame from './ChartFrame';
import { CHARTS, type ChartId } from './chartRegistry';

export type { ChartId };

const DEFAULT: ChartId[] = ['iq', 'spectrum', 'waterfall', 'constellation', 'eye', 'freq-time'];

interface AnalysisGridProps {
  charts?: ChartId[];
  cellHeight?: number;
}

/** Compact multi-plot workspace. Any plot opens in a large detail view with zoom tools. */
export default function AnalysisGrid({ charts = DEFAULT, cellHeight = 200 }: AnalysisGridProps) {
  const [open, setOpen] = useState<ChartId | null>(null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {charts.map((id) => (
          <ChartFrame key={id} id={id} height={cellHeight} onExpand={() => setOpen(id)} />
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent showCloseButton className="w-[min(1100px,calc(100vw-2rem))] max-w-none gap-0 border-0 bg-transparent p-0 shadow-none sm:max-w-none" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{open ? CHARTS[open].title : 'Chart'}</DialogTitle>
          <DialogDescription className="sr-only">Detail view with zoom tools</DialogDescription>
          {open && <ChartFrame id={open} height={Math.round(Math.min(560, window.innerHeight * 0.6))} detailed className="smooth-shadow-ring-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
