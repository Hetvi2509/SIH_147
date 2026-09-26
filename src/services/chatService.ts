// ============================================================
// Chat service — conversational assistant over the current analysis
// ============================================================

import type { AnalysisState } from '../types';
import { getAuthToken } from '../lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Compact snapshot of the analysis state for the assistant — drops the large
 *  per-sample arrays (iq/spectrum/waterfall/eye points) and keeps everything
 *  else, since those are already summarized (SNR, PAPR, sample count, ...). */
function buildContext(state: AnalysisState): Record<string, unknown> {
  const { classification, pipeline, isLoading, error, ...rest } = state;
  return {
    ...rest,
    classification: classification
      ? { ...classification, preview: classification.preview ? {
          sampleCount: classification.preview.sampleCount,
          meanAmplitude: classification.preview.meanAmplitude,
          paprDb: classification.preview.paprDb,
        } : undefined }
      : null,
  };
}

export async function sendChatMessage(
  messages: ChatMessage[],
  state: AnalysisState,
): Promise<string> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/chat/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, context: buildContext(state) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Assistant error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.reply as string;
}
