import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { MOCK_SPECTRUM } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const spectrumData = MOCK_SPECTRUM();

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <div>f: <strong>{Number(label).toFixed(4)} MHz</strong></div>
        {payload.map((p: any) => (
          <div key={p.dataKey + p.name} style={{ color: p.color }}>
            {p.name}: {Number(p.value).toFixed(1)} dBm
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function SpectrumChart({ height = 280 }: { height?: number }) {
  const spectrumData = MOCK_SPECTRUM();
  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">FFT / Spectrum</span>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          <span>Fc <span style={{ color: '#d97706', fontWeight: 600 }}>2.450 MHz</span></span>
          <span>Pk <span style={{ color: '#0369a1' }}>âˆ’18.2 dBm</span></span>
          <span>BW <span style={{ color: '#0891b2' }}>185.4 kHz</span></span>
          <span>SNR <span style={{ color: '#16a34a' }}>18.7 dB</span></span>
        </div>
      </div>
      <PlotToolbar />
      <div className="chart-inner">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={spectrumData} margin={{ top: 6, right: 24, left: 0, bottom: 18 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="freq"
              tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => Number(v).toFixed(2)}
              label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -12, fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              stroke="#d0d4d8"
              tickLine={false}
            />
            <YAxis
              domain={[-85, -10]}
              tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${v}`}
              label={{ value: 'dBm', angle: -90, position: 'insideLeft', offset: 14, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8"
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area key="area-noise-fill" type="monotone" dataKey="noise" fill="rgba(100,116,139,0.06)" stroke="none" isAnimationActive={false} />
            <Line  key="line-power"     type="monotone" dataKey="power" stroke="#1d4ed8" strokeWidth={1.5} dot={false} name="Power" isAnimationActive={false} />
            <Line  key="line-noise-fl"  type="monotone" dataKey="noise" stroke="#cbd5e1" strokeWidth={0.8} dot={false} name="Noise" isAnimationActive={false} />
            <ReferenceLine x={2.450} stroke="#d9770660" strokeDasharray="4 4" strokeWidth={1}
              label={{ value: 'Fc', position: 'insideTopRight', fill: '#d97706', fontSize: 9, fontFamily: 'JetBrains Mono', dy: -2 }} />
            <ReferenceLine x={2.450 - 0.0927} stroke="#0891b230" strokeDasharray="2 5" strokeWidth={1} />
            <ReferenceLine x={2.450 + 0.0927} stroke="#0891b230" strokeDasharray="2 5" strokeWidth={1} />
            <ReferenceLine y={-72.4} stroke="#e2e8f0" strokeDasharray="3 6" strokeWidth={1}
              label={{ value: 'NF', position: 'insideRight', fill: '#94a3b8', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
