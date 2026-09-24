import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { CorrelationResult } from '@/types';
import { AXIS_TICK, C } from '@/lib/chart';
import InfoTip from '@/components/common/InfoTip';
import Stat from '@/components/common/Stat';
import KVTable from '@/components/common/KVTable';
import { Separator } from '@/components/ui/separator';

const config = { value: { label: 'Correlation', color: C.orange } } satisfies ChartConfig;

export default function CorrelationPanel({ data, height = 180, compact = false }: { data: CorrelationResult; height?: number; compact?: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Correlation score" value={data.score.toFixed(3)} tone={data.detected ? 'good' : 'warn'} />
        <Stat label="Peak lag" value={data.peakLag} unit="sym" />
        <Stat label="Sidelobe ratio" value={data.sidelobeRatioDb.toFixed(1)} unit="dB" />
        <Stat label="Reference" value={data.detected ? 'Detected' : 'Not found'} tone={data.detected ? 'good' : 'warn'} />
      </div>

      <Separator className="mt-5" />

      <div className="mb-1 mt-5 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
          Normalized cross-correlation
          <InfoTip label="cross-correlation" info={{ what: 'How closely the recovered bits match the reference sequence at each lag.', use: 'confirm alignment. A sharp peak above the threshold means the stream is valid.' }} />
        </span>
        <span className="text-[12.5px] text-muted-foreground">{data.reference}</span>
      </div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <LineChart data={data.series} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="lag" type="number" domain={[-64, 64]} ticks={[-64, -32, 0, 32, 64]} tickLine={false} axisLine={{ stroke: C.axis }} tick={AXIS_TICK} label={{ value: 'Lag (symbols)', position: 'insideBottom', offset: -2, fill: C.label, fontSize: 12 }} height={36} />
          <YAxis domain={[0, 1]} width={36} tickLine={false} axisLine={{ stroke: C.axis }} tick={AXIS_TICK} />
          <ChartTooltip cursor={{ stroke: C.axis }} content={<ChartTooltipContent labelFormatter={(_, p) => `lag ${p?.[0]?.payload?.lag}`} />} />
          <ReferenceLine y={data.threshold} stroke={C.amber} strokeDasharray="4 4" label={{ value: 'threshold', position: 'insideTopRight', fill: C.amber, fontSize: 11 }} />
          <Line dataKey="value" type="linear" stroke="var(--color-value)" strokeWidth={1.6} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>

      {!compact && (
        <KVTable className="mt-3" rows={[
          ['Reference sequence', data.reference],
          ['Detection threshold', data.threshold.toFixed(2)],
          ['Peak correlation', data.score.toFixed(3), data.detected ? 'good' : 'warn'],
        ]} />
      )}
    </div>
  );
}
