import { useState } from 'react';
import type { FamilyMemberInput } from '../domain/types.js';
import type { PlanRequestPayload } from '../validators/schemas.js';

export interface CompanionChatTurn {
  readonly id: string;
  readonly memberLabel: string;
  readonly question: string;
  readonly reply: string;
  readonly metricsLabel: string;
  readonly scheduleUpdated: boolean;
}

export interface CompanionGpsPoint {
  readonly lat: number;
  readonly lon: number;
}

interface CompanionApiResponse {
  readonly reply: string;
  readonly resolvedCity: string;
  readonly aqi: number;
  readonly pm25UgM3: number;
  readonly pblMeters: number;
  readonly windKmh: number;
  readonly rhPercent: number;
  readonly habitPatch?: Partial<FamilyMemberInput>;
}

const GPS_TIMEOUT_MS = 8_000;

function hasPatchValues(patch: Partial<FamilyMemberInput> | undefined): boolean {
  return Boolean(patch && Object.values(patch).some((v) => v !== undefined));
}

function formatMetricsSummary(data: CompanionApiResponse): string {
  return `${data.resolvedCity} | NAQI ${String(data.aqi)} | PM2.5 ${String(data.pm25UgM3)} ug/m3 | PBL ${String(data.pblMeters)}m | Wind ${String(data.windKmh)} km/h | RH ${String(data.rhPercent)}%`;
}

async function postCompanionQuery(
  input: PlanRequestPayload,
  member: FamilyMemberInput,
  message: string,
  gpsPoint: CompanionGpsPoint | null,
): Promise<CompanionApiResponse | null> {
  const res = await fetch('/api/companion/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      member,
      message,
      city: input.city,
      lat: input.lat,
      lon: input.lon,
      ...(gpsPoint ? { gpsLat: gpsPoint.lat, gpsLon: gpsPoint.lon } : {}),
      language: input.language,
      areaM2: input.areaM2,
      cadrM3Hr: input.cadrM3Hr,
    }),
  });
  return res.ok ? ((await res.json()) as CompanionApiResponse) : null;
}

function requestBrowserGps(onFound: (pt: CompanionGpsPoint) => void): void {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onFound({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    },
    () => undefined,
    { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS },
  );
}

function buildTurnFromResponse(params: {
  readonly memberLabel: string;
  readonly question: string;
  readonly data: CompanionApiResponse;
  readonly updated: boolean;
  readonly index: number;
}): CompanionChatTurn {
  return {
    id: `${String(Date.now())}-${String(params.index)}`,
    memberLabel: params.memberLabel,
    question: params.question,
    reply: params.data.reply,
    metricsLabel: formatMetricsSummary(params.data),
    scheduleUpdated: params.updated,
  };
}

function useGpsAttachment() {
  const [gpsPoint, setGpsPoint] = useState<CompanionGpsPoint | null>(null);
  const toggleGps = (): void => {
    if (gpsPoint) {
      setGpsPoint(null);
      return;
    }
    requestBrowserGps(setGpsPoint);
  };
  return { gpsPoint, toggleGps };
}

/** Manages per-member Family Companion Chat state, optional GPS attachment, and habit patch syncing. */
export function useCompanionChat(
  input: PlanRequestPayload,
  onApplyMemberPatch: (memberId: string, patch: Partial<FamilyMemberInput>) => void,
) {
  const [selectedMemberId, setSelectedMemberId] = useState(input.members[0]?.id ?? 'm1');
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<readonly CompanionChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { gpsPoint, toggleGps } = useGpsAttachment();
  const activeMember = input.members.find((m) => m.id === selectedMemberId) ?? input.members[0];

  const sendQuestion = (questionText: string): void => {
    const cleaned = questionText.trim();
    if (!cleaned || !activeMember || isSending) {
      return;
    }
    setIsSending(true);
    setDraft('');
    void postCompanionQuery(input, activeMember, cleaned, gpsPoint)
      .then((data) => {
        if (!data) {
          return;
        }
        const updated = hasPatchValues(data.habitPatch);
        if (updated && data.habitPatch) {
          onApplyMemberPatch(activeMember.id, data.habitPatch);
        }
        setTurns((prev) => [
          ...prev,
          buildTurnFromResponse({
            memberLabel: activeMember.label,
            question: cleaned,
            data,
            updated,
            index: prev.length,
          }),
        ]);
      })
      .catch(() => undefined)
      .finally(() => {
        setIsSending(false);
      });
  };

  return {
    activeMember, draft, setDraft, turns, isSending, gpsPoint,
    setSelectedMemberId, toggleGps, sendQuestion,
  };
}
