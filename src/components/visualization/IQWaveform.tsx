import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { MOCK_IQ } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const iqData = MOCK_IQ();

export default function IQWaveform({ height = 220, showAmplitude = false }: { height?: number; showAmplitude?: boolean }) {
  const iqData = MOCK_IQ();
  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">I/Q Waveform</span>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          <span style={{ color: '#2563eb' }}>â€” I (blue)</span>
          <span style={{ color: '#9333ea' }}>â€” Q (purple)</span>
          {showAmplitude && <span style={{ color: '#16a34a' }}>â€” |A| (green)</span>}
        </div>
      </div>
      <PlotToolbar />
      <div className="chart-inner">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={iqData} margin={{ top: 6, right: 24, left: 0, bottom: 18 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${Number(v).toFixed(0)}`}
              label={{ value: 'Time (Î¼s)', position: 'insideBottom', offset: -12, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8" tickLine={false}
            />
            <YAxis
              domain={[-1.3, 1.3]}
              tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              stroke="#d0d4d8" tickLine={false}
              label={{ value: 'Amplitude', angle: -90, position: 'insideLeft', offset: 12, fill: '#8892a0', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #d0d4d8', borderRadius: 3, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              labelFormatter={(v) => `t: ${Number(v).toFixed(1)} Î¼s`}
            />
            <ReferenceLine y={0} stroke="#e4e6e8" strokeWidth={1} />
            <Line type="linear" dataKey="i" stroke="#2563eb" strokeWidth={1.2} dot={false} name="I" isAnimationActive={false} />
            <Line type="linear" dataKey="q" stroke="#9333ea" strokeWidth={1.2} dot={false} name="Q" isAnimationActive={false} />
            {showAmplitude && (
              <Line type="monotone" dataKey="amplitude" stroke="#16a34a" strokeWidth={0.9} dot={false} name="|A|" isAnimationActive={false} strokeDasharray="3 2" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
