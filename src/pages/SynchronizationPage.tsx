import { ArrowsClockwise } from '@phosphor-icons/react';
import { useAnalysis } from '@/context/AnalysisContext';
import PageHeader from '@/components/common/PageHeader';
import StatusPill from '@/components/common/StatusPill';
import EmptyState from '@/components/common/EmptyState';
import SummaryBar from '@/components/common/SummaryBar';
import InstrumentPanel from '@/components/common/Instrument';
import Timeline, { type Step } from '@/components/common/Timeline';
import { formatCFO, formatPhase } from '@/utils/formatters';

export default function SynchronizationPage() {
  const { state } = useAnalysis();
  const { sync } = state;

  if (!sync) {
    return (
      <>
        <PageHeader title="Synchronization" />
        <EmptyState icon={<ArrowsClockwise weight="duotone" />} title="No synchronization data" description="Analyze a signal to run carrier recovery, timing recovery and matched filtering." />
      </>
    );
  }

  const locked = sync.carrierLocked && sync.timingLocked;
  const step = (name: string, ok: boolean, note: string): Step => ({ name, status: ok ? 'done' : 'failed', note, time: ok ? 'Completed' : 'Failed' });

  return (
    <div className="pb-8">
      <PageHeader
        title="Synchronization"
        description="Carrier and timing recovery, so the demodulator sees clean symbols."
        actions={<StatusPill variant={locked ? 'success' : 'error'}>{locked ? 'Locked' : 'Not locked'}</StatusPill>}
        next={{ to: '/demodulation', label: 'Demodulation' }}
      />

      <div className="space-y-4">
        <SummaryBar items={[
          { key: 'car', label: 'Carrier', value: sync.carrierLocked ? 'Locked' : 'Not locked', tone: sync.carrierLocked ? 'good' : 'warn' },
          { key: 'tim', label: 'Symbol timing', value: sync.timingLocked ? 'Locked' : 'Not locked', tone: sync.timingLocked ? 'good' : 'warn' },
          { key: 'cfo', label: 'Carrier offset', value: formatCFO(sync.cfoEstimate).replace(/\s*kHz/, ''), unit: 'kHz' },
          { key: 'ph', label: 'Phase offset', value: sync.phaseOffset.toFixed(1), unit: '°' },
          { key: 'to', label: 'Timing offset', value: sync.timingOffset.toFixed(1), unit: 'samples' },
        ]} />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <InstrumentPanel
            title="Estimated parameters"
            description="What the loops converged to."
            groups={[
              { title: 'Carrier', rows: [
                ['Carrier offset', formatCFO(sync.cfoEstimate), sync.cfoEstimate !== 0 ? 'warn' : 'good'],
                ['Phase offset', formatPhase(sync.phaseOffset), 'warn'],
                ['Lock', sync.carrierLocked ? 'Locked' : 'Not locked', sync.carrierLocked ? 'good' : 'bad'],
              ]},
              { title: 'Timing', rows: [
                ['Timing offset', `${sync.timingOffset.toFixed(1)} samples`],
                ['Lock', sync.timingLocked ? 'Locked' : 'Not locked', sync.timingLocked ? 'good' : 'bad'],
                ['Burst detected', sync.burstDetected ? 'Yes' : 'No'],
              ]},
            ]}
          />
          <Timeline
            title="Recovery chain"
            description="Each step needs the one before it."
            steps={[
              step('Carrier / frequency sync', sync.carrierLocked, 'CFO estimation and correction'),
              step('Symbol timing recovery', sync.timingLocked, 'Gardner / Müller-Müller loop'),
              step('Matched filtering', sync.matchedFilterApplied, 'Root raised cosine'),
              { name: 'Demodulation', status: 'done', note: 'Coherent detection' },
              step('Sync-word detection', sync.syncWordDetected, 'Preamble correlation'),
            ]}
          />
        </div>
      </div>

    </div>
  );
}
