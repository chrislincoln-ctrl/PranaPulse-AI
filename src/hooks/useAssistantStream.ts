import { useCallback, useRef, useState } from 'react';
import { HTTP_STATUS, SECURITY_LIMITS } from '../config/constants.js';
import { PRECISION_DISPLAY } from '../config/uiConstants.js';
import type { InversionSeverity } from '../domain/types.js';
import { buildLocalizedChatReply } from '../i18n/fallbackTemplates.js';
import { readStreamLines } from '../utils/sseStreamReader.js';
import type { ChatRequestPayload, SupportedLanguage } from '../validators/schemas.js';

export type AdvisorProviderTag = 'gemini' | 'groq' | 'deterministic';

export interface AssistantTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly isFallback?: boolean;
  readonly provider?: AdvisorProviderTag;
  readonly queryPrompt?: string;
}

interface SseEventData {
  readonly chunk?: string;
  readonly done?: boolean;
  readonly isFallback?: boolean;
  readonly provider?: AdvisorProviderTag;
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
  if (!res.body) {
    return false;
  }
  let receivedChunk = false;
  await readStreamLines(res.body, (line) => {
    const evt = parseSseDataLine(line);
    if (!evt) {
      return;
    }
    if (evt.chunk && evt.chunk.length > 0) {
      receivedChunk = true;
    }
    onEvent(evt);
  });
  return receivedChunk;
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
    if (!evt.done) {
      return { ...turn, text: nextText };
    }
    const resolvedProvider: AdvisorProviderTag =
      evt.provider ?? (evt.isFallback ? 'deterministic' : 'gemini');
    return {
      ...turn,
      text: nextText,
      isFallback: Boolean(evt.isFallback),
      provider: resolvedProvider,
    };
  });
}

function applyFallbackAnswer(
  prev: readonly AssistantTurn[],
  assistantId: string,
  payload: ChatRequestPayload,
): readonly AssistantTurn[] {
  const fallbackText = buildLocalizedChatReply(payload);
  return prev.map((turn) =>
    turn.id === assistantId
      ? { ...turn, text: fallbackText, isFallback: true, provider: 'deterministic' }
      : turn,
  );
}

interface StreamExecutionArgs {
  readonly controller: AbortController;
  readonly assistantId: string;
  readonly payload: ChatRequestPayload;
  readonly setTurns: React.Dispatch<React.SetStateAction<readonly AssistantTurn[]>>;
  readonly setStreamError: React.Dispatch<React.SetStateAction<string | null>>;
  readonly setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
}

function handleStreamFailure(err: unknown, args: StreamExecutionArgs): void {
  if (args.controller.signal.aborted) {
    return;
  }
  if (err instanceof StreamHttpError && err.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    args.setTurns((prev) => prev.filter((turn) => turn.id !== args.assistantId));
    args.setStreamError('Too many advisor requests — wait a few seconds and retry.');
    return;
  }
  args.setTurns((prev) => applyFallbackAnswer(prev, args.assistantId, args.payload));
}

async function runStreamTurn(args: StreamExecutionArgs): Promise<void> {
  try {
    const received = await dispatchStreamRequest(args.payload, args.controller.signal, (evt) => {
      args.setTurns((prev) => applyStreamEvent(prev, args.assistantId, evt));
    });
    if (!received && !args.controller.signal.aborted) {
      args.setTurns((prev) => applyFallbackAnswer(prev, args.assistantId, args.payload));
    }
  } catch (err: unknown) {
    handleStreamFailure(err, args);
  } finally {
    if (!args.controller.signal.aborted) {
      args.setIsStreaming(false);
    }
  }
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
    async (
      rawQuery: string,
      context: StreamContext,
      preferredProvider: 'auto' | 'groq' = 'auto',
    ): Promise<void> => {
      const trimmed = rawQuery.trim().slice(0, SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS);
      if (!trimmed || isStreaming) {
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantId = makeTurnId();
      const payload: ChatRequestPayload = { query: trimmed, ...context, preferredProvider };
      const userLabel =
        preferredProvider === 'groq' ? `Second opinion (Groq): ${trimmed}` : trimmed;
      setStreamError(null);
      setIsStreaming(true);
      setTurns((prev) => [
        ...prev,
        { id: makeTurnId(), role: 'user', text: userLabel },
        { id: assistantId, role: 'assistant', text: '', queryPrompt: trimmed },
      ]);
      await runStreamTurn({
        controller,
        assistantId,
        payload,
        setTurns,
        setStreamError,
        setIsStreaming,
      });
    },
    [isStreaming],
  );

  return { turns, isStreaming, streamError, sendQuestion };
}
