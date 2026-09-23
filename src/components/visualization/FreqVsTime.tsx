import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { MOCK_FREQ_VS_TIME } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const data = MOCK_FREQ_VS_TIME();
const TOOLTIP_STYLE = { background: '#fff', border: '1px solid #d0d4d8', borderRadius: 3, fontSize: 11, fontFamily: 'JetBrains Mono' };

export default function FreqVsTime({ height = 220 }: { height?: number }) {
  const data = MOCK_FREQ_VS_TIME();
  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Frequency vs Time</span>
        <div style={{ fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          CFO <span style={{ color: '#d97706', fontWeight: 600 }}>+2.8 kHz</span>
          <span style={{ marginLeft: 12 }}>drift <span style={{ color: 'var(--text-secondary)' }}>Â±0.1 kHz</span></span>
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
            <YAxis domain={[2446, 2456]} tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${v}`}
              label={{ value: 'kHz', angle: -90, position: 'insideLeft', offset: 12, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8" tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `t: ${Number(v).toFixed(2)} s`} />
            <ReferenceLine y={2450} stroke="rgba(217,119,6,0.3)" strokeDasharray="4 4" strokeWidth={1}
              label={{ value: 'Fc', position: 'insideRight', fill: '#d97706', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
            <ReferenceLine y={2452.8} stroke="rgba(217,119,6,0.4)" strokeDasharray="3 4" strokeWidth={1}
              label={{ value: '+CFO', position: 'insideRight', fill: '#d97706', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
            <Line type="monotone" dataKey="frequency" stroke="#0891b2" strokeWidth={1.4} dot={false} name="Freq" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
