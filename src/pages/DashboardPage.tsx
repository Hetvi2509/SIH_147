import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CaretRight, DownloadSimple, WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAnalysis } from '@/context/AnalysisContext';
import FileSection from '@/components/dashboard/FileSection';
import PageHeader from '@/components/common/PageHeader';
import SectionHeading from '@/components/common/SectionHeading';
import StatusPill from '@/components/common/StatusPill';
import Stat from '@/components/common/Stat';
import InstrumentPanel from '@/components/common/Instrument';
import Timeline, { type Step } from '@/components/common/Timeline';
import AnalysisGrid from '@/components/visualization/AnalysisGrid';
import RecoveredDataPanel from '@/components/bitstream/RecoveredDataPanel';
import CorrelationPanel from '@/components/bitstream/CorrelationPanel';
import { formatBER, formatCFO, formatPhase, formatSampleRate, formatSamples } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const SNR_LABEL = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function DashboardPage() {
  const { state, exportCSV, exportJSON, exportPDF } = useAnalysis();
  const navigate = useNavigate();
  const { fileMetadata: meta, parameters: p, classification: cls, sync, demodulation: demod, fec, interleaver, ber, bitStream: bs, pipeline, overallStatus } = state;

  const done = pipeline.filter((s) => s.status === 'completed').length;
  const totalMs = pipeline.reduce((t, s) => t + (s.status === 'completed' ? s.duration ?? 0 : 0), 0);
  const snrLevel = p ? Math.max(1, Math.min(5, Math.ceil(p.snr / 5))) : 0;
  const low = cls ? cls.confidence < 70 : false;

  const status =
    overallStatus === 'completed' ? { v: 'success' as const, l: 'Analysis complete' } :
    overallStatus === 'analyzing' ? { v: 'active' as const, l: 'Analyzing' } :
    overallStatus === 'error'     ? { v: 'error' as const, l: 'Analysis failed' } :
                                    { v: 'muted' as const, l: meta ? 'Not analyzed' : 'No signal' };

  const results = [
    { to: '/modulation',      name: 'Modulation',          value: cls ? `${cls.modulation} · ${cls.confidence.toFixed(1)}%` : 'Pending' },
    { to: '/synchronization', name: 'Synchronization',     value: sync ? (sync.carrierLocked && sync.timingLocked ? 'Carrier and timing locked' : 'Lock failed') : 'Pending' },
    { to: '/demodulation',    name: 'Demodulation',        value: demod ? `${demod.status[0].toUpperCase()}${demod.status.slice(1)} · ${formatSamples(demod.recoveredBits)} bits` : 'Pending' },
    { to: '/fec',             name: 'FEC / Interleaver',   value: fec ? (fec.detected ? `${fec.family} ${fec.codeRate}${interleaver?.detected ? ` · ${interleaver.type} interleaver` : ''}` : 'No FEC detected') : 'Pending' },
    { to: '/bitstream',       name: 'Bit Stream Analysis', value: bs ? `${formatSamples(bs.recovered.totalBits)} bits · ρ ${bs.correlation.score.toFixed(2)}` : 'Pending' },
    { to: '/report',          name: 'Report',              value: overallStatus === 'completed' ? 'Ready to export' : 'Pending' },
  ];

  const exportWith = (fn: () => Promise<void>, label: string) => () => {
    toast.promise(fn(), { loading: `Preparing ${label}…`, success: `${label} downloaded`, error: `${label} export failed` });
  };

  return (
    <div className="pb-8">
      <PageHeader title="Dashboard" description="Signal identity, classification result and how far the pipeline has got." />

      <div className="space-y-4">
        <FileSection />

        {state.error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-destructive/8 px-4 py-3 text-[14px] text-destructive">
            <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" /> {state.error}
          </div>
        )}

        {/* Result: one row, most important first */}
        <Card className="gap-0 py-0">
          <div className="grid divide-border md:grid-cols-2 md:divide-x xl:grid-cols-[1.2fr_.9fr_.9fr_.9fr_1fr_1.4fr] [&>*]:px-5 [&>*]:py-5 max-md:divide-y max-xl:[&>*:nth-child(n+3)]:border-t max-xl:[&>*:nth-child(n+3)]:border-border">
            <div>
              <div className="label-caps">Detected modulation</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="display-num text-[44px] leading-none">{cls?.modulation ?? '—'}</span>
                {cls && <Badge variant="soft">{cls.family} family</Badge>}
              </div>
            </div>

            <Stat label="Confidence" value={cls ? cls.confidence.toFixed(1) : '—'} unit={cls ? '%' : undefined} size="lg">
              <Progress value={cls?.confidence ?? 0} className="mt-3 h-1" />
            </Stat>

            <Stat label="SNR" value={p ? p.snr.toFixed(1) : '—'} unit={p ? 'dB' : undefined} size="lg">
              <div className="mt-3 flex gap-1" aria-label={p ? `Signal quality: ${SNR_LABEL[snrLevel - 1]}` : undefined}>
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className={cn('h-1 flex-1 rounded-full', n <= snrLevel ? 'bg-primary' : 'bg-secondary')} />)}
              </div>
            </Stat>

            <Stat label="Inference" value={cls ? cls.inferenceTimeMs : '—'} unit={cls ? 'ms' : undefined} size="lg" />

            <div>
              <div className="text-[13px] text-muted-foreground">Status</div>
              <div className="mt-2.5"><StatusPill variant={status.v}>{status.l}</StatusPill></div>
              {low && <div className="mt-2 text-[12.5px] text-warning">Low confidence</div>}
            </div>

            <div>
              <div className="text-[13px] text-muted-foreground">Bit error rate</div>
              {ber ? (
                <dl className="mt-2 space-y-1 whitespace-nowrap">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[12.5px] text-muted-foreground">Before FEC</dt>
                    <dd className="tnum text-[15px] text-muted-foreground">{formatBER(ber.berBeforeFEC)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[12.5px] text-muted-foreground">After FEC</dt>
                    <dd className="display-num text-[24px] text-success">{ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A'}</dd>
                  </div>
                </dl>
              ) : <div className="display-num mt-1.5 text-[28px]">—</div>}
            </div>
          </div>
        </Card>

        {/* Parameters + progress */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {p ? (
            <InstrumentPanel
              title="Signal parameters"
              action={<Button variant="ghost" size="sm" onClick={() => navigate('/parameters')}>All parameters <CaretRight /></Button>}
              groups={[
                { title: 'RF', rows: [
                  ['Center frequency', `${p.centerFrequency.toFixed(3)} MHz`],
                  ['Bandwidth', `${p.bandwidth.toFixed(1)} kHz`],
                  ['Carrier offset', formatCFO(p.cfo)],
                ]},
                { title: 'Timing', rows: [
                  ['Sample rate', formatSampleRate(meta?.sampleRate ?? p.sampleRate)],
                  ['Symbol rate', `${p.symbolRate} kSym/s`],
                ]},
                { title: 'Signal quality', rows: [
                  ['SNR', `${p.snr.toFixed(1)} dB`],
                  ['EVM', `${p.evm.toFixed(1)} %`],
                  ['Phase offset', formatPhase(p.phaseOffset)],
                ]},
              ]}
            />
          ) : (
            <Card><CardHeader><CardTitle>Signal parameters</CardTitle></CardHeader><CardContent><p className="py-4 text-[14px] text-muted-foreground">Parameters appear here once the signal has been analyzed.</p></CardContent></Card>
          )}

          <Timeline
            title="Processing progress"
            meta={`${done}/${pipeline.length} · ${totalMs} ms`}
            steps={pipeline.map((s): Step => ({
              name: s.name,
              status: s.status === 'completed' ? 'done' : s.status === 'processing' ? 'running' : s.status === 'failed' ? 'failed' : s.status === 'warning' ? 'warning' : 'pending',
              time: s.status === 'completed' && s.duration !== undefined ? `${s.duration} ms` : s.status === 'processing' ? 'running' : undefined,
            }))}
          />
        </div>
      </div>

      <section className="mt-10">
        <SectionHeading
          title="Signal analysis workspace"
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/visualizations')}>All views <CaretRight /></Button>}
        />
        <AnalysisGrid />
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Bit stream analysis"
          description="What the pipeline recovered, and how well it matches the reference."
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/bitstream')}>Open analysis <CaretRight /></Button>}
        />
        {bs ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Recovered data</CardTitle></CardHeader><CardContent><RecoveredDataPanel data={bs.recovered} compact /></CardContent></Card>
            <Card><CardHeader><CardTitle>Correlation</CardTitle></CardHeader><CardContent><CorrelationPanel data={bs.correlation} height={150} compact /></CardContent></Card>
          </div>
        ) : (
          <Card><CardContent><p className="py-4 text-[14px] text-muted-foreground">Recovered data and correlation appear here once the signal has been analyzed.</p></CardContent></Card>
        )}
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Detailed results"
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!cls}><DownloadSimple /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={exportWith(exportCSV, 'CSV')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportWith(exportJSON, 'JSON')}>JSON</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportWith(exportPDF, 'PDF')}>PDF report</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
        <Card className="gap-0 py-2">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 md:gap-x-4 px-2">
            {results.map((r, i) => (
              <button
                key={r.to}
                onClick={() => navigate(r.to)}
                className={cn(
                  'group flex items-center justify-between gap-4 rounded-lg px-3 py-3.5 text-start outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60',
                  i >= 1 && 'border-t border-border/70 md:border-t-0',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-medium">{r.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{r.value}</span>
                </span>
                <CaretRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        </Card>
        <Separator className="invisible" />
      </section>
    </div>
  );
}
