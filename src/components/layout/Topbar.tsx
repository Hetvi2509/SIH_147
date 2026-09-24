import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { FileAudio, Play, SpinnerGap } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import UserAvatar from '@/components/auth/UserAvatar';
import { useAuth } from '@/context/AuthContext';
import Wordmark from '@/components/common/Wordmark';
import StatusPill from '@/components/common/StatusPill';
import { useAnalysis } from '@/context/AnalysisContext';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/visualizations': 'Visualizations',
  '/parameters': 'Parameters',
  '/modulation': 'Modulation',
  '/synchronization': 'Synchronization',
  '/demodulation': 'Demodulation',
  '/fec': 'FEC / Interleaver',
  '/bitstream': 'Bit Stream Analysis',
  '/report': 'Report',
};

export default function Topbar() {
  const { state, runAnalysis } = useAnalysis();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const meta = state.fileMetadata;
  const analyzing = state.overallStatus === 'analyzing';
  const done = state.pipeline.filter((s) => s.status === 'completed').length;
  const pct = analyzing ? Math.round((done / state.pipeline.length) * 100) : 0;

  // Ctrl/Cmd + Enter runs the analysis from anywhere. No animation on a keyboard action.
  const run = useRef(runAnalysis);
  run.current = runAnalysis;
  const canRun = useRef(false);
  canRun.current = !!meta && !analyzing;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRun.current) { e.preventDefault(); run.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Announce the outcome once when a run finishes.
  const prev = useRef(state.overallStatus);
  useEffect(() => {
    if (prev.current === 'analyzing' && state.overallStatus === 'completed' && state.classification) {
      toast.success('Analysis complete', {
        description: `${state.classification.modulation} detected at ${state.classification.confidence.toFixed(1)}% confidence.`,
      });
    }
    if (prev.current === 'analyzing' && state.overallStatus === 'error') {
      toast.error('Analysis failed', { description: state.error ?? undefined });
    }
    prev.current = state.overallStatus;
  }, [state.overallStatus, state.classification, state.error]);

  const status =
    state.overallStatus === 'completed' ? { v: 'success' as const, l: 'Analysis complete' } :
    analyzing                           ? { v: 'active' as const, l: `Analyzing ${pct}%` } :
    state.overallStatus === 'error'     ? { v: 'error' as const, l: 'Analysis failed' } :
    state.overallStatus === 'uploading' ? { v: 'active' as const, l: 'Reading file' } :
                                          { v: 'muted' as const, l: meta ? 'Ready to analyze' : 'No signal' };

  const label = analyzing ? 'Analyzing' : state.overallStatus === 'completed' ? 'Re-run analysis' : 'Analyze signal';

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-sm sm:px-6">
      {/* Left: where am I */}
      <div className="flex min-w-0 items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild><SidebarTrigger className="-ms-1.5 size-8 text-muted-foreground" /></TooltipTrigger>
          <TooltipContent>Toggle sidebar <Kbd className="ms-1">Ctrl B</Kbd></TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-5" />

        {user && (
          <>
            <div className="flex items-center gap-2.5" title={user.email}>
              <UserAvatar name={user.name} className="size-8" />
              <span className="max-w-[9rem] truncate text-[14px] font-medium max-xl:hidden">{user.name}</span>
            </div>
            <Separator orientation="vertical" className="h-5" />
          </>
        )}

        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap gap-2 text-[14px] sm:gap-2.5">
            <BreadcrumbItem className="whitespace-nowrap max-lg:hidden">
              <BreadcrumbLink asChild>
                <Link to="/dashboard" className="transition-opacity duration-150 hover:opacity-80"><Wordmark /></Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="max-lg:hidden [&>svg]:size-3.5" />
            <BreadcrumbItem>
              <BreadcrumbPage className="whitespace-nowrap font-display text-[17px] leading-none tracking-[-0.01em] text-foreground">
                {TITLES[pathname] ?? 'Dashboard'}
              </BreadcrumbPage>
            </BreadcrumbItem>
            {meta && (
              <>
                <BreadcrumbSeparator className="max-lg:hidden [&>svg]:size-3.5" />
                <BreadcrumbItem className="min-w-0 max-lg:hidden">
                  <span className="flex min-w-0 items-center gap-2 rounded-md bg-secondary/80 py-1 pe-2.5 ps-2 text-[13px]">
                    <FileAudio weight="duotone" className="size-4 shrink-0 text-primary" />
                    <span className="truncate font-medium" title={meta.fileName}>{meta.fileName}</span>
                    <span className="hidden shrink-0 text-muted-foreground xl:inline">{meta.format}</span>
                  </span>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right: state and the one primary action */}
      <div className="ms-auto flex shrink-0 items-center gap-3">
        <StatusPill variant={status.v}>{status.l}</StatusPill>
        <Separator orientation="vertical" className="h-5 max-sm:hidden" />
        <Button onClick={runAnalysis} disabled={!meta || analyzing} className="h-9 px-4">
          {analyzing ? <SpinnerGap className="animate-spin" /> : <Play weight="fill" />}
          {label}
          {!analyzing && <Kbd className="ms-1 bg-white/20 text-primary-foreground max-lg:hidden">Ctrl ↵</Kbd>}
        </Button>
      </div>

      {analyzing && <Progress value={pct} className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent" />}
    </header>
  );
}
