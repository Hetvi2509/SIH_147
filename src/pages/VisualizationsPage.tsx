import { useState } from 'react';
import { ChartLineUp } from '@phosphor-icons/react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import SectionHeading from '@/components/common/SectionHeading';
import SummaryBar from '@/components/common/SummaryBar';
import NextStep from '@/components/common/NextStep';
import AnalysisGrid from '@/components/visualization/AnalysisGrid';
import DetailWorkspace from '@/components/visualization/DetailWorkspace';
import { CHART_ORDER } from '@/components/visualization/chartRegistry';
import { useAnalysis } from '@/context/AnalysisContext';
import { formatSampleRate, formatSamples } from '@/utils/formatters';

export default function VisualizationsPage() {
  const { state } = useAnalysis();
  const [view, setView] = useState<'grid' | 'detail'>('grid');
  const meta = state.fileMetadata;
  const p = state.parameters;

  if (!meta) {
    return (
      <>
        <PageHeader title="Visualizations" />
        <EmptyState icon={<ChartLineUp weight="duotone" />} title="No signal loaded" description="Load an IQ recording on the dashboard to see its waveform, spectrum, spectrogram and constellation." />
      </>
    );
  }

  const dur = meta.duration;
  const segLen = state.segmentEnd - state.segmentStart;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="pb-8">
      <PageHeader
        title="Visualizations"
        description={`Every domain of ${meta.fileName}, side by side.`}
        actions={
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as 'grid' | 'detail')} aria-label="View mode">
            <ToggleGroupItem value="grid" className="px-4">Grid</ToggleGroupItem>
            <ToggleGroupItem value="detail" className="px-4">Detail</ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <div className="space-y-4">
        <SummaryBar items={[
          { key: 'fs', label: 'Sample rate', value: formatSampleRate(meta.sampleRate).replace(/\s*MS\/s/, ''), unit: 'MS/s' },
          { key: 'n', label: 'Samples', value: formatSamples(meta.numSamples) },
          { key: 'dur', label: 'Duration', value: dur.toFixed(2), unit: 's' },
          { key: 'fc', label: 'Center frequency', value: p ? p.centerFrequency.toFixed(3) : '—', unit: 'MHz', tone: 'accent' },
          { key: 'seg', label: 'Segment', value: segLen.toFixed(2), unit: 's', note: `${state.segmentStart.toFixed(2)} to ${state.segmentEnd.toFixed(2)} s` },
        ]} />

        <Card className="pb-10">
          <CardHeader>
            <CardTitle>Signal timeline</CardTitle>
            <CardDescription>The highlighted region is what every plot below shows.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-8 rounded-lg bg-secondary">
              <div
                className="absolute inset-y-0 rounded-lg bg-primary/15 ring-1 ring-inset ring-primary/40"
                style={{ left: `${(state.segmentStart / dur) * 100}%`, width: `${(segLen / dur) * 100}%` }}
              />
              {ticks.map((t) => (
                <div key={t} className="absolute inset-y-0 border-s border-border" style={{ left: `${t * 100}%` }}>
                  <span className={`tnum absolute top-9 text-[12px] text-muted-foreground ${t === 0 ? '' : t === 1 ? '-translate-x-full' : '-translate-x-1/2'}`}>
                    {(t * dur).toFixed(2)} s
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <SectionHeading
          title={view === 'grid' ? 'All views' : 'Detail view'}
          description={view === 'grid' ? 'Open any plot for zoom tools.' : 'One plot at a time, large, with zoom.'}
        />
        {view === 'grid' ? <AnalysisGrid charts={CHART_ORDER} cellHeight={230} /> : <DetailWorkspace />}
      </section>

      <NextStep to="/parameters" label="Parameters" description="See the measurements behind these plots." />
    </div>
  );
}
