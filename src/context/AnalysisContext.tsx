// ============================================================
// Analysis Context — Global application state
// ============================================================

import React, { createContext, useContext, useMemo, useReducer, useCallback, type ReactNode } from 'react';
import type { AnalysisState, PipelineStage, StageStatus } from '../types';
import { MOCK_INITIAL_STATE, MOCK_COMPLETED_STATE, MOCK_PIPELINE, USE_STATIC_DATA } from '../data/mockAnalysis';
import * as analysisService from '../services/analysisService';

// ---------------------------------------------------------------
// Actions
// ---------------------------------------------------------------
type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'FILE_UPLOADED'; payload: { analysisId: string; metadata: AnalysisState['fileMetadata'] } }
  | { type: 'SET_OVERALL_STATUS'; payload: AnalysisState['overallStatus'] }
  | { type: 'UPDATE_PIPELINE_STAGE'; payload: { id: string; status: StageStatus; duration?: number } }
  | { type: 'ANALYSIS_COMPLETED'; payload: Partial<AnalysisState> }
  | { type: 'SET_SEGMENT'; payload: { start: number; end: number } }
  | { type: 'RESET' };

// ---------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------
function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'FILE_UPLOADED':
      return {
        ...state,
        analysisId: action.payload.analysisId,
        fileMetadata: action.payload.metadata,
        overallStatus: 'uploading',
        segmentStart: 0,
        segmentEnd: action.payload.metadata?.duration ?? 0,
        pipeline: MOCK_PIPELINE.map((s) => ({ ...s, status: 'pending' as StageStatus })),
      };
    case 'SET_OVERALL_STATUS':
      return { ...state, overallStatus: action.payload };
    case 'UPDATE_PIPELINE_STAGE':
      return {
        ...state,
        pipeline: state.pipeline.map((s) =>
          s.id === action.payload.id
            ? { ...s, status: action.payload.status, duration: action.payload.duration }
            : s
        ),
      };
    case 'ANALYSIS_COMPLETED':
      return { ...state, ...action.payload, isLoading: false, overallStatus: 'completed' };
    case 'SET_SEGMENT':
      return { ...state, segmentStart: action.payload.start, segmentEnd: action.payload.end };
    case 'RESET':
      return MOCK_INITIAL_STATE;
    default:
      return state;
  }
}

// ---------------------------------------------------------------
// Context
// ---------------------------------------------------------------
interface AnalysisContextValue {
  state: AnalysisState;
  uploadFile: (file: File) => Promise<void>;
  runAnalysis: () => Promise<void>;
  setSegment: (start: number, end: number) => void;
  reset: () => void;
  exportJSON: () => Promise<void>;
  exportPDF: () => Promise<void>;
  exportCSV: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// ---------------------------------------------------------------
// Provider
// ---------------------------------------------------------------
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, USE_STATIC_DATA ? MOCK_COMPLETED_STATE : MOCK_INITIAL_STATE);

  const updateStage = (id: string, status: StageStatus, duration?: number) =>
    dispatch({ type: 'UPDATE_PIPELINE_STAGE', payload: { id, status, duration } });

  const uploadFile = useCallback(async (file: File) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { analysisId, metadata } = await analysisService.uploadSignal(file);
      dispatch({ type: 'FILE_UPLOADED', payload: { analysisId, metadata } });
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: 'File upload failed.' });
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!state.analysisId) return;
    dispatch({ type: 'SET_OVERALL_STATUS', payload: 'analyzing' });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Stage 1 — File input
      updateStage('file-input', 'processing');
      await new Promise((r) => setTimeout(r, 350));
      updateStage('file-input', 'completed', 350);

      // Stage 2 — Preprocessing
      updateStage('preprocessing', 'processing');
      await new Promise((r) => setTimeout(r, 500));
      updateStage('preprocessing', 'completed', 500);

      // Stage 3 — Modulation classification (REAL backend call)
      updateStage('modulation-classification', 'processing');
      const classification = await analysisService.getClassification(state.analysisId);
      updateStage('modulation-classification', 'completed', classification.inferenceTimeMs);

      // Stage 4 — Parameter extraction, derived from the real classification
      updateStage('parameter-extraction', 'processing');
      const params = await analysisService.getParameters(state.analysisId);
      updateStage('parameter-extraction', 'completed', 800);

      // Stage 5 — Synchronization (derived from classification)
      updateStage('synchronization', 'processing');
      const sync = await analysisService.getSynchronization(state.analysisId);
      updateStage('synchronization', 'completed', 600);

      // Stage 6 — Demodulation
      updateStage('demodulation', 'processing');
      const demod = await analysisService.getDemodulation(state.analysisId);
      updateStage('demodulation', 'completed', 450);

      // Stage 7 — FEC / Interleaver
      updateStage('fec-interleaver', 'processing');
      const [fec, interleaver, ber] = await Promise.all([
        analysisService.getFEC(state.analysisId),
        analysisService.getInterleaver(state.analysisId),
        analysisService.getBER(state.analysisId),
      ]);
      updateStage('fec-interleaver', 'completed', 400);

      // Stage 8 — Bit stream analysis (recovered data + correlation)
      updateStage('bit-stream-analysis', 'processing');
      const t0 = performance.now();
      const bitStream = await analysisService.getBitStream(state.analysisId);
      updateStage('bit-stream-analysis', 'completed', Math.round(performance.now() - t0));

      // Stage 9 — Final report
      updateStage('final-report', 'processing');
      await new Promise((r) => setTimeout(r, 200));
      updateStage('final-report', 'completed', 200);

      dispatch({
        type: 'ANALYSIS_COMPLETED',
        payload: { parameters: params, classification, sync, demodulation: demod, fec, interleaver, ber, bitStream },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      dispatch({ type: 'SET_ERROR', payload: message });
      dispatch({ type: 'SET_OVERALL_STATUS', payload: 'error' });
      // Mark the currently processing stage as failed
      dispatch({
        type: 'UPDATE_PIPELINE_STAGE',
        payload: {
          id: state.pipeline.find((s) => s.status === 'processing')?.id ?? 'modulation-classification',
          status: 'failed',
        },
      });
    }
  }, [state.analysisId, state.pipeline]);

  const setSegment = useCallback((start: number, end: number) => {
    dispatch({ type: 'SET_SEGMENT', payload: { start, end } });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const exportJSON = useCallback(async () => {
    if (state.analysisId) await analysisService.exportJSON(state.analysisId, state);
  }, [state]);

  const exportPDF = useCallback(async () => {
    if (state.analysisId) await analysisService.exportPDF(state.analysisId, state);
  }, [state]);

  const exportCSV = useCallback(async () => {
    if (state.analysisId) await analysisService.exportCSV(state.analysisId, state);
  }, [state.analysisId]);

  const value = useMemo(
    () => ({ state, uploadFile, runAnalysis, setSegment, reset, exportJSON, exportPDF, exportCSV }),
    [state, uploadFile, runAnalysis, setSegment, reset, exportJSON, exportPDF, exportCSV],
  );

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

// ---------------------------------------------------------------
// Hook
// ---------------------------------------------------------------
export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used inside AnalysisProvider');
  return ctx;
}
