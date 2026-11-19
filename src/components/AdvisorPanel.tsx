import { MessageSquare, Send } from 'lucide-react';
import { memo, useState, type ReactElement, type SyntheticEvent } from 'react';
import { SECURITY_LIMITS, VALIDATION_BOUNDS } from '../config/constants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import {
  useAssistantStream,
  type AssistantTurn,
  type StreamContext,
} from '../hooks/useAssistantStream.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface AdvisorPanelProps {
  readonly input: PlanRequestPayload;
  readonly telemetry: TelemetrySnapshot;
  readonly groqConfigured?: boolean | undefined;
  readonly t: LocaleDictionary;
}

function resolveTurnSourceLabel(turn: AssistantTurn, t: LocaleDictionary): string {
  if (turn.provider === 'groq') {
    return 'Groq AI (live failover · grounded telemetry)';
  }
  return turn.isFallback ? t.aiSourceFallback : t.aiSourceGemini;
}

function buildStreamContext(
  input: PlanRequestPayload,
  telemetry: TelemetrySnapshot,
): StreamContext {
  return {
    city: telemetry.city.trim().slice(0, VALIDATION_BOUNDS.MAX_CITY_QUERY_LEN) || 'New Delhi',
    language: input.language,
    cpcbNaqi: Math.max(0, Math.round(telemetry.stationCrossCheck.effectiveSafetyAqi)),
    pm25UgM3: Math.max(0, Math.round(telemetry.currentPollutants.pm25UgM3)),
    inversionSeverity: telemetry.inversion.currentSeverity,
    openWindowsNow: telemetry.inversion.openWindowsNow,
  };
}

function TurnFooterRow({
  turn,
  isStreaming,
  groqConfigured,
  onSecondOpinion,
  t,
}: {
  readonly turn: AssistantTurn;
  readonly isStreaming: boolean;
  readonly groqConfigured: boolean;
  readonly onSecondOpinion: (query: string) => void;
  readonly t: LocaleDictionary;
}): ReactElement | null {
  if (turn.role !== 'assistant' || turn.isFallback === undefined) {
    return null;
  }
  const canCrossCheck = groqConfigured && !isStreaming && turn.provider === 'gemini';
  const promptText = turn.queryPrompt;
  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <span>{resolveTurnSourceLabel(turn, t)}</span>
      {canCrossCheck && promptText && (
        <button
          type="button"
          onClick={() => {
            onSecondOpinion(promptText);
          }}
          className="text-ink-2 underline decoration-rule-2 underline-offset-2 hover:text-accent hover:decoration-accent"
        >
          Second opinion (Groq)
        </button>
      )}
    </div>
  );
}

function ChatTranscript({
  turns,
  isStreaming,
  streamError,
  groqConfigured,
  onSecondOpinion,
  t,
}: {
  readonly turns: readonly AssistantTurn[];
  readonly isStreaming: boolean;
  readonly streamError: string | null;
  readonly groqConfigured: boolean;
  readonly onSecondOpinion: (query: string) => void;
  readonly t: LocaleDictionary;
}): ReactElement | null {
  if (turns.length === 0 && !streamError) {
    return null;
  }
  return (
    <div
      aria-live="polite"
      className="surface-recessed mt-4 max-h-64 space-y-3 overflow-y-auto p-3.5 text-sm break-words sm:p-4"
    >
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={turn.role === 'user' ? 'font-medium text-accent' : 'text-ink-2'}
        >
          <div>{turn.text || (isStreaming ? t.advisorStreamingLabel : '')}</div>
          <TurnFooterRow
            turn={turn}
            isStreaming={isStreaming}
            groqConfigured={groqConfigured}
            onSecondOpinion={onSecondOpinion}
            t={t}
          />
        </div>
      ))}
      {streamError && <p className="text-bad">{streamError}</p>}
    </div>
  );
}

function AdvisorChipsBar({
  chips,
  disabled,
  onSelectChip,
}: {
  readonly chips: readonly string[];
  readonly disabled: boolean;
  readonly onSelectChip: (chip: string) => void;
}): ReactElement {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => {
            onSelectChip(chip);
          }}
          className="btn-secondary touch-target w-full px-3 py-2 text-left text-xs leading-snug whitespace-normal sm:w-auto"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function AdvisorQueryForm({
  question,
  isStreaming,
  onChangeQuestion,
  onSubmit,
  t,
}: {
  readonly question: string;
  readonly isStreaming: boolean;
  readonly onChangeQuestion: (nextValue: string) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="advisor-input" className="sr-only">
        {t.advisorHeading}
      </label>
      <input
        id="advisor-input"
        type="text"
        maxLength={SECURITY_LIMITS.MAX_CHAT_QUERY_CHARS}
        value={question}
        placeholder={t.advisorPlaceholder}
        onChange={(e) => {
          onChangeQuestion(e.target.value);
        }}
        className="field-control flex-1 text-sm"
      />
      <button
        type="submit"
        disabled={isStreaming || question.trim().length === 0}
        className="btn-primary touch-target inline-flex items-center justify-center gap-2 text-sm"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        <span>{t.advisorSendButton}</span>
      </button>
    </form>
  );
}

function useAdvisorSubmission(
  stream: ReturnType<typeof useAssistantStream>,
  context: StreamContext,
) {
  const [question, setQuestion] = useState('');
  const submitQuery = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setQuestion('');
    void stream.sendQuestion(trimmed, context);
  };
  return {
    question,
    setQuestion,
    submitQuery,
    sendChip: (chip: string): void => {
      void stream.sendQuestion(chip, context);
    },
    sendGroq: (promptText: string): void => {
      void stream.sendQuestion(promptText, context, 'groq');
    },
  };
}

/**
 * Streaming conversational air quality Q&A panel grounded in current city telemetry.
 */
export const AdvisorPanel = memo(function AdvisorPanel({
  input,
  telemetry,
  groqConfigured = false,
  t,
}: AdvisorPanelProps): ReactElement {
  const stream = useAssistantStream();
  const actions = useAdvisorSubmission(stream, buildStreamContext(input, telemetry));

  return (
    <section
      aria-labelledby="advisor-heading"
      className="surface-hairline min-w-0 p-4 sm:p-6 lg:col-span-7"
    >
      <h3 id="advisor-heading" className="flex items-center gap-2 text-ink">
        <MessageSquare className="h-5 w-5 shrink-0 text-cool" aria-hidden="true" />
        <span>{t.advisorHeading}</span>
      </h3>
      <AdvisorChipsBar
        chips={t.advisorChips}
        disabled={stream.isStreaming}
        onSelectChip={actions.sendChip}
      />
      <AdvisorQueryForm
        question={actions.question}
        isStreaming={stream.isStreaming}
        onChangeQuestion={actions.setQuestion}
        onSubmit={actions.submitQuery}
        t={t}
      />
      <ChatTranscript
        turns={stream.turns}
        isStreaming={stream.isStreaming}
        streamError={stream.streamError}
        groqConfigured={groqConfigured}
        onSecondOpinion={actions.sendGroq}
        t={t}
      />
    </section>
  );
});
