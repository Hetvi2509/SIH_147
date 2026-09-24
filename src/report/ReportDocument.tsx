import type { ReactNode } from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AnalysisState } from '@/types';
import {
  MOCK_AMPLITUDE, MOCK_CONSTELLATION, MOCK_EYE, MOCK_FREQ_VS_TIME, MOCK_IQ, MOCK_PHASE_VS_TIME, MOCK_SPECTRUM,
} from '@/data/mockSignal';
import {
  formatBER, formatCFO, formatDuration, formatFileSize, formatPhase, formatPower, formatSampleRate, formatSamples,
} from '@/utils/formatters';
import { ConstellationPdf, EyePdf, LinePlot, ScatterPlot } from './pdfCharts';
import { T } from './theme';

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 56, paddingHorizontal: 42, fontFamily: 'Inter', fontSize: 9, color: T.ink, lineHeight: 1.45 },
  header: { position: 'absolute', top: 22, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.6, borderBottomColor: T.line, paddingBottom: 7 },
  headerText: { fontSize: 7.5, color: T.muted },
  footer: { position: 'absolute', bottom: 24, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: T.muted },

  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  mark: { width: 20, height: 20, borderRadius: 5, backgroundColor: T.orange, marginRight: 8 },
  brand: { fontFamily: 'Runde', fontSize: 14, color: T.ink },
  title: { fontFamily: 'Runde', fontSize: 30, lineHeight: 1.1, marginBottom: 6 },
  sub: { fontSize: 10, color: T.ink2, marginBottom: 16 },
  metaRow: { flexDirection: 'row', marginBottom: 20 },
  metaCell: { marginRight: 26 },
  metaLabel: { fontSize: 7.5, color: T.muted, marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: 500 },

  strip: { flexDirection: 'row', borderWidth: 0.8, borderColor: T.line, borderRadius: 8, marginBottom: 18 },
  stripCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderLeftWidth: 0.8, borderLeftColor: T.line },
  stripLabel: { fontSize: 7.5, color: T.muted, marginBottom: 5 },
  stripValue: { fontFamily: 'Runde', fontSize: 20, lineHeight: 1 },
  stripUnit: { fontSize: 8, color: T.muted },

  summaryBox: { backgroundColor: T.orangeSoft, borderRadius: 8, padding: 12, marginBottom: 20 },
  summaryTitle: { fontSize: 8, fontWeight: 600, color: T.orange, marginBottom: 4, letterSpacing: 0.6 },
  summaryText: { fontSize: 9.5, lineHeight: 1.55, color: T.ink },

  h2Row: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 9, paddingBottom: 5, borderBottomWidth: 0.8, borderBottomColor: T.line },
  h2Num: { fontFamily: 'Runde', fontSize: 11, color: T.orange, width: 20 },
  h2: { fontFamily: 'Runde', fontSize: 15 },
  h3: { fontSize: 8, fontWeight: 600, color: T.muted, letterSpacing: 0.6, marginBottom: 5, marginTop: 2 },
  lead: { fontSize: 8.5, color: T.ink2, marginBottom: 9 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4.2, borderBottomWidth: 0.5, borderBottomColor: T.line },
  rowLabel: { color: T.ink2, fontSize: 8.6 },
  rowValue: { fontWeight: 500, fontSize: 8.8, textAlign: 'right' },
  cols: { flexDirection: 'row' },
  col: { flex: 1 },

  chartBox: { borderWidth: 0.8, borderColor: T.line, borderRadius: 7, padding: 8, marginBottom: 10 },
  chartTitle: { fontSize: 8.6, fontWeight: 600, marginBottom: 1 },
  chartNote: { fontSize: 7.4, color: T.muted, marginBottom: 4 },

  th: { fontSize: 7.5, fontWeight: 600, color: T.muted },
  tr: { flexDirection: 'row', paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: T.line },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 42, fontSize: 8.6 },
  barTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: T.faint },
  barFill: { height: 5, borderRadius: 3 },
  barPct: { width: 38, textAlign: 'right', fontSize: 8.6 },

  mono: { fontFamily: 'Courier', fontSize: 8, lineHeight: 1.6, backgroundColor: T.faint, borderRadius: 6, padding: 8 },
  note: { fontSize: 7.6, color: T.muted, marginTop: 6, lineHeight: 1.5 },
});

const TONE: Record<string, string> = { good: T.green, warn: T.amber, bad: T.red, accent: T.orange };

