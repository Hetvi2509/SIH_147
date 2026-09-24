import type { ReactNode } from 'react';
import { ArrowsOut, MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAnalysis } from '@/context/AnalysisContext';
import { useZoom } from '@/lib/chart';
import { CHARTS, type ChartId } from './chartRegistry';
import { cn } from '@/lib/utils';

interface ChartFrameProps {
  id: ChartId;
  height: number;
  /** Detail view: shows zoom tools. In the grid only the expand action is offered. */
  detailed?: boolean;
  onExpand?: () => void;
  className?: string;
  trailing?: ReactNode;
}

export default function ChartFrame({ id, height, detailed = false, onExpand, className, trailing }: ChartFrameProps) {
  const { state } = useAnalysis();
  const def = CHARTS[id];
  const zoom = useZoom();
  const meta = def.meta(state.parameters);
  const Plot = def.Plot;

  return (
    <figure className={cn('group/chart flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card smooth-shadow-ring-xs', className)}>
      <figcaption className="flex items-start justify-between gap-3 px-4 pb-1 pt-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] leading-tight tracking-[-0.01em]">{def.title}</h3>
          <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] leading-5">
            {meta.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tnum font-medium text-foreground/90">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {detailed && def.zoomable && (
            <>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={zoom.zoomIn} aria-label="Zoom in"><MagnifyingGlassPlus /></Button>
              </TooltipTrigger><TooltipContent>Zoom in</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={zoom.zoomOut} aria-label="Zoom out"><MagnifyingGlassMinus /></Button>
              </TooltipTrigger><TooltipContent>Zoom out</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={zoom.reset} disabled={!zoom.zoomed} aria-label="Reset zoom"><ArrowCounterClockwise /></Button>
              </TooltipTrigger><TooltipContent>Reset view</TooltipContent></Tooltip>
            </>
          )}
          {trailing}
          {onExpand && (
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label={`Open ${def.title} in detail view`}><ArrowsOut /></Button>
            </TooltipTrigger><TooltipContent>Open detail view</TooltipContent></Tooltip>
          )}
        </div>
      </figcaption>

      <div className="px-1 pb-2 pt-1">
        <Plot height={height} zoom={zoom.win} fc={state.parameters?.centerFrequency} />
      </div>
    </figure>
  );
}
