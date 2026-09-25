import { FileAudio } from '@phosphor-icons/react';
import StatusPill from '@/components/common/StatusPill';
import { ConstellationPlot, SpectrumPlot } from '@/components/visualization/charts';
import { FULL_WINDOW } from '@/lib/chart';
import { MOCK_PARAMETERS, MOCK_CLASSIFICATION, MOCK_BER } from '@/data/mockAnalysis';
import { formatBER } from '@/utils/formatters';

/** A read-only sample of the real analysis screen, built from the same plot components. */
export default function HeroPreview() {
  const cls = MOCK_CLASSIFICATION;
  const p = MOCK_PARAMETERS;
  return (
    <figure className="rounded-[22px] bg-card p-2 smooth-shadow-ring-lg" aria-label="Sample analysis result">
      <div className="rounded-2xl bg-background">
        <figcaption className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium">
            <FileAudio weight="duotone" className="size-4 shrink-0 text-primary" />
            <span className="truncate">capture_qpsk_001.iq</span>
          </span>
          <StatusPill variant="success">Analysis complete</StatusPill>
        </figcaption>

        <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
          {[
            ['Modulation', cls.modulation, 'text-primary'],
            ['Confidence', `${cls.confidence.toFixed(1)}%`, ''],
            ['SNR', `${p.snr.toFixed(1)} dB`, ''],
            ['BER after FEC', ber(), 'text-success'],
          ].map(([k, v, tone]) => (
            <div key={k} className="bg-background px-5 py-3.5">
              <div className="text-[12px] text-muted-foreground">{k}</div>
              <div className={`display-num mt-1.5 text-[22px] ${tone}`}>{v}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-px overflow-hidden rounded-b-2xl bg-border sm:grid-cols-[1.35fr_1fr]">
          <div className="bg-card px-2 pb-1 pt-3">
            <p className="px-3 pb-1 text-[12.5px] font-medium">Spectrum</p>
            <SpectrumPlot height={180} zoom={FULL_WINDOW} fc={p.centerFrequency} />
          </div>
          <div className="bg-card px-2 pb-1 pt-3">
            <p className="px-3 pb-1 text-[12.5px] font-medium">Constellation</p>
            <ConstellationPlot height={180} zoom={FULL_WINDOW} />
          </div>
        </div>
      </div>
    </figure>
  );
}

function ber() {
  return MOCK_BER.berAfterFEC != null ? formatBER(MOCK_BER.berAfterFEC) : '—';
}
