import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { MOCK_PHASE_VS_TIME } from '../../data/mockSignal';
import PlotToolbar from '../common/PlotToolbar';

const data = MOCK_PHASE_VS_TIME();
const TOOLTIP_STYLE = { background: '#fff', border: '1px solid #d0d4d8', borderRadius: 3, fontSize: 11, fontFamily: 'JetBrains Mono' };

export default function PhaseVsTime({ height = 220 }: { height?: number }) {
  const data = MOCK_PHASE_VS_TIME();
  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Phase vs Time</span>
        <div style={{ fontSize: '0.67rem', fontFamily: 'var(--font-mono)', color: 'var(--chart-label)' }}>
          QPSK 4-state &nbsp;|&nbsp; offset <span style={{ color: '#d97706', fontWeight: 600 }}>+13.4Â°</span>
        </div>
      </div>
      <PlotToolbar />
      <div className="chart-inner">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 6, right: 24, left: 0, bottom: 18 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="2 6" vertical={false} />
            <XAxis type="number" dataKey="time"
              tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${Number(v).toFixed(0)}`}
              label={{ value: 'Time (Î¼s)', position: 'insideBottom', offset: -12, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8" tickLine={false} name="Time" />
            <YAxis type="number" dataKey="phase" domain={[-200, 220]}
              tick={{ fill: '#8892a0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${v}Â°`}
              label={{ value: 'Phase (Â°)', angle: -90, position: 'insideLeft', offset: 12, fill: '#8892a0', fontSize: 10 }}
              stroke="#d0d4d8" tickLine={false} name="Phase" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {[58.4, 148.4, -121.6, -31.6].map((ph) => (
              <ReferenceLine key={ph} y={ph} stroke="rgba(217,119,6,0.15)" strokeDasharray="4 6" strokeWidth={1} />
            ))}
            <Scatter data={data} fill="#ea580c" opacity={0.5} r={1.5} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
