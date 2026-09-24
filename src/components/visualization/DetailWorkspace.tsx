import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import ChartFrame from './ChartFrame';
import { CHARTS, CHART_ORDER, type ChartId } from './chartRegistry';

/** One plot at a time, large, with zoom tools. Complements the multi-plot grid. */
export default function DetailWorkspace({ height = 520 }: { height?: number }) {
  const [id, setId] = useState<ChartId>('spectrum');

  return (
    <div className="space-y-4">
      <Tabs value={id} onValueChange={(v) => setId(v as ChartId)}>
        <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border pb-0">
          {CHART_ORDER.map((c) => (
            <TabsTrigger key={c} value={c} className="h-10 flex-none px-3 text-[14px] after:!bottom-[-1px]">
              {CHARTS[c].title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ChartFrame key={id} id={id} height={height} detailed />
    </div>
  );
}
