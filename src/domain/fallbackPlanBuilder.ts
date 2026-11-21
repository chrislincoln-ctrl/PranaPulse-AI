import { buildLocalizedChatReply, buildLocalizedFallbackPlan } from '../i18n/fallbackTemplates.js';
import { buildPerMemberSchedules } from './memberScheduleBuilder.js';
import type {
  AqiAssessment,
  CommuteOptionEvaluation,
  CorridorRouteComparison,
  IndoorClearanceSummary,
  InversionAnalysis,
  RwaCollectiveImpact,
} from './types.js';
import type {
  AiPlanOutput,
  ChatRequestPayload,
  PlanRequestPayload,
} from '../validators/schemas.js';

export interface DeterministicBriefContext {
  readonly request: PlanRequestPayload;
  readonly aqi: AqiAssessment;
  readonly effectiveAqi: number;
  readonly inversion: InversionAnalysis;
  readonly indoor: IndoorClearanceSummary;
  readonly bestCommute: CommuteOptionEvaluation;
  readonly corridor: CorridorRouteComparison;
  readonly rwa: RwaCollectiveImpact;
}

const STREAM_CHUNK_SIZE = 32;

/**
 * Generates a fully localized, deterministic, physics-grounded 4-step daily plan
 * when Gemini API quota is unavailable or verification fails.
 *
 * @param ctx - Verified atmospheric and exposure context.
 * @returns Schema-compliant action routine, indoor hacks, and sustainable swaps.
 */
export function buildDeterministicFallbackPlan(ctx: DeterministicBriefContext): AiPlanOutput {
  return {
    ...buildLocalizedFallbackPlan(ctx),
    memberSchedules: buildPerMemberSchedules(ctx),
  };
}

/**
 * Generates chunked fallback conversational guidance when Gemini API is absent or unavailable.
 *
 * @param input - Sanitized user query and live atmospheric metrics.
 * @returns Streamed UTF-8 chunks grounded strictly in verified telemetry.
 */
export function buildDeterministicChatChunks(input: ChatRequestPayload): readonly string[] {
  const fullReply = buildLocalizedChatReply(input);
  const chunks: string[] = [];
  for (let i = 0; i < fullReply.length; i += STREAM_CHUNK_SIZE) {
    chunks.push(fullReply.slice(i, i + STREAM_CHUNK_SIZE));
  }
  return chunks;
}
