import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowsClockwise, FileAudio, Trash, UploadSimple, Waveform } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAnalysis } from '@/context/AnalysisContext';
import { formatDuration, formatFileSize, formatSampleRate, formatSamples } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const ACCEPT = ['iq', 'wav', 'bin'];

export default function FileSection() {
  const { state, uploadFile, reset } = useAnalysis();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const meta = state.fileMetadata;
  const busy = state.overallStatus === 'analyzing' || state.isLoading;

  const take = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPT.includes(ext)) {
      toast.error(`.${ext || 'unknown'} files are not supported`, { description: 'Use an .iq, .wav or .bin recording.' });
      return;
    }
    await uploadFile(file);
    toast.success('File loaded', { description: `${file.name} is ready to analyze.` });
  }, [uploadFile]);

  const picker = (
    <input
      ref={input}
      type="file"
      accept=".iq,.wav,.bin"
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ''; }}
    />
  );

  if (!meta) {
    return (
      <Card
        className={cn('items-center gap-0 border-dashed py-14 text-center transition-colors duration-150', dragging && 'bg-accent')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) take(f); }}
      >
        {picker}
        <div className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
          <Waveform weight="duotone" className="size-6" />
        </div>
        <h2 className="mt-5 text-[24px] tracking-[-0.015em]">Start with an IQ recording</h2>
        <p className="mt-2 max-w-[46ch] text-[14.5px] text-muted-foreground">
          Drop a file here. The classifier identifies the modulation, then the pipeline recovers the bit stream and correlates it against a reference.
        </p>
        <Button className="mt-6" onClick={() => input.current?.click()}>
          <UploadSimple weight="bold" /> Choose file
        </Button>
        <p className="mt-3 text-[12.5px] text-muted-foreground">.iq · .wav · .bin</p>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-3">
      {picker}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileAudio weight="duotone" className="size-5 shrink-0 text-primary" />
          <span className="truncate text-[14.5px] font-medium" title={meta.fileName}>{meta.fileName}</span>
        </div>

        <dl className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {([
            ['Sample rate', formatSampleRate(meta.sampleRate)],
            ['Samples', formatSamples(meta.numSamples)],
            ['Duration', formatDuration(meta.duration)],
            ['Size', formatFileSize(meta.fileSize)],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tnum font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <ArrowsClockwise /> Re-upload file
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} className="text-destructive hover:bg-destructive/8 hover:text-destructive" onClick={() => { reset(); toast('File removed'); }}>
            <Trash /> Remove file
          </Button>
        </div>
      </div>
    </Card>
  );
}
