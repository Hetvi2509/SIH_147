import { SlidersHorizontal } from '@phosphor-icons/react';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import EmptyState from '@/components/common/EmptyState';
import SummaryBar from '@/components/common/SummaryBar';
import InstrumentPanel from '@/components/common/Instrument';
import SectionHeading from '@/components/common/SectionHeading';
import NextStep from '@/components/common/NextStep';
import AnalysisGrid from '@/components/visualization/AnalysisGrid';
import { formatCFO, formatEVM, formatPhase, formatPower, formatSampleRate } from '@/utils/formatters';

export default function ParametersPage() {
  const { state } = useAnalysis();
  const p = state.parameters;

  if (!p) {
    return (
      <>
        <PageHeader title="Parameters" />
        <EmptyState icon={<SlidersHorizontal weight="duotone" />} title="No parameters yet" description="Load a file on the dashboard and analyze it. Center frequency, bandwidth, SNR and the rest are extracted in the second stage." />
      </>
    );
  }

  const quality = p.modulationQuality === 'Good' || p.modulationQuality === 'Excellent' ? 'good' : p.modulationQuality === 'Moderate' ? 'warn' : 'bad';

  return (
    <div className="pb-8">
      <PageHeader
        title="Parameters"
        description="RF characteristics extracted from the signal before classification."
        actions={<StatusPill variant="success">Extracted</StatusPill>}
      />

      <div className="space-y-4">
        <SummaryBar items={[
          { key: 'fc', label: 'Center frequency', value: p.centerFrequency.toFixed(3), unit: 'MHz', tone: 'accent' },
          { key: 'bw', label: 'Bandwidth', value: p.bandwidth.toFixed(1), unit: 'kHz' },
          { key: 'sym', label: 'Symbol rate', value: p.symbolRate, unit: 'kSym/s' },
          { key: 'snr', label: 'SNR', value: p.snr.toFixed(1), unit: 'dB', tone: 'good' },
          { key: 'q', label: 'Modulation quality', value: p.modulationQuality, tone: quality === 'good' ? 'good' : quality === 'warn' ? 'warn' : 'default', note: p.channelCondition },
        ]} />

        <div className="grid gap-4 lg:grid-cols-2">
          <InstrumentPanel
            title="RF and timing"
            description="Where the signal sits and how fast it runs."
            groups={[
              { title: 'RF', rows: [
                ['Center frequency', `${p.centerFrequency.toFixed(3)} MHz`, 'accent'],
                ['Bandwidth', `${p.bandwidth.toFixed(1)} kHz`],
                ['Occupied bandwidth', `${p.occupiedBandwidth.toFixed(1)} kHz`],
              ]},
              { title: 'Timing', rows: [
                ['Sample rate', formatSampleRate(p.sampleRate)],
                ['Symbol rate', `${p.symbolRate} kSym/s`],
                ['Duration', `${p.duration.toFixed(2)} s`],
              ]},
            ]}
          />
          <InstrumentPanel
            title="Signal quality"
            description="How clean the signal is, and how far the carrier has drifted."
            groups={[
              { title: 'Quality', rows: [
                ['SNR', `${p.snr.toFixed(1)} dB`, 'good'],
                ['EVM', formatEVM(p.evm)],
                ['Channel', p.channelCondition],
              ]},
              { title: 'Offsets', rows: [
                ['Carrier offset', formatCFO(p.cfo), 'warn'],
                ['Phase offset', formatPhase(p.phaseOffset), 'warn'],
                ['Rating', p.modulationQuality, quality],
              ]},
            ]}
          />
        </div>

        <InstrumentPanel
          title="Power"
          description="Measured across the analysis segment."
          groups={[
            { title: 'Levels', rows: [
              ['Channel power', formatPower(p.channelPower)],
              ['Signal power', formatPower(p.signalPower)],
              ['Noise power', formatPower(p.noisePower)],
            ]},
            { title: 'Extremes', rows: [
              ['Peak power', formatPower(p.peakPower)],
              ['Average power', formatPower(p.averagePower)],
            ]},
            { title: 'Format', rows: [
              ['I/Q format', state.fileMetadata?.format ?? 'Unknown'],
              ['Sample type', state.fileMetadata?.dataType ?? '—'],
            ]},
          ]}
        />
      </div>

      <section className="mt-10">
        <SectionHeading title="Where these come from" description="The spectrum and waveform the measurements were taken from." />
        <AnalysisGrid charts={['spectrum', 'iq', 'amplitude']} cellHeight={200} />
      </section>

      <NextStep to="/modulation" label="Modulation" description="Classify the scheme the transmitter used." />
    </div>
  );
}
