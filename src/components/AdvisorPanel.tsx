import { MessageSquare, Send } from 'lucide-react';
import { memo, useState, type ReactElement, type SyntheticEvent } from 'react';
import { SECURITY_LIMITS } from '../config/constants.js';
import type { TelemetrySnapshot } from '../domain/localBaseline.js';
import { useAssistantStream, type AssistantTurn } from '../hooks/useAssistantStream.js';
import type { LocaleDictionary } from '../i18n/translations.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface AdvisorPanelProps {
  readonly input: PlanRequestPayload;
  readonly telemetry: TelemetrySnapshot;
  readonly t: LocaleDictionary;
}

function ChatTranscript({
  turns,
  isStreaming,
  streamError,
  t,
}: {
  readonly turns: readonly AssistantTurn[];
  readonly isStreaming: boolean;
  readonly streamError: string | null;
  readonly t: LocaleDictionary;
}): ReactElement {
  return (
    <div
      aria-live="polite"
      className="surface-recessed mt-4 max-h-64 space-y-3 overflow-y-auto p-4 text-sm"
    >
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={turn.role === 'user' ? 'font-medium text-accent' : 'text-ink-2'}
        >
          <div>{turn.text || (isStreaming ? t.advisorStreamingLabel : '')}</div>
          {turn.role === 'assistant' && turn.isFallback !== undefined && (
            <div className="mt-1 text-xs text-muted">
              {turn.isFallback ? t.aiSourceFallback : t.aiSourceGemini}
            </div>
          )}
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
          className="btn-secondary touch-target text-left text-xs"
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

/**
 * Streaming conversational air quality Q&A panel grounded in current city telemetry.
 */
export const AdvisorPanel = memo(function AdvisorPanel({
  input,
  telemetry,
  t,
}: AdvisorPanelProps): ReactElement {
  const [question, setQuestion] = useState('');
  const { turns, isStreaming, streamError, sendQuestion } = useAssistantStream();
  const context = {
    city: telemetry.city,
    language: input.language,
    cpcbNaqi: telemetry.stationCrossCheck.effectiveSafetyAqi,
    pm25UgM3: telemetry.currentPollutants.pm25UgM3,
    inversionSeverity: telemetry.inversion.currentSeverity,
    openWindowsNow: telemetry.inversion.openWindowsNow,
  };

  return (
    <section aria-labelledby="advisor-heading" className="surface-hairline p-6 lg:col-span-7">
      <h3 id="advisor-heading" className="flex items-center gap-2 text-ink">
        <MessageSquare className="h-5 w-5 text-cool" aria-hidden="true" />
        <span>{t.advisorHeading}</span>
      </h3>
      <AdvisorChipsBar
        chips={t.advisorChips}
        disabled={isStreaming}
        onSelectChip={(chip) => {
          void sendQuestion(chip, context);
        }}
      />
      <AdvisorQueryForm
        question={question}
        isStreaming={isStreaming}
        onChangeQuestion={setQuestion}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = question.trim();
          if (!trimmed) {
            return;
          }
          setQuestion('');
          void sendQuestion(trimmed, context);
        }}
        t={t}
      />
      {(turns.length > 0 || streamError) && (
        <ChatTranscript turns={turns} isStreaming={isStreaming} streamError={streamError} t={t} />
      )}
    </section>
  );
});
