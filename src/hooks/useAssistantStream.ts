import { useCallback, useRef, useState } from 'react';
import { SECURITY_LIMITS } from '../config/constants.js';
import { PRECISION_DISPLAY } from '../config/uiConstants.js';
import type { InversionSeverity } from '../domain/types.js';
import type { ChatRequestPayload, SupportedLanguage } from '../validators/schemas.js';

export interface AssistantTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly isFallback?: boolean;
}

interface SseEventData {
  readonly chunk?: string;
  readonly done?: boolean;
  readonly isFallback?: boolean;
}

export interface StreamContext {
  readonly city: string;
  readonly language: SupportedLanguage;
  readonly cpcbNaqi: number;
  readonly pm25UgM3: number;
  readonly inversionSeverity: InversionSeverity;
  readonly openWindowsNow: boolean;
}

function makeTurnId(): string {
  return `t-${Math.random()
    .toString(PRECISION_DISPLAY.RADIX)
    .slice(PRECISION_DISPLAY.ID_SLICE_START, PRECISION_DISPLAY.ID_SLICE_END)}`;
}

function parseSseDataLine(line: string): SseEventData | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return null;
  }
  try {
    return JSON.parse(trimmed.slice('data:'.length).trim()) as SseEventData;
  } catch {
    return null;
  }
}

async function readStreamChunks(
  res: Response,
  onEvent: (evt: SseEventData) => void,
): Promise<void> {
  if (!res.body) {
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const evt = parseSseDataLine(line);
      if (evt) {
        onEvent(evt);
      }
    }
  }
}

async function dispatchStreamRequest(
  payload: ChatRequestPayload,
  signal: AbortSignal,
  onEvent: (evt: SseEventData) => void,
): Promise<void> {
  const res = await fetch('/api/assistant/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${String(res.status)}`);
  }
  await readStreamChunks(res, onEvent);
}

function applyStreamEvent(
  prev: readonly AssistantTurn[],
  assistantId: string,
  evt: SseEventData,
): readonly AssistantTurn[] {
  return prev.map((turn) => {
    if (turn.id !== assistantId) {
      return turn;
    }
    const nextText = evt.chunk ? `${turn.text}${evt.chunk}` : turn.text;
    return evt.done
      ? { ...turn, text: nextText, isFallback: Boolean(evt.isFallback) }
      : { ...turn, text: nextText };
  });
}

/**
 * Manages SSE conversational air quality Q&A streaming grounded strictly
 * in the active location's atmospheric telemetry.
 */
export function useAssistantStream() {
  const [turns, setTurns] = useState<readonly AssistantTurn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendQuestion = useCallback(
    async (rawQuery: string, context: StreamContext): Promise<void> => {
      const trimmed = rawQuery.trim().slice(0, SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS);
      if (!trimmed || isStreaming) {
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantId = makeTurnId();
      setStreamError(null);
      setIsStreaming(true);
      setTurns((prev) => [
        ...prev,
        { id: makeTurnId(), role: 'user', text: trimmed },
        { id: assistantId, role: 'assistant', text: '' },
      ]);

      try {
        await dispatchStreamRequest({ query: trimmed, ...context }, controller.signal, (evt) => {
          setTurns((prev) => applyStreamEvent(prev, assistantId, evt));
        });
      } catch {
        setStreamError('Unable to reach guidance stream right now.');
      } finally {
        if (!controller.signal.aborted) {
          setIsStreaming(false);
        }
      }
    },
    [isStreaming],
  );

  return { turns, isStreaming, streamError, sendQuestion };
}
