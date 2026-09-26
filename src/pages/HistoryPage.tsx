import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowUp, ArrowsDownUp, CaretRight, ClockCounterClockwise, TrashSimple,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/common/PageHeader';
import { useAnalysis } from '@/context/AnalysisContext';
import * as analysisService from '@/services/analysisService';
import type { HistorySummary } from '@/services/analysisService';
import { formatBER, formatSNR, formatSamples, formatSampleRate, formatDuration } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type SortKey = 'createdAt' | 'confidence' | 'snr' | 'recoveredBits';
type SortDir = 'asc' | 'desc';

const DASH = '—';
const CACHE_KEY = 'tc-history-cache';

/** Stale-while-revalidate: last successful list, shown instantly on return visits while a fresh
 *  copy loads silently underneath. The first-ever load still pays the real network round trip. */
function readCache(): HistorySummary[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as HistorySummary[]) : null;
  } catch { return null; }
}
function writeCache(items: HistorySummary[]) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
}

function fmtDate(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  return {
    date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

function demodTone(status: string | null): 'success' | 'warning' | 'destructive' | 'muted' {
  if (status === 'successful') return 'success';
  if (status === 'uncertain') return 'warning';
  if (status === 'failed') return 'destructive';
  return 'muted';
}

function SortHeader({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string }) {
  return (
    <TableHead className={className}>
      <button
        onClick={onClick}
        className={cn(
          'group inline-flex items-center gap-1 text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90 outline-none transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active ? (
          dir === 'desc' ? <ArrowDown weight="bold" className="size-3" /> : <ArrowUp weight="bold" className="size-3" />
        ) : (
          <ArrowsDownUp className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
        )}
      </button>
    </TableHead>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { loadHistoryEntry } = useAnalysis();
  const [items, setItems] = useState<HistorySummary[] | null>(readCache);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'createdAt', dir: 'desc' });

  const refresh = useCallback(() => {
    setRefreshing(true);
    analysisService.listAnalysisHistory()
      .then((fresh) => { setItems(fresh); writeCache(fresh); setError(null); })
      .catch(() => {
        setError('Failed to load history. Are you signed in?');
        setItems((cur) => { if (cur !== null) toast.error('Failed to refresh history'); return cur; });
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const sorted = useMemo(() => {
    if (!items) return null;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [items, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

  const open = async (id: number) => {
    setBusyId(id);
    try {
      await loadHistoryEntry(id);
      navigate('/dashboard');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = items;
    const next = items?.filter((i) => i.id !== id) ?? null;
    setItems(next);
    if (next) writeCache(next);
    try {
      await analysisService.deleteAnalysisHistoryEntry(id);
      toast.success('Analysis deleted');
    } catch {
      setItems(prev ?? null);
      if (prev) writeCache(prev);
      toast.error('Failed to delete analysis');
    }
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="History"
        description="Past analyses, stored in the database — pick one up where you left off."
        actions={refreshing && items !== null ? (
          <span className="text-[12.5px] text-muted-foreground">Updating…</span>
        ) : undefined}
      />

      {error && items === null && <div className="rounded-xl bg-destructive/8 px-4 py-3 text-[14px] text-destructive">{error}</div>}

      {items === null && (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="space-y-0 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/60 py-3.5 last:border-0">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="ms-auto h-4 w-28" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {sorted?.length === 0 && (
        <Card><div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
          <ClockCounterClockwise className="size-8" />
          <p className="text-[14.5px]">No analyses yet. Run one from the Dashboard and it will show up here.</p>
        </div></Card>
      )}

      {sorted && sorted.length > 0 && (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4 text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">File</TableHead>
                <TableHead className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">Modulation</TableHead>
                <SortHeader label="Confidence" active={sort.key === 'confidence'} dir={sort.dir} onClick={() => toggleSort('confidence')} />
                <SortHeader label="SNR" active={sort.key === 'snr'} dir={sort.dir} onClick={() => toggleSort('snr')} />
                <TableHead className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">Demod</TableHead>
                <SortHeader label="Bits" active={sort.key === 'recoveredBits'} dir={sort.dir} onClick={() => toggleSort('recoveredBits')} />
                <TableHead className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">BER</TableHead>
                <TableHead className="text-[12.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">FEC</TableHead>
                <SortHeader label="Date" active={sort.key === 'createdAt'} dir={sort.dir} onClick={() => toggleSort('createdAt')} />
                <TableHead className="w-[84px] pe-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => {
                const when = fmtDate(item.createdAt);
                const low = item.confidence < 70;
                return (
                  <TableRow
                    key={item.id}
                    onClick={() => open(item.id)}
                    aria-disabled={busyId === item.id}
                    className={cn('group cursor-pointer', busyId === item.id && 'pointer-events-none opacity-60')}
                  >
                    <TableCell className="ps-4">
                      <span className="block max-w-[220px] truncate text-[14px] font-medium">{item.fileName}</span>
                      {item.sampleRate != null && item.duration != null && (
                        <span className="block text-[12px] text-muted-foreground">
                          {formatSampleRate(item.sampleRate)} · {formatDuration(item.duration)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="soft">{item.modulation}</Badge>
                      {item.family && <span className="ms-2 text-[12.5px] text-muted-foreground">{item.family}</span>}
                    </TableCell>
                    <TableCell>
                      <span className={cn('tnum text-[14px] font-medium', low && 'text-warning')}>{item.confidence.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="tnum text-[14px] text-muted-foreground">
                      {item.snr != null ? formatSNR(item.snr) : DASH}
                    </TableCell>
                    <TableCell>
                      {item.demodStatus ? (
                        <Badge variant={demodTone(item.demodStatus)}>{item.demodStatus}</Badge>
                      ) : DASH}
                    </TableCell>
                    <TableCell className="tnum text-[14px] text-muted-foreground">
                      {item.recoveredBits != null ? formatSamples(item.recoveredBits) : DASH}
                    </TableCell>
                    <TableCell className="tnum text-[14px] text-muted-foreground">
                      {item.berAfter != null ? formatBER(item.berAfter) : DASH}
                    </TableCell>
                    <TableCell className="text-[13.5px] text-muted-foreground">
                      {item.fecDetected ? (item.fecFamily ?? 'Detected') : item.fecDetected === false ? 'None' : DASH}
                    </TableCell>
                    <TableCell>
                      <span className="block text-[13.5px]">{when.date}</span>
                      <span className="block text-[12px] text-muted-foreground">{when.time}</span>
                    </TableCell>
                    <TableCell className="pe-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          onClick={(e) => remove(item.id, e)}
                          aria-label="Delete"
                        >
                          <TrashSimple className="size-4" />
                        </Button>
                        <CaretRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
