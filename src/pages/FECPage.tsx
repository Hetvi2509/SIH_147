import { ShieldCheck } from '@phosphor-icons/react';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill, { type PillVariant } from '@/components/common/StatusPill';
import EmptyState from '@/components/common/EmptyState';
import SummaryBar from '@/components/common/SummaryBar';
import InstrumentPanel, { type InstrumentGroup } from '@/components/common/Instrument';
import NextStep from '@/components/common/NextStep';
import { formatBER, formatSamples } from '@/utils/formatters';

export default function FECPage() {
  const { state } = useAnalysis();
  const { fec, interleaver, ber } = state;

  if (!fec || !interleaver || !ber) {
    return (
      <>
        <PageHeader title="FEC / Interleaver" />
        <EmptyState icon={<ShieldCheck weight="duotone" />} title="No FEC data yet" description="Analyze a signal to detect forward error correction and interleaving." />
      </>
    );
  }

  const head: { v: PillVariant; l: string } =
    fec.detected === true ? { v: fec.decodingStatus === 'successful' ? 'success' : 'error', l: `FEC: ${fec.family}` } :
    fec.detected === false ? { v: 'muted', l: 'No FEC detected' } : { v: 'warning', l: 'FEC unknown' };

  const fecGroup: InstrumentGroup = fec.detected
    ? { title: 'Forward error correction', rows: [
        ['Family', fec.family, 'accent'],
        ['Code rate', fec.codeRate],
        ['Decoding', fec.decodingStatus.replace('-', ' '), fec.decodingStatus === 'successful' ? 'good' : 'bad'],
        ...(fec.constraintLength ? [['Constraint length', String(fec.constraintLength)] as [string, string]] : []),
        ...(fec.errorBits != null ? [['Corrected errors', String(fec.errorBits), 'warn'] as [string, string, 'warn']] : []),
      ]}
    : { title: 'Forward error correction', rows: [['Detected', fec.detected === false ? 'No' : 'Unknown']] };

  const ilvGroup: InstrumentGroup = interleaver.detected
    ? { title: 'Interleaver', rows: [
        ['Type', interleaver.type ?? '—', 'accent'],
        ...(interleaver.depth ? [['Depth', `${interleaver.depth} bits`] as [string, string]] : []),
        ['De-interleaving', interleaver.deinterleavingStatus.replace('-', ' '), interleaver.deinterleavingStatus === 'completed' ? 'good' : 'bad'],
      ]}
    : { title: 'Interleaver', rows: [['Detected', 'No']] };

  const bitsGroup: InstrumentGroup = { title: 'Bits', rows: [
    ['Analyzed', formatSamples(ber.totalBits)],
    ['Errors (raw)', formatSamples(ber.errorBits), 'warn'],
    ...(ber.decodedBits ? [['Decoded', formatSamples(ber.decodedBits), 'good'] as [string, string, 'good']] : []),
  ]};

  return (
    <div className="pb-8">
      <PageHeader
        title="FEC / Interleaver"
        description="Error correction and interleaving, and what they did to the bit error rate."
        actions={<StatusPill variant={head.v}>{head.l}</StatusPill>}
      />

      <div className="space-y-4">
        <SummaryBar items={[
          { key: 'fec', label: 'FEC', value: fec.detected ? `${fec.family} ${fec.codeRate}` : fec.detected === false ? 'None' : 'Unknown', tone: fec.detected ? 'accent' : 'default', grow: 1.2 },
          { key: 'ilv', label: 'Interleaver', value: interleaver.detected ? (interleaver.type ?? 'Yes') : 'None' },
          { key: 'b1', label: 'BER before FEC', value: formatBER(ber.berBeforeFEC), tone: 'warn', grow: 1.2 },
          { key: 'b2', label: 'BER after FEC', value: ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A', tone: 'good', grow: 1.2 },
          { key: 'bits', label: 'Decoded bits', value: ber.decodedBits ? formatSamples(ber.decodedBits) : '—' },
        ]} />

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <InstrumentPanel title="Detection" description="What was found in the demodulated stream." groups={[fecGroup, ilvGroup]} />
          <InstrumentPanel
            title="Decoder performance"
            description="Bit error rate across the decoder."
            groups={[
              { title: 'BER', rows: [
                ['Before FEC', formatBER(ber.berBeforeFEC), 'warn'],
                ['After FEC', ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A', 'good'],
              ]},
              bitsGroup,
            ]}
          />
        </div>
      </div>

      <NextStep to="/bitstream" label="Bit Stream Analysis" description="Inspect the recovered data and correlate it with the reference." />
    </div>
  );
}
