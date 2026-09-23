import { useState } from 'react';
import IQWaveform from './IQWaveform';
import AmplitudeVsTime from './AmplitudeVsTime';
import FreqVsTime from './FreqVsTime';
import PhaseVsTime from './PhaseVsTime';
import SpectrumChart from './SpectrumChart';
import WaterfallChart from './WaterfallChart';
import ConstellationChart from './ConstellationChart';
import EyeDiagram from './EyeDiagram';

const TABS = [
  { id: 'iq', label: 'I/Q Waveform' },
  { id: 'amplitude', label: 'Amplitude/Time' },
  { id: 'freq-time', label: 'Freq vs Time' },
  { id: 'phase-time', label: 'Phase vs Time' },
  { id: 'spectrum', label: 'FFT / Spectrum' },
  { id: 'waterfall', label: 'Spectrogram' },
  { id: 'constellation', label: 'Constellation' },
  { id: 'eye', label: 'Eye Diagram' },
] as const;

type TabId = typeof TABS[number]['id'];

interface VisualizationWorkspaceProps {
  defaultTab?: TabId;
}

export default function VisualizationWorkspace({ defaultTab = 'spectrum' }: VisualizationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  return (
    <div>
      {/* Tab bar */}
      <div className="tabs" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart content */}
      <div className="fade-in" key={activeTab}>
        {activeTab === 'iq' && <IQWaveform height={320} showAmplitude />}
        {activeTab === 'amplitude' && <AmplitudeVsTime height={320} />}
        {activeTab === 'freq-time' && <FreqVsTime height={320} />}
        {activeTab === 'phase-time' && <PhaseVsTime height={320} />}
        {activeTab === 'spectrum' && <SpectrumChart height={320} />}
        {activeTab === 'waterfall' && <WaterfallChart height={360} />}
        {activeTab === 'constellation' && <ConstellationChart height={360} />}
        {activeTab === 'eye' && <EyeDiagram height={320} />}
      </div>
    </div>
  );
}
