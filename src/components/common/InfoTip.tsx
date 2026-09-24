import { Info } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface GraphInfo { what: string; use: string }

/** Small info icon beside a graph title. Hover or focus shows what the graph is and why the app uses it. */
export default function InfoTip({ info, label }: { info: GraphInfo; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground/70 outline-none transition-colors duration-150 hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info weight="bold" className="size-[15px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[17rem] space-y-1.5 px-3 py-2.5 text-[12.5px] leading-snug">
        <p><span className="font-medium">What it shows.</span> {info.what}</p>
        <p><span className="font-medium">Used here to</span> {info.use}</p>
      </TooltipContent>
    </Tooltip>
  );
}
