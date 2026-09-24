import { Binary } from '@phosphor-icons/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import EmptyState from '@/components/common/EmptyState';
import SummaryBar from '@/components/common/SummaryBar';
import Timeline from '@/components/common/Timeline';
import RecoveredDataPanel from '@/components/bitstream/RecoveredDataPanel';
import CorrelationPanel from '@/components/bitstream/CorrelationPanel';
import { formatSamples } from '@/utils/formatters';

export default function BitStreamPage() {
  const { state } = useAnalysis();
  const { bitStream: bs, demodulation, fec } = state;

  if (!bs) {
    return (
      <>
        <PageHeader title="Bit Stream Analysis" />
        <EmptyState icon={<Binary weight="duotone" />} title="No bit stream yet" description="Analyze a signal to recover the bit stream and correlate it against the reference sequence." />
      </>
    );
  }

  const ok = bs.status === 'completed';
  const { recovered: r, correlation: c } = bs;

  return (
    <div className="pb-8">
      <PageHeader
        title="Bit Stream Analysis"
        description="The two outputs of this stage: the data that was recovered, and how well it correlates with the reference."
        actions={<StatusPill variant={ok ? 'success' : 'warning'}>{ok ? 'Bit stream recovered' : 'No bit stream'}</StatusPill>}
        next={{ to: '/report', label: 'Report' }}
      />

      <div className="space-y-4">
        <SummaryBar items={[
          { key: 'tot', label: 'Recovered bits', value: formatSamples(r.totalBits), grow: 1.2 },
          { key: 'val', label: 'Valid ratio', value: r.totalBits > 0 ? ((r.validBits / r.totalBits) * 100).toFixed(3) : '—', unit: '%', tone: 'good' },
          { key: 'inv', label: 'Invalid bits', value: formatSamples(r.invalidBits), tone: r.invalidBits > 0 ? 'warn' : 'default' },
          { key: 'rho', label: 'Correlation', value: c.score.toFixed(3), tone: c.detected ? 'good' : 'warn' },
          { key: 'ref', label: 'Reference', value: c.detected ? 'Detected' : 'Not found', tone: c.detected ? 'good' : 'warn' },
        ]} />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader><CardTitle>Recovered data</CardTitle><CardDescription>{r.encoding}</CardDescription></CardHeader>
            <CardContent><RecoveredDataPanel data={r} /></CardContent>
          </Card>
          <Timeline
            title="Where this stream came from"
            description="Each stage feeds the next."
            steps={[
              { name: 'Demodulation', status: demodulation?.status === 'successful' ? 'done' : 'warning', note: demodulation ? `${formatSamples(demodulation.recoveredBits)} bits` : undefined },
              { name: 'FEC decoding', status: fec ? 'done' : 'pending', note: fec?.detected ? `${fec.family} ${fec.codeRate}` : 'No FEC' },
              { name: 'Bit stream recovered', status: ok ? 'done' : 'warning', note: `${formatSamples(r.totalBits)} bits` },
              { name: 'Reference correlation', status: c.detected ? 'done' : 'warning', note: `ρ ${c.score.toFixed(3)}` },
            ]}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Correlation</CardTitle>
            <CardDescription>{c.detected ? 'Reference sequence detected.' : 'Correlation is below the detection threshold.'}</CardDescription>
          </CardHeader>
          <CardContent><CorrelationPanel data={c} height={260} /></CardContent>
        </Card>
      </div>

    </div>
  );
}
