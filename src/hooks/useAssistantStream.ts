import { useCallback, useRef, useState } from 'react';
import { HTTP_STATUS, SECURITY_LIMITS } from '../config/constants.js';
import { PRECISION_DISPLAY } from '../config/uiConstants.js';
import type { InversionSeverity } from '../domain/types.js';
import { buildLocalizedChatReply } from '../i18n/fallbackTemplates.js';
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

class StreamHttpError extends Error {
  public readonly status: number;

  public constructor(status: number) {
    super(`HTTP ${String(status)}`);
    this.status = status;
  }
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

function emitParsedLines(lines: readonly string[], onEvent: (evt: SseEventData) => void): void {
  for (const line of lines) {
    const evt = parseSseDataLine(line);
    if (evt) {
      onEvent(evt);
    }
  }
}

async function readStreamChunks(
  res: Response,
  onEvent: (evt: SseEventData) => void,
): Promise<boolean> {
  if (!res.body) {
    return false;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedChunk = false;
  const wrappedOnEvent = (evt: SseEventData): void => {
    if (evt.chunk && evt.chunk.length > 0) {
      receivedChunk = true;
    }
    onEvent(evt);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    emitParsedLines(lines, wrappedOnEvent);
  }
  const trailing = `${buffer}${decoder.decode()}`;
  if (trailing.trim().length > 0) {
    emitParsedLines(trailing.split('\n'), wrappedOnEvent);
  }
  return receivedChunk;
}

async function dispatchStreamRequest(
  payload: ChatRequestPayload,
  signal: AbortSignal,
  onEvent: (evt: SseEventData) => void,
): Promise<boolean> {
  const res = await fetch('/api/assistant/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new StreamHttpError(res.status);
  }
  return await readStreamChunks(res, onEvent);
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

function applyFallbackAnswer(
  prev: readonly AssistantTurn[],
  assistantId: string,
  payload: ChatRequestPayload,
): readonly AssistantTurn[] {
  const fallbackText = buildLocalizedChatReply(payload);
  return prev.map((turn) =>
    turn.id === assistantId ? { ...turn, text: fallbackText, isFallback: true } : turn,
  );
}

function handleStreamFailure(params: {
  readonly err: unknown;
  readonly aborted: boolean;
  readonly assistantId: string;
  readonly payload: ChatRequestPayload;
  readonly setTurns: React.Dispatch<React.SetStateAction<readonly AssistantTurn[]>>;
  readonly setStreamError: React.Dispatch<React.SetStateAction<string | null>>;
}): void {
  if (params.aborted) {
    return;
  }
  if (
    params.err instanceof StreamHttpError &&
    params.err.status === HTTP_STATUS.TOO_MANY_REQUESTS
  ) {
    params.setTurns((prev) => prev.filter((turn) => turn.id !== params.assistantId));
    params.setStreamError('Too many advisor requests — wait a few seconds and retry.');
    return;
  }
  params.setTurns((prev) => applyFallbackAnswer(prev, params.assistantId, params.payload));
}

/**
 * Manages SSE conversational air quality Q&A streaming grounded strictly
 * in the active location's atmospheric telemetry, with seamless deterministic fallback.
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
      const payload: ChatRequestPayload = { query: trimmed, ...context };
      setStreamError(null);
      setIsStreaming(true);
      setTurns((prev) => [
        ...prev,
        { id: makeTurnId(), role: 'user', text: trimmed },
        { id: assistantId, role: 'assistant', text: '' },
      ]);

      try {
        const received = await dispatchStreamRequest(payload, controller.signal, (evt) => {
          setTurns((prev) => applyStreamEvent(prev, assistantId, evt));
        });
        if (!received && !controller.signal.aborted) {
          setTurns((prev) => applyFallbackAnswer(prev, assistantId, payload));
        }
      } catch (err: unknown) {
        handleStreamFailure({
          err,
          aborted: controller.signal.aborted,
          assistantId,
          payload,
          setTurns,
          setStreamError,
        });
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
