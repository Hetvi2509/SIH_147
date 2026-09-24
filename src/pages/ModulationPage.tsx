import { Cpu } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import EmptyState from '@/components/common/EmptyState';
import InfoTip from '@/components/common/InfoTip';
import SummaryBar from '@/components/common/SummaryBar';
import InstrumentPanel from '@/components/common/Instrument';
import SectionHeading from '@/components/common/SectionHeading';
import ChartFrame from '@/components/visualization/ChartFrame';
import { cn } from '@/lib/utils';

const CLASSES = ['OOK', 'PAM', '2FSK', '4FSK', 'CPFSK', 'GMSK', 'BPSK', 'QPSK', '8PSK', '16QAM', '64QAM', 'AM', 'FM', 'NOISE'];

export default function ModulationPage() {
  const { state } = useAnalysis();
  const cls = state.classification;
  const p = state.parameters;

  if (!cls) {
    return (
      <>
        <PageHeader title="Modulation" />
        <EmptyState icon={<Cpu weight="duotone" />} title="No classification yet" description="Analyze a signal to run the modulation classifier. It scores all 14 classes and reports the top five." />
      </>
    );
  }

  const low = cls.confidence < 70;

  return (
    <div className="pb-8">
      <PageHeader
        title="Modulation"
        description="Which scheme the transmitter used, and how sure the classifier is."
        actions={<StatusPill variant={low ? 'warning' : 'success'}>{low ? 'Low confidence' : 'Classified'}</StatusPill>}
        next={{ to: '/synchronization', label: 'Synchronization' }}
      />

      <div className="space-y-4">
        <SummaryBar items={[
          {
            key: 'mod', label: 'Detected modulation', grow: 1.4,
            custom: (
              <div>
                <div className="label-caps">Detected modulation</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="display-num text-[44px] leading-none">{cls.modulation}</span>
                  <Badge variant="soft">{cls.family} family</Badge>
                </div>
              </div>
            ),
          },
          { key: 'conf', label: 'Confidence', value: cls.confidence.toFixed(1), unit: '%', meter: cls.confidence, tone: low ? 'warn' : 'default' },
          { key: 'snr', label: 'SNR', value: p ? p.snr.toFixed(1) : '—', unit: 'dB' },
          { key: 'evm', label: 'EVM', value: p ? p.evm.toFixed(1) : '—', unit: '%' },
          { key: 'inf', label: 'Inference', value: cls.inferenceTimeMs, unit: 'ms', note: cls.modelVersion },
        ]} />

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Class probabilities
                <InfoTip label="class probabilities" info={{ what: 'The classifier score for each modulation class.', use: 'show how decisive the result is. A close runner-up means low certainty.' }} />
              </CardTitle>
              <CardDescription>Top {cls.topK.length} of {CLASSES.length} classes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {cls.topK.map((item, i) => (
                <div key={item.modulation} className="grid grid-cols-[72px_1fr_52px] items-center gap-3">
                  <span className={cn('text-[14px]', i === 0 ? 'font-medium' : 'text-muted-foreground')}>{item.modulation}</span>
                  <Progress value={item.confidence} className={cn('h-1.5', i !== 0 && '[&>*]:bg-muted-foreground/40')} />
                  <span className={cn('tnum text-end text-[13.5px]', i === 0 ? 'font-medium' : 'text-muted-foreground')}>{item.confidence.toFixed(1)}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <InstrumentPanel
            title="Classifier"
            description="The model and the class set it chooses from."
            groups={[
              { title: 'Result', rows: [
                ['Detected', cls.modulation, 'accent'],
                ['Family', cls.family],
                ['Confidence', `${cls.confidence.toFixed(1)} %`, low ? 'warn' : 'good'],
              ]},
              { title: 'Model', rows: [
                ['Version', cls.modelVersion],
                ['Inference', `${cls.inferenceTimeMs} ms`],
                ['Classes', String(CLASSES.length)],
              ]},
            ]}
          />
        </div>
      </div>

      <section className="mt-10">
        <SectionHeading title="Evidence" description="The constellation the classifier saw, and the classes it chose from." />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <ChartFrame id="constellation" height={340} />
          <Card>
            <CardHeader><CardTitle>Supported classes</CardTitle><CardDescription>The detected class is highlighted.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <Badge key={c} variant={c === cls.modulation ? 'default' : 'muted'} className="px-3 py-1 text-[13px]">{c}</Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

    </div>
  );
}