type Row = [string, string, ('good' | 'warn' | 'bad' | 'accent')?];

const KV = ({ rows }: { rows: Row[] }) => (
  <View>
    {rows.map(([k, v, tone]) => (
      <View key={k} style={s.row} wrap={false}>
        <Text style={s.rowLabel}>{k}</Text>
        <Text style={[s.rowValue, tone ? { color: TONE[tone] } : {}, v.includes('⁻') ? { fontFamily: 'Runde', fontSize: 9.4 } : {}]}>{v}</Text>
      </View>
    ))}
  </View>
);

const H2 = ({ n, children, ahead = 160 }: { n: number; children: string; ahead?: number }) => (
  <View style={s.h2Row} minPresenceAhead={ahead}>
    <Text style={s.h2Num}>{String(n).padStart(2, '0')}</Text>
    <Text style={s.h2}>{children}</Text>
  </View>
);

const Chart = ({ title, note, children }: { title: string; note?: string; children: ReactNode }) => (
  <View style={s.chartBox} wrap={false}>
    <Text style={s.chartTitle}>{title}</Text>
    {note && <Text style={s.chartNote}>{note}</Text>}
    {children}
  </View>
);

const Cell = ({ label, value, unit, tone, first, grow = 1, small }: { label: string; value: string; unit?: string; tone?: string; first?: boolean; grow?: number; small?: boolean }) => (
  <View style={[s.stripCell, { flex: grow }, first ? { borderLeftWidth: 0 } : {}]}>
    <Text style={s.stripLabel}>{label}</Text>
    <Text style={[s.stripValue, small ? { fontSize: 15, marginTop: 4 } : {}, tone ? { color: TONE[tone] } : {}]}>
      {value}{unit ? <Text style={s.stripUnit}> {unit}</Text> : null}
    </Text>
  </View>
);

const mkXY = <R,>(rows: R[], x: keyof R, y: keyof R) => rows.map((r) => ({ x: r[x] as unknown as number, y: r[y] as unknown as number }));
const dbFmt = (v: number) => v.toFixed(0).replace('-', '−');

interface Props { state: AnalysisState; spectrogram?: string }

