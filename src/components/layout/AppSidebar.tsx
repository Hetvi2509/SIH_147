import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ArrowsClockwise, Binary, Broadcast, CaretDown, CheckCircle, ChartLineUp, CircleNotch, Cpu,
  FileText, ShieldCheck, SlidersHorizontal, SquaresFour, WaveSine,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar';
import Wordmark from '@/components/common/Wordmark';
import { useAnalysis } from '@/context/AnalysisContext';
import type { AnalysisStage } from '@/types';
import { cn } from '@/lib/utils';

interface Item { to: string; label: string; icon: Icon; stage?: AnalysisStage }
interface Group { id: string; label: string; items: Item[] }

const GROUPS: Group[] = [
  { id: 'workspace', label: 'Workspace', items: [
    { to: '/dashboard', label: 'Dashboard', icon: SquaresFour },
  ]},
  { id: 'signal', label: 'Signal', items: [
    { to: '/visualizations', label: 'Visualizations', icon: ChartLineUp },
    { to: '/parameters', label: 'Parameters', icon: SlidersHorizontal, stage: 'parameter-extraction' },
  ]},
  { id: 'identify', label: 'Identify and Recover', items: [
    { to: '/modulation', label: 'Modulation', icon: Cpu, stage: 'modulation-classification' },
    { to: '/synchronization', label: 'Synchronization', icon: ArrowsClockwise, stage: 'synchronization' },
    { to: '/demodulation', label: 'Demodulation', icon: WaveSine, stage: 'demodulation' },
    { to: '/fec', label: 'FEC / Interleaver', icon: ShieldCheck, stage: 'fec-interleaver' },
    { to: '/bitstream', label: 'Bit Stream Analysis', icon: Binary, stage: 'bit-stream-analysis' },
  ]},
  { id: 'output', label: 'Output', items: [
    { to: '/report', label: 'Report', icon: FileText, stage: 'final-report' },
  ]},
];

const STORAGE_KEY = 'sidebar-groups';

function loadClosed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

/** Pipeline state for one stage, as a quiet trailing cue. */
function StageCue({ stage }: { stage?: AnalysisStage }) {
  const { state } = useAnalysis();
  if (!stage) return null;
  const s = state.pipeline.find((p) => p.id === stage)?.status;
  if (s === 'completed') return <CheckCircle weight="fill" aria-label="Completed" className="ms-auto size-3.5 shrink-0 text-success/80 group-data-[collapsible=icon]:hidden" />;
  if (s === 'processing') return <CircleNotch aria-label="Running" className="ms-auto size-3.5 shrink-0 animate-spin text-primary group-data-[collapsible=icon]:hidden" />;
  return null;
}

function NavGroup({ group, open, onOpenChange, activePath }: { group: Group; open: boolean; onOpenChange: (o: boolean) => void; activePath: string }) {
  const { state } = useAnalysis();
  const { state: sidebar } = useSidebar();
  const iconMode = sidebar === 'collapsed';

  const staged = group.items.filter((i) => i.stage);
  const doneCount = staged.filter((i) => state.pipeline.find((p) => p.id === i.stage)?.status === 'completed').length;

  return (
    <Collapsible open={iconMode ? true : open} onOpenChange={onOpenChange} className="group/nav">
      <SidebarGroup className="px-2 py-1">
        <CollapsibleTrigger
          className={cn(
            'group/trigger flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-[11px] font-medium tracking-[0.06em] text-muted-foreground/90 uppercase outline-none',
            'transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            'group-data-[collapsible=icon]:hidden',
          )}
        >
          <CaretDown
            weight="bold"
            className="size-3 shrink-0 transition-transform duration-200 ease-[var(--ease-out)] group-data-[state=closed]/nav:-rotate-90"
          />
          <span className="flex-1 text-start">{group.label}</span>
          {!open && staged.length > 0 && (
            <span className="tnum rounded-full bg-secondary px-1.5 text-[10.5px] leading-[18px] tracking-normal text-muted-foreground normal-case">
              {doneCount}/{staged.length}
            </span>
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
          <SidebarMenu className="gap-0.5 pt-0.5">
            {group.items.map((item) => {
              const active = activePath === item.to;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.label}
                    className={cn(
                      'relative h-9 gap-2.5 rounded-lg ps-3 text-[14px] font-medium text-sidebar-foreground/75',
                      'transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground',
                      'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
                      // Active marker: a 3px orange bar on the leading edge.
                      'before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity before:duration-150',
                      'data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden',
                    )}
                  >
                    <NavLink to={item.to}>
                      <item.icon weight={active ? 'fill' : 'regular'} className="size-[18px]" />
                      <span>{item.label}</span>
                      <StageCue stage={item.stage} />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export default function AppSidebar() {
  const { pathname } = useLocation();
  const [closed, setClosed] = useState<Record<string, boolean>>(loadClosed);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(closed)); } catch { /* storage unavailable */ }
  }, [closed]);

  // Landing on a page inside a collapsed group opens that group, so the active item is never hidden.
  useEffect(() => {
    const g = GROUPS.find((x) => x.items.some((i) => i.to === pathname));
    if (g && closed[g.id]) setClosed((c) => ({ ...c, [g.id]: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sidebar collapsible="icon" className="border-r-0 smooth-shadow-ring-xs">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border p-0 px-4 group-data-[collapsible=icon]:px-0">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground smooth-shadow-xs group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-lg">
            <Broadcast weight="bold" className="size-5 group-data-[collapsible=icon]:size-[18px]" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <Wordmark className="block font-display text-[18px] leading-none tracking-[-0.01em]" />
            <div className="mt-1.5 text-[11.5px] leading-none text-muted-foreground">Modulation analysis</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-3 group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:pt-3">
        {GROUPS.map((group, i) => (
          <div key={group.id} className={cn(i > 0 && 'group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border group-data-[collapsible=icon]:pt-1')}>
            <NavGroup
              group={group}
              activePath={pathname}
              open={!closed[group.id]}
              onOpenChange={(o) => setClosed((c) => ({ ...c, [group.id]: !o }))}
            />
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3 group-data-[collapsible=icon]:hidden">
        <p className="text-[12px] leading-snug text-muted-foreground">SR-Mamba classifier · 14 modulation classes</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
