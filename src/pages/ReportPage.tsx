import { Fragment, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckCircle, DownloadSimple, FilePdf, FileText } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import ChartFrame from '@/components/visualization/ChartFrame';
import CorrelationPanel from '@/components/bitstream/CorrelationPanel';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import SummaryBar from '@/components/common/SummaryBar';
import EmptyState from '@/components/common/EmptyState';
import KVTable, { type KVRow } from '@/components/common/KVTable';
import {
  formatBER, formatCFO, formatDuration, formatFileSize, formatPhase, formatPower, formatSNR,
  formatSampleRate, formatSamples,
} from '@/utils/formatters';

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-2 py-7 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[19px] leading-tight tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{note}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Preview({ label, children, tone = '' }: { label: string; children: string; tone?: string }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[13px] text-muted-foreground">{label}</div>
      <pre className={`whitespace-pre-wrap break-all rounded-xl bg-secondary/70 p-3.5 font-mono text-[13px] leading-[1.75] ${tone}`}>{children}</pre>
    </div>
  );
}

export default function ReportPage() {
  const { state, exportJSON, exportPDF, exportCSV } = useAnalysis();
  const { fileMetadata: meta, parameters: p, classification: cls, sync, demodulation: demod, fec, interleaver, ber, bitStream: bs, pipeline, overallStatus } = state;
  const complete = overallStatus === 'completed';

  if (!cls) {
    return (
      <>
        <PageHeader title="Report" />
        <EmptyState icon={<FileText weight="duotone" />} title="Nothing to report yet" description="Run an analysis first. The report collects every stage, including the recovered data and correlation." />
      </>
    );
  }

  const date = new Date().toLocaleString();
  const run = (fn: () => Promise<void>, label: string) => () => {
    toast.promise(fn(), { loading: `Preparing ${label}…`, success: `${label} downloaded`, error: `${label} export failed` });
  };
  const charts = (ids: Parameters<typeof ChartFrame>[0]['id'][], h = 190) => (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {ids.map((id) => <ChartFrame key={id} id={id} height={h} />)}
    </div>
  );

  const sections: { title: string; note: string; rows: KVRow[]; extra?: ReactNode }[] = [
    { title: 'Signal summary', note: 'Headline results', rows: [
      ['Signal file', meta?.fileName ?? 'N/A'],
      ['Detected modulation', cls.modulation, 'accent'],
      ['Modulation family', cls.family],
      ['Confidence', `${cls.confidence.toFixed(1)}%`, 'good'],
      ['Overall status', complete ? 'Analysis completed' : 'Incomplete', complete ? 'good' : 'warn'],
    ]},
    ...(meta ? [{ title: 'File information', note: 'Raw metadata', rows: [
      ['File name', meta.fileName], ['File type', meta.fileType], ['Format', meta.format], ['Layout', meta.layout],
      ['Data type', meta.dataType], ['Endianness', meta.endianness ?? 'N/A'], ['File size', formatFileSize(meta.fileSize)],
      ['Sample rate', formatSampleRate(meta.sampleRate)], ['Number of samples', formatSamples(meta.numSamples)], ['Duration', formatDuration(meta.duration)],
    ] as KVRow[] }] : []),
    ...(p ? [{ title: 'Signal parameters', note: 'RF, timing and quality', rows: [
      ['Center frequency', `${p.centerFrequency.toFixed(3)} MHz`, 'accent'], ['Bandwidth', `${p.bandwidth.toFixed(1)} kHz`],
      ['Occupied bandwidth', `${p.occupiedBandwidth.toFixed(1)} kHz`], ['SNR', formatSNR(p.snr), 'good'], ['Symbol rate', `${p.symbolRate} kSym/s`],
      ['Carrier offset (CFO)', formatCFO(p.cfo), 'warn'], ['Phase offset', formatPhase(p.phaseOffset), 'warn'], ['EVM', `${p.evm.toFixed(1)}% RMS`],
      ['Signal power', formatPower(p.signalPower)], ['Noise power', formatPower(p.noisePower)], ['Channel condition', p.channelCondition],
      ['Modulation quality', p.modulationQuality, p.modulationQuality === 'Good' ? 'good' : 'warn'],
    ] as KVRow[], extra: charts(['spectrum', 'iq']) }] : []),
    { title: 'Modulation classification', note: 'AI analysis', rows: [
      ['Detected modulation', cls.modulation, 'accent'], ['Modulation family', cls.family], ['Confidence', `${cls.confidence.toFixed(1)}%`, 'good'],
      ['Model version', cls.modelVersion], ['Inference time', `${cls.inferenceTimeMs} ms`],
      ['Top predictions', cls.topK.map((r) => `${r.modulation} ${r.confidence.toFixed(1)}%`).join(' · ')],
    ], extra: charts(['constellation']) },
    ...(sync ? [{ title: 'Synchronization', note: 'Carrier and timing recovery', rows: [
      ['Carrier lock', sync.carrierLocked ? 'Locked' : 'Failed', sync.carrierLocked ? 'good' : 'bad'],
      ['Symbol timing lock', sync.timingLocked ? 'Locked' : 'Failed', sync.timingLocked ? 'good' : 'bad'],
      ['CFO estimate', formatCFO(sync.cfoEstimate), 'warn'], ['Phase offset', formatPhase(sync.phaseOffset), 'warn'],
      ['Timing offset', `${sync.timingOffset.toFixed(1)} samples`],
      ['Matched filter', sync.matchedFilterApplied ? 'Applied' : 'Not applied', sync.matchedFilterApplied ? 'good' : 'warn'],
    ] as KVRow[], extra: charts(['freq-time', 'phase-time']) }] : []),
    ...(demod ? [{ title: 'Demodulation', note: 'Symbol and bit recovery', rows: [
      ['Demodulator', demod.demodulatorFamily], ['Status', demod.status, demod.status === 'successful' ? 'good' : 'warn'],
      ['Recovered symbols', formatSamples(demod.recoveredSymbols)], ['Recovered bits', formatSamples(demod.recoveredBits)],
      ['BER before decoding', formatBER(demod.berBeforeDecoding), 'warn'],
      ['BER after decoding', demod.berAfterDecoding != null ? formatBER(demod.berAfterDecoding) : 'N/A', 'good'],
    ] as KVRow[], extra: charts(['eye', 'waterfall']) }] : []),
    ...(fec && interleaver ? [{ title: 'FEC and interleaver', note: 'Decoding', rows: [
      ['FEC detected', fec.detected === true ? 'Yes' : fec.detected === false ? 'No' : 'Unknown', fec.detected ? 'good' : 'default'],
      ...(fec.detected ? [['FEC family', fec.family, 'accent'], ['Code rate', fec.codeRate], ['Decoding', fec.decodingStatus, fec.decodingStatus === 'successful' ? 'good' : 'bad']] as KVRow[] : []),
      ['Interleaver detected', interleaver.detected ? 'Yes' : 'No', interleaver.detected ? 'good' : 'default'],
      ...(interleaver.detected ? [['Interleaver type', interleaver.type ?? '—'], ['Depth', `${interleaver.depth} bits`], ['De-interleaving', interleaver.deinterleavingStatus, 'good']] as KVRow[] : []),
    ] as KVRow[] }] : []),
    ...(bs ? [{
      title: 'Recovered data', note: 'Bit stream analysis, output 1',
      rows: [
        ['Total recovered bits', formatSamples(bs.recovered.totalBits)],
        ['Valid bits', formatSamples(bs.recovered.validBits), 'good'],
        ['Invalid bits', formatSamples(bs.recovered.invalidBits), bs.recovered.invalidBits > 0 ? 'warn' : 'default'],
        ['Encoding', bs.recovered.encoding],
      ] as KVRow[],
      extra: bs.recovered.totalBits > 0 ? (
        <>
          <Preview label={`Bit sequence, first ${Math.min(64, bs.recovered.previewBits)} bits`}>{bs.recovered.bitPreview.slice(0, 64).match(/.{1,8}/g)?.join(' ') ?? ''}</Preview>
          <Preview label="Hex preview" tone="text-primary">{bs.recovered.hexPreview.split(' ').slice(0, 16).join(' ')}</Preview>
        </>
      ) : undefined,
    }, {
      title: 'Correlation', note: 'Bit stream analysis, output 2',
      rows: [
        ['Correlation score', bs.correlation.score.toFixed(3), bs.correlation.detected ? 'good' : 'warn'],
        ['Peak lag', `${bs.correlation.peakLag} symbols`],
        ['Sidelobe ratio', `${bs.correlation.sidelobeRatioDb.toFixed(1)} dB`],
        ['Reference', bs.correlation.reference],
        ['Reference match', bs.correlation.detected ? 'Detected' : 'Not detected', bs.correlation.detected ? 'good' : 'warn'],
      ] as KVRow[],
      extra: <div className="mt-4 rounded-2xl bg-card p-4 smooth-shadow-ring-xs"><CorrelationPanel data={bs.correlation} height={170} compact /></div>,
    }] : []),
    ...(ber ? [{ title: 'BER results', note: 'Decoder performance', rows: [
      ['BER before FEC', formatBER(ber.berBeforeFEC), 'warn'], ['BER after FEC', ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A', 'good'],
      ['Total bits analyzed', formatSamples(ber.totalBits)], ['Error bits (raw)', formatSamples(ber.errorBits)],
      ...(ber.decodedBits ? [['Decoded bits', formatSamples(ber.decodedBits), 'good']] as KVRow[] : []),
    ] as KVRow[] }] : []),
    { title: 'Processing stages', note: 'Time per stage', rows: [
      ...pipeline.map((s): KVRow => [s.name, s.status === 'completed' && s.duration !== undefined ? `${s.duration} ms` : s.status]),
      ['Total', `${pipeline.reduce((t, s) => t + (s.duration ?? 0), 0)} ms`],
    ]},
  ];

  return (
    <div>
      <PageHeader
        title="Report"
        description={`Generated ${date}`}
        actions={
          <>
            <StatusPill variant={complete ? 'success' : 'muted'}>{complete ? 'Analysis complete' : 'Incomplete'}</StatusPill>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><DownloadSimple /> Data</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={run(exportCSV, 'CSV')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onSelect={run(exportJSON, 'JSON')}>JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={run(exportPDF, 'PDF report')}><FilePdf weight="bold" /> Download PDF</Button>
          </>
        }
      />

      {complete && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-success-soft px-5 py-3.5 text-success">
          <CheckCircle weight="fill" className="size-5" />
          <span className="font-display text-[18px]">Analysis completed successfully</span>
          <span className="ms-auto hidden text-[13px] sm:inline">All {pipeline.length} stages passed</span>
        </div>
      )}

      <div className="mb-4">
        <SummaryBar items={[
          { key: 'mod', label: 'Modulation', value: cls.modulation, tone: 'accent' },
          { key: 'conf', label: 'Confidence', value: cls.confidence.toFixed(1), unit: '%' },
          { key: 'snr', label: 'SNR', value: p ? p.snr.toFixed(1) : '—', unit: 'dB' },
          { key: 'ber', label: 'BER after FEC', value: ber?.berAfterFEC != null ? formatBER(ber.berAfterFEC) : '—', tone: 'good', grow: 1.2 },
          { key: 'bits', label: 'Recovered bits', value: bs ? formatSamples(bs.recovered.totalBits) : '—', grow: 1.2 },
        ]} />
      </div>

      <Card className="px-6 py-0 md:px-8">
        {sections.map((s, i) => (
          <Fragment key={s.title}>
            {i > 0 && <Separator />}
            <Section title={s.title} note={s.note}>
              <KVTable rows={s.rows} />
              {s.extra}
            </Section>
          </Fragment>
        ))}
      </Card>

      <p className="mt-4 text-[13px] text-muted-foreground">The PDF contains every section and chart on this page, generated in your browser.</p>
    </div>
  );
}