export default function ReportDocument({ state, spectrogram }: Props) {
  const { fileMetadata: meta, parameters: p, classification: cls, sync, demodulation: demod, fec, interleaver, ber, bitStream: bs, pipeline } = state;
  const generated = new Date().toLocaleString();
  const complete = state.overallStatus === 'completed';
  const name = meta?.fileName ?? 'signal';

  const iq = MOCK_IQ();
  const spec = MOCK_SPECTRUM();
  const freq = MOCK_FREQ_VS_TIME();
  const phase = MOCK_PHASE_VS_TIME();
  const amp = MOCK_AMPLITUDE();
  const constellation = MOCK_CONSTELLATION();
  const eye = MOCK_EYE();
  const fc = p?.centerFrequency ?? 2.45;

  const summary = [
    cls && `The recording ${name} was classified as ${cls.modulation} (${cls.family} family) with ${cls.confidence.toFixed(1)}% confidence`,
    p && `at ${p.snr.toFixed(1)} dB SNR and a center frequency of ${p.centerFrequency.toFixed(3)} MHz`,
  ].filter(Boolean).join(' ') + '.';
  const summary2 = [
    sync && `Synchronization ${sync.carrierLocked && sync.timingLocked ? 'locked on both carrier and symbol timing' : 'did not fully lock'}.`,
    demod && `Demodulation was ${demod.status}${demod.status === 'successful' ? `, recovering ${formatSamples(demod.recoveredBits)} bits` : ''}.`,
    fec && (fec.detected ? `${fec.family} coding at rate ${fec.codeRate} was detected${interleaver?.detected ? ` with a ${interleaver.type} interleaver` : ''}.` : 'No forward error correction was detected.'),
    bs && bs.recovered.totalBits > 0 && `The recovered stream contains ${formatSamples(bs.recovered.validBits)} valid bits (${formatSamples(bs.recovered.invalidBits)} invalid) and correlates with the reference at ${bs.correlation.score.toFixed(3)}, ${bs.correlation.detected ? 'above' : 'below'} the ${bs.correlation.threshold.toFixed(2)} detection threshold.`,
  ].filter(Boolean).join(' ');

  return (
    <Document title={`Signal analysis report - ${name}`} author="TarangChakra" subject="RF signal analysis and modulation classification">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Text style={s.headerText}>TarangChakra · Analysis report</Text>
          <Text style={s.headerText}>{name}</Text>
        </View>
        <View style={s.footer} fixed>
          <Text>Generated {generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        {/* Title block */}
        <View style={s.brandRow}>
          <View style={s.mark} />
          <Text style={s.brand}>Tarang<Text style={{ color: T.orange }}>Chakra</Text></Text>
        </View>
        <Text style={s.title}>Signal Analysis Report</Text>
        <Text style={s.sub}>Modulation classification, synchronization, demodulation and bit stream analysis</Text>
        <View style={s.metaRow}>
          <View style={s.metaCell}><Text style={s.metaLabel}>Signal file</Text><Text style={s.metaValue}>{name}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>Analysis ID</Text><Text style={s.metaValue}>{state.analysisId ?? 'n/a'}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>Generated</Text><Text style={s.metaValue}>{generated}</Text></View>
          <View><Text style={s.metaLabel}>Status</Text><Text style={[s.metaValue, { color: complete ? T.green : T.amber }]}>{complete ? 'Analysis complete' : 'Incomplete'}</Text></View>
        </View>

        {cls && (
          <View style={s.strip}>
            <Cell first label="Detected modulation" value={cls.modulation} tone="accent" />
            <Cell label="Confidence" value={cls.confidence.toFixed(1)} unit="%" />
            <Cell label="SNR" value={p ? p.snr.toFixed(1) : '—'} unit="dB" />
            <Cell label="BER before FEC" value={ber ? formatBER(ber.berBeforeFEC) : '—'} tone="warn" grow={1.5} small />
            <Cell label="BER after FEC" value={ber?.berAfterFEC != null ? formatBER(ber.berAfterFEC) : '—'} tone="good" grow={1.5} small />
          </View>
        )}

        <View style={s.summaryBox} wrap={false}>
          <Text style={s.summaryTitle}>SUMMARY</Text>
          <Text style={s.summaryText}>{summary} {summary2}</Text>
        </View>

        {/* 1 File */}
        <H2 n={1}>Signal and file</H2>
        {meta && (
          <View style={s.cols} wrap={false}>
            <View style={[s.col, { marginRight: 22 }]}>
              <KV rows={[['File name', meta.fileName], ['File type', meta.fileType], ['Format', meta.format], ['Layout', meta.layout], ['Data type', meta.dataType]]} />
            </View>
            <View style={s.col}>
              <KV rows={[['Endianness', meta.endianness ?? 'N/A'], ['File size', formatFileSize(meta.fileSize)], ['Sample rate', formatSampleRate(meta.sampleRate)], ['Samples', formatSamples(meta.numSamples)], ['Duration', formatDuration(meta.duration)]]} />
            </View>
          </View>
        )}

        {/* 2 Parameters */}
        {p && (
          <>
            <H2 n={2}>Signal parameters</H2>
            <Text style={s.lead}>RF characteristics extracted before classification.</Text>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 18 }]}>
                <Text style={s.h3}>RF</Text>
                <KV rows={[['Center frequency', `${p.centerFrequency.toFixed(3)} MHz`, 'accent'], ['Bandwidth', `${p.bandwidth.toFixed(1)} kHz`], ['Occupied BW', `${p.occupiedBandwidth.toFixed(1)} kHz`], ['Carrier offset', formatCFO(p.cfo), 'warn']]} />
              </View>
              <View style={[s.col, { marginRight: 18 }]}>
                <Text style={s.h3}>TIMING</Text>
                <KV rows={[['Sample rate', formatSampleRate(p.sampleRate)], ['Symbol rate', `${p.symbolRate} kSym/s`], ['Duration', `${p.duration.toFixed(2)} s`], ['Phase offset', formatPhase(p.phaseOffset), 'warn']]} />
              </View>
              <View style={s.col}>
                <Text style={s.h3}>SIGNAL QUALITY</Text>
                <KV rows={[['SNR', `${p.snr.toFixed(1)} dB`, 'good'], ['EVM', `${p.evm.toFixed(1)} %`], ['Channel', p.channelCondition], ['Quality', p.modulationQuality, 'good']]} />
              </View>
            </View>
            <View style={[s.cols, { marginTop: 10 }]} wrap={false}>
              <View style={[s.col, { marginRight: 18 }]}>
                <Text style={s.h3}>POWER</Text>
                <KV rows={[['Channel power', formatPower(p.channelPower)], ['Signal power', formatPower(p.signalPower)], ['Noise power', formatPower(p.noisePower)]]} />
              </View>
              <View style={[s.col, { marginRight: 18 }]}>
                <Text style={s.h3}> </Text>
                <KV rows={[['Peak power', formatPower(p.peakPower)], ['Average power', formatPower(p.averagePower)]]} />
              </View>
              <View style={s.col} />
            </View>

            <View style={{ marginTop: 12 }}>
              <Chart title="Power spectrum" note={`Center ${p.centerFrequency.toFixed(3)} MHz, bandwidth ${p.bandwidth.toFixed(1)} kHz, SNR ${p.snr.toFixed(1)} dB`}>
                <LinePlot
                  width={495} height={150} area
                  series={[{ data: mkXY(spec, 'freq', 'power'), color: T.chartOrange, width: 1 }, { data: mkXY(spec, 'freq', 'noise'), color: '#c9c2b8', width: 0.6 }]}
                  xLabel="Frequency (MHz)" yLabel="Power (dBm)" yDomain={[-85, -10]} xFmt={(v) => v.toFixed(2)} yFmt={dbFmt}
                  vLines={[{ value: fc, label: 'Fc' }]}
                />
              </Chart>
              <Chart title="I/Q waveform" note="In-phase (I), quadrature (Q) and envelope over the analysed window">
                <LinePlot
                  width={495} height={130}
                  series={[{ data: mkXY(iq, 'time', 'amplitude'), color: T.chartGreen, width: 0.6, dash: '2 2' }, { data: mkXY(iq, 'time', 'i'), color: T.chartOrange, width: 0.8 }, { data: mkXY(iq, 'time', 'q'), color: T.slate, width: 0.8 }]}
                  xLabel="Time (µs)" yLabel="Amplitude" yDomain={[-1.3, 1.3]} xFmt={(v) => v.toFixed(0)}
                />
              </Chart>
            </View>
          </>
        )}

        {/* 3 Modulation */}
        {cls && (
          <>
            <H2 n={3} ahead={230}>Modulation classification</H2>
            <Text style={s.lead}>{cls.modulation} detected in the {cls.family} family, scored against 14 classes by model {cls.modelVersion}.</Text>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <Text style={s.h3}>CLASS PROBABILITIES</Text>
                {cls.topK.map((r, i) => (
                  <View key={r.modulation} style={s.barRow}>
                    <Text style={[s.barLabel, i === 0 ? { fontWeight: 600 } : { color: T.ink2 }]}>{r.modulation}</Text>
                    <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(1, r.confidence)}%`, backgroundColor: i === 0 ? T.orange : '#cfc8be' }]} /></View>
                    <Text style={[s.barPct, i === 0 ? { fontWeight: 600 } : { color: T.ink2 }]}>{r.confidence.toFixed(1)}%</Text>
                  </View>
                ))}
                <View style={{ marginTop: 8 }}>
                  <KV rows={[['Confidence', `${cls.confidence.toFixed(1)} %`, 'good'], ['Inference time', `${cls.inferenceTimeMs} ms`], ['EVM', p ? `${p.evm.toFixed(1)} %` : '—']]} />
                </View>
              </View>
              <View style={{ width: 200 }}>
                <Text style={s.h3}>CONSTELLATION</Text>
                <ConstellationPdf size={200} points={constellation} />
              </View>
            </View>
          </>
        )}

        {/* 4 Sync */}
        {sync && (
          <>
            <H2 n={4} ahead={230}>Synchronization</H2>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <KV rows={[['Carrier lock', sync.carrierLocked ? 'Locked' : 'Failed', sync.carrierLocked ? 'good' : 'bad'], ['Symbol timing lock', sync.timingLocked ? 'Locked' : 'Failed', sync.timingLocked ? 'good' : 'bad'], ['Matched filter', sync.matchedFilterApplied ? 'Applied' : 'Not applied']]} />
              </View>
              <View style={s.col}>
                <KV rows={[['Carrier offset', formatCFO(sync.cfoEstimate), 'warn'], ['Phase offset', formatPhase(sync.phaseOffset), 'warn'], ['Timing offset', `${sync.timingOffset.toFixed(1)} samples`]]} />
              </View>
            </View>
            <View style={[s.cols, { marginTop: 10 }]} wrap={false}>
              <View style={[s.chartBox, { flex: 1, marginRight: 10 }]}>
                <Text style={s.chartTitle}>Frequency vs time</Text>
                <LinePlot width={238} height={120} series={[{ data: mkXY(freq, 'time', 'frequency'), color: T.chartOrange, width: 0.9 }]} xLabel="Time (s)" yLabel="kHz" yDomain={[fc * 1000 - 4, fc * 1000 + 6]} xFmt={(v) => v.toFixed(1)} yFmt={(v) => v.toFixed(0)} hLines={[{ value: fc * 1000, label: 'Fc' }]} />
              </View>
              <View style={[s.chartBox, { flex: 1 }]}>
                <Text style={s.chartTitle}>Phase vs time</Text>
                <ScatterPlot width={238} height={120} points={mkXY(phase, 'time', 'phase')} xLabel="Time (µs)" yLabel="Phase (°)" yDomain={[-200, 220]} xFmt={(v) => v.toFixed(0)} yFmt={(v) => v.toFixed(0)} />
              </View>
            </View>
          </>
        )}

        {/* 5 Demod */}
        {demod && (
          <>
            <H2 n={5} ahead={230}>Demodulation</H2>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <KV rows={[['Demodulator', demod.demodulatorFamily], ['Status', demod.status, demod.status === 'successful' ? 'good' : 'warn'], ['Detected modulation', demod.detectedModulation, 'accent']]} />
              </View>
              <View style={s.col}>
                <KV rows={[['Recovered symbols', formatSamples(demod.recoveredSymbols)], ['Recovered bits', formatSamples(demod.recoveredBits)], ['BER before decoding', formatBER(demod.berBeforeDecoding), 'warn'], ['BER after decoding', demod.berAfterDecoding != null ? formatBER(demod.berAfterDecoding) : 'N/A', 'good']]} />
              </View>
            </View>
            <View style={[s.cols, { marginTop: 10 }]} wrap={false}>
              <View style={[s.chartBox, { flex: 1, marginRight: 10 }]}>
                <Text style={s.chartTitle}>Eye diagram</Text>
                <EyePdf width={238} height={130} traces={eye} />
              </View>
              {spectrogram && (
                <View style={[s.chartBox, { flex: 1 }]}>
                  <Text style={s.chartTitle}>Spectrogram</Text>
                  <Text style={s.chartNote}>1.85 to 3.05 MHz · 0 to {(meta?.duration ?? 4.37).toFixed(2)} s · −80 to −10 dBm</Text>
                  <Image src={spectrogram} style={{ width: 238, height: 106 }} />
                </View>
              )}
            </View>
          </>
        )}

        {/* 6 FEC */}
        {fec && interleaver && ber && (
          <>
            <H2 n={6}>FEC and interleaver</H2>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <Text style={s.h3}>FORWARD ERROR CORRECTION</Text>
                <KV rows={fec.detected
                  ? [['Family', fec.family, 'accent'], ['Code rate', fec.codeRate], ['Decoding', fec.decodingStatus, fec.decodingStatus === 'successful' ? 'good' : 'bad'], ...(fec.errorBits != null ? [['Corrected errors', String(fec.errorBits), 'warn'] as Row] : [])]
                  : [['Detected', fec.detected === false ? 'No' : 'Unknown']]} />
              </View>
              <View style={s.col}>
                <Text style={s.h3}>INTERLEAVER</Text>
                <KV rows={interleaver.detected
                  ? [['Type', interleaver.type ?? '—', 'accent'], ['Depth', `${interleaver.depth ?? '—'} bits`], ['De-interleaving', interleaver.deinterleavingStatus, 'good']]
                  : [['Detected', 'No']]} />
              </View>
            </View>
            <View style={[s.cols, { marginTop: 10 }]} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <Text style={s.h3}>BIT ERROR RATE</Text>
                <KV rows={[['Before FEC', formatBER(ber.berBeforeFEC), 'warn'], ['After FEC', ber.berAfterFEC != null ? formatBER(ber.berAfterFEC) : 'N/A', 'good']]} />
              </View>
              <View style={s.col}>
                <Text style={s.h3}>BITS</Text>
                <KV rows={[['Analyzed', formatSamples(ber.totalBits)], ['Errors (raw)', formatSamples(ber.errorBits), 'warn'], ...(ber.decodedBits ? [['Decoded', formatSamples(ber.decodedBits), 'good'] as Row] : [])]} />
              </View>
            </View>
          </>
        )}

        {/* 7 Bit stream */}
        {bs && (
          <>
            <H2 n={7} ahead={260}>Bit stream analysis</H2>
            <Text style={s.lead}>Outputs of the final recovery stage: the recovered data and its correlation with the reference sequence.</Text>
            <Text style={s.h3}>RECOVERED DATA</Text>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <KV rows={[['Total recovered bits', formatSamples(bs.recovered.totalBits)], ['Valid bits', formatSamples(bs.recovered.validBits), 'good'], ['Invalid bits', formatSamples(bs.recovered.invalidBits), bs.recovered.invalidBits > 0 ? 'warn' : undefined as never]]} />
              </View>
              <View style={s.col}>
                <KV rows={[['Valid ratio', bs.recovered.totalBits > 0 ? `${((bs.recovered.validBits / bs.recovered.totalBits) * 100).toFixed(3)} %` : '—'], ['Encoding', bs.recovered.encoding], ['Preview length', `${bs.recovered.previewBits} bits`]]} />
              </View>
            </View>
            {bs.recovered.totalBits > 0 && (
              <View wrap={false} style={{ marginTop: 8 }}>
                <Text style={s.h3}>BIT SEQUENCE (FIRST {Math.min(128, bs.recovered.previewBits)} BITS)</Text>
                <Text style={s.mono}>{bs.recovered.bitPreview.slice(0, 128).match(/.{1,8}/g)?.join(' ')}</Text>
                <Text style={[s.h3, { marginTop: 8 }]}>HEX PREVIEW</Text>
                <Text style={[s.mono, { color: T.orange }]}>{bs.recovered.hexPreview}</Text>
              </View>
            )}
            <Text style={[s.h3, { marginTop: 14 }]}>CORRELATION</Text>
            <View style={s.cols} wrap={false}>
              <View style={[s.col, { marginRight: 22 }]}>
                <KV rows={[['Correlation score', bs.correlation.score.toFixed(3), bs.correlation.detected ? 'good' : 'warn'], ['Peak lag', `${bs.correlation.peakLag} symbols`], ['Sidelobe ratio', `${bs.correlation.sidelobeRatioDb.toFixed(1)} dB`]]} />
              </View>
              <View style={s.col}>
                <KV rows={[['Reference', bs.correlation.reference], ['Threshold', bs.correlation.threshold.toFixed(2)], ['Reference match', bs.correlation.detected ? 'Detected' : 'Not detected', bs.correlation.detected ? 'good' : 'warn']]} />
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <Chart title="Normalized cross-correlation" note={bs.correlation.reference}>
                <LinePlot
                  width={495} height={130}
                  series={[{ data: bs.correlation.series.map((q) => ({ x: q.lag, y: q.value })), color: T.chartOrange, width: 1 }]}
                  xLabel="Lag (symbols)" yLabel="Correlation" yDomain={[0, 1]} xDomain={[-64, 64]} xTicks={[-64, -32, 0, 32, 64]} yFmt={(v) => v.toFixed(2)}
                  hLines={[{ value: bs.correlation.threshold, label: 'threshold', color: T.amber }]}
                />
              </Chart>
            </View>
          </>
        )}

        {/* 8 Processing */}
        <H2 n={8}>Processing stages</H2>
        <View style={{ marginBottom: 6 }} wrap={false}>
          <View style={[s.tr, { borderBottomColor: T.ink }]}>
            <Text style={[s.th, { flex: 1 }]}>STAGE</Text>
            <Text style={[s.th, { width: 80 }]}>STATUS</Text>
            <Text style={[s.th, { width: 60, textAlign: 'right' }]}>TIME</Text>
          </View>
          {pipeline.map((st) => (
            <View key={st.id} style={s.tr}>
              <Text style={{ flex: 1 }}>{st.name}</Text>
              <Text style={{ width: 80, color: st.status === 'completed' ? T.green : T.amber }}>{st.status === 'completed' ? 'Completed' : st.status}</Text>
              <Text style={{ width: 60, textAlign: 'right' }}>{st.duration != null ? `${st.duration} ms` : '—'}</Text>
            </View>
          ))}
          <View style={[s.tr, { borderBottomWidth: 0 }]}>
            <Text style={{ flex: 1, fontWeight: 600 }}>Total</Text>
            <Text style={{ width: 80 }} />
            <Text style={{ width: 60, textAlign: 'right', fontWeight: 600 }}>{pipeline.reduce((t, x) => t + (x.duration ?? 0), 0)} ms</Text>
          </View>
        </View>
        <Text style={s.note}>
          Classification is produced by the SR-Mamba model. Parameter, synchronization, demodulation, FEC and bit stream values are derived from the classification result and file metadata for this run.
        </Text>
      </Page>
    </Document>
  );
}
