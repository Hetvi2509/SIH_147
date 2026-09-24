import type { RecoveredData } from '@/types';
import { formatSamples } from '@/utils/formatters';
import Stat from '@/components/common/Stat';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// Group bits into bytes for readability.
const groupBits = (bits: string) => bits.match(/.{1,8}/g)?.join(' ') ?? '';

function Stream({ label, hint, children }: { label: string; hint: string; children: string }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-medium">{label}</span>
        <span className="text-[12.5px] text-muted-foreground">{hint}</span>
      </div>
      <ScrollArea className="max-h-44 rounded-xl bg-secondary/70">
        <pre className="whitespace-pre-wrap break-all p-3.5 font-mono text-[13px] leading-[1.75] text-foreground/90">{children}</pre>
      </ScrollArea>
    </div>
  );
}

export default function RecoveredDataPanel({ data, compact = false }: { data: RecoveredData; compact?: boolean }) {
  const validPct = data.totalBits > 0 ? (data.validBits / data.totalBits) * 100 : 0;
  const shown = compact ? data.bitPreview.slice(0, 128) : data.bitPreview;

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Total bits" value={formatSamples(data.totalBits)} />
        <Stat label="Valid" value={formatSamples(data.validBits)} tone="good" />
        <Stat label="Invalid" value={formatSamples(data.invalidBits)} tone={data.invalidBits > 0 ? 'warn' : 'default'} />
        <Stat label="Valid ratio" value={data.totalBits > 0 ? validPct.toFixed(3) : '—'} unit={data.totalBits > 0 ? '%' : undefined} />
      </div>

      <Separator className="mt-5" />

      {data.totalBits > 0 ? (
        <>
          <Stream label="Recovered bit sequence" hint={`first ${shown.length} of ${formatSamples(data.totalBits)} bits · ${data.encoding}`}>
            {groupBits(shown)}
          </Stream>
          {!compact && (
            <Stream label="Hex preview" hint={`${data.hexPreview.split(' ').length} bytes`}>
              {data.hexPreview}
            </Stream>
          )}
        </>
      ) : (
        <p className="mt-5 text-[14px] text-muted-foreground">
          No bit stream was recovered. Demodulation has to succeed before recovered data is available.
        </p>
      )}
    </div>
  );
}
