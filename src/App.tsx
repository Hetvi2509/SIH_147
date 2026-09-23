import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnalysisProvider } from './context/AnalysisContext';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import FileUploadPage from './pages/FileUploadPage';
import VisualizationsPage from './pages/VisualizationsPage';
import ParametersPage from './pages/ParametersPage';
import ModulationPage from './pages/ModulationPage';
import SynchronizationPage from './pages/SynchronizationPage';
import DemodulationPage from './pages/DemodulationPage';
import FECPage from './pages/FECPage';
import ReportPage from './pages/ReportPage';
import './index.css';

export default function App() {
  return (
    <AnalysisProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<FileUploadPage />} />
            <Route path="/visualizations" element={<VisualizationsPage />} />
            <Route path="/parameters" element={<ParametersPage />} />
            <Route path="/modulation" element={<ModulationPage />} />
            <Route path="/synchronization" element={<SynchronizationPage />} />
            <Route path="/demodulation" element={<DemodulationPage />} />
            <Route path="/fec" element={<FECPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AnalysisProvider>
  );
}
