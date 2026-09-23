import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { MOCK_AMPLITUDE } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const data = MOCK_AMPLITUDE();
const TOOLTIP_STYLE = { background: '#fff', border: '1px solid #d0d4d8', borderRadius: 3, fontSize: 11, fontFamily: 'JetBrains Mono' };

export default function AmplitudeVsTime({ height = 220 }: { height?: number }) {
  const data = MOCK_AMPLITUDE();
  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Amplitude vs Time</span>
        <div style={{ fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          mean <span style={{ color: '#16a34a', fontWeight: 600 }}>0.707</span>
          <span style={{ marginLeft: 12 }}>PAPR <span style={{ color: 'var(--text-secondary)' }}>3.1 dB</span></span>
        </div>
      </div>
      <PlotToolbar />
      <div className="chart-inner">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 6, right: 24, left: 0, bottom: 18 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${Number(v).toFixed(1)}`}
              label={{ value: 'Time (s)', position: 'insideBottom', offset: -12, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8" tickLine={false} />
            <YAxis domain={[0.55, 0.85]} tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${Number(v).toFixed(2)}`}
              label={{ value: 'Amplitude', angle: -90, position: 'insideLeft', offset: 12, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8" tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `t: ${Number(v).toFixed(2)} s`} />
            <ReferenceLine y={0.707} stroke="rgba(22,163,74,0.3)" strokeDasharray="4 4" strokeWidth={1}
              label={{ value: '1/âˆš2', position: 'insideRight', fill: '#16a34a', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
            <Line type="monotone" dataKey="amplitude" stroke="#16a34a" strokeWidth={1.3} dot={false} name="Amp" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
