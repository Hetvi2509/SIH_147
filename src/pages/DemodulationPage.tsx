import { WarningCircle, WaveSine } from '@phosphor-icons/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import EmptyState from '@/components/common/EmptyState';
import SummaryBar from '@/components/common/SummaryBar';
import InstrumentPanel from '@/components/common/Instrument';
import { formatBER, formatSamples } from '@/utils/formatters';

export default function DemodulationPage() {
  const { state } = useAnalysis();
  const d = state.demodulation;

  if (!d) {
    return (
      <>
        <PageHeader title="Demodulation" />
        <EmptyState icon={<WaveSine weight="duotone" />} title="No demodulation data" description="Analyze a signal to run the demodulator and recover symbols and bits." />
      </>
    );
  }

  const ok = d.status === 'successful';
  const pill = ok ? 'success' : d.status === 'uncertain' || d.status === 'unsupported' ? 'warning' : 'error';
  const label = d.status.replace('-', ' ');

  return (
    <div className="pb-8">
      <PageHeader
        title="Demodulation"
        description="From symbols to bits, and how many of them came through clean."
        actions={<StatusPill variant={pill}>{ok ? 'Successful' : label}</StatusPill>}
        next={{ to: '/fec', label: 'FEC / Interleaver' }}
      />

      <div className="space-y-4">
        <SummaryBar items={[
          { key: 'mod', label: 'Modulation', value: d.detectedModulation, tone: 'accent' },
          { key: 'sym', label: 'Recovered symbols', value: ok ? formatSamples(d.recoveredSymbols) : '—' },
          { key: 'bits', label: 'Recovered bits', value: ok ? formatSamples(d.recoveredBits) : '—' },
          { key: 'b1', label: 'BER before decoding', value: ok ? formatBER(d.berBeforeDecoding) : '—', tone: 'warn', grow: 1.2 },
          { key: 'b2', label: 'BER after decoding', value: ok && d.berAfterDecoding != null ? formatBER(d.berAfterDecoding) : '—', tone: 'good', grow: 1.2 },
        ]} />

        {(d.status === 'uncertain' || d.status === 'unsupported') && (
          <Alert className="border-0 bg-warning-soft text-warning">
            <WarningCircle weight="fill" />
            <AlertDescription className="text-warning">
              {d.status === 'uncertain'
                ? 'Demodulator configuration is uncertain. There is not enough signal information to pick the right parameters; manual configuration may be needed.'
                : 'This waveform type is not supported by the demodulator.'}
            </AlertDescription>
          </Alert>
        )}

        <InstrumentPanel
          title="Demodulator"
          description="How the symbols were decided."
          groups={[
            { title: 'Configuration', rows: [
              ['Detected modulation', d.detectedModulation, 'accent'],
              ['Demodulator', d.demodulatorFamily],
              ['Status', label, ok ? 'good' : 'warn'],
            ]},
            ...(ok ? [{ title: 'Recovered', rows: [
              ['Symbols', formatSamples(d.recoveredSymbols)],
              ['Bits', formatSamples(d.recoveredBits)],
            ] as [string, string][] }] : []),
            ...(ok ? [{ title: 'Error rate', rows: [
              ['Before decoding', formatBER(d.berBeforeDecoding), 'warn'],
              ['After decoding', d.berAfterDecoding != null ? formatBER(d.berAfterDecoding) : 'N/A', 'good'],
            ] as [string, string, 'warn' | 'good'][] }] : []),
          ]}
        />
      </div>

    </div>
  );
}
