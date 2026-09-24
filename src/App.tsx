import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AnalysisProvider } from './context/AnalysisContext';
import RequireAuth from './components/auth/RequireAuth';
import AppShell from './components/layout/AppShell';
import { Skeleton } from './components/ui/skeleton';

// One chunk per page: the shell paints first, and charts load with the pages that use them.
const pages = {
  dashboard: () => import('./pages/DashboardPage'),
  visualizations: () => import('./pages/VisualizationsPage'),
  parameters: () => import('./pages/ParametersPage'),
  modulation: () => import('./pages/ModulationPage'),
  synchronization: () => import('./pages/SynchronizationPage'),
  demodulation: () => import('./pages/DemodulationPage'),
  fec: () => import('./pages/FECPage'),
  bitstream: () => import('./pages/BitStreamPage'),
  report: () => import('./pages/ReportPage'),
};

const Login = lazy(() => import('./pages/auth/LoginPage'));
const Signup = lazy(() => import('./pages/auth/SignupPage'));
const Dashboard = lazy(pages.dashboard);
const Visualizations = lazy(pages.visualizations);
const Parameters = lazy(pages.parameters);
const Modulation = lazy(pages.modulation);
const Synchronization = lazy(pages.synchronization);
const Demodulation = lazy(pages.demodulation);
const FEC = lazy(pages.fec);
const BitStream = lazy(pages.bitstream);
const Report = lazy(pages.report);

function PageFallback() {
  return (
    <div className="space-y-4 pt-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-28 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

export default function App() {
  // After the first page is up, fetch the remaining chunks while the browser is idle,
  // so moving through the pipeline never waits on the network. Only for signed-in users.
  useEffect(() => {
    const warm = () => Object.values(pages).forEach((load) => load());
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 1500);
  }, []);

  return (
    <AuthProvider>
      <AnalysisProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
            <Route path="/signup" element={<Suspense fallback={null}><Signup /></Suspense>} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/visualizations" element={<Visualizations />} />
              <Route path="/parameters" element={<Parameters />} />
              <Route path="/modulation" element={<Modulation />} />
              <Route path="/synchronization" element={<Synchronization />} />
              <Route path="/demodulation" element={<Demodulation />} />
              <Route path="/fec" element={<FEC />} />
              <Route path="/bitstream" element={<BitStream />} />
              <Route path="/report" element={<Report />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AnalysisProvider>
    </AuthProvider>
  );
}
