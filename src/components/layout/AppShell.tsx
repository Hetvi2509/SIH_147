import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import AppSidebar from './AppSidebar';
import Topbar from './Topbar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={0}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <Topbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-2 sm:px-6 lg:px-8">{children}</main>
        </SidebarInset>
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
