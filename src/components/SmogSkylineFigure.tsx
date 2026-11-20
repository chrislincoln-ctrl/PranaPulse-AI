import { memo, type ReactElement } from 'react';
import type { InversionSimulationMode } from '../config/uiConstants.js';

const OPACITY_DISTANT = '0.25';
const OPACITY_HAZE_SEVERE = '0.65';
const OPACITY_HAZE_CLEAN = '0.15';
const OPACITY_MIDGROUND = '0.55';
const OPACITY_FOREGROUND = '0.9';

const PATH_DISTANT =
  'M0,320 L0,210 L30,210 L30,170 L55,170 L55,210 L80,210 L80,140 L110,140 L110,210 L160,210 L160,110 L180,90 L200,110 L200,210 L240,210 L240,165 L275,165 L275,210 L330,210 L330,130 L365,130 L365,210 L420,210 L440,150 L460,150 L480,210 L520,210 L520,100 L545,80 L570,100 L570,210 L620,210 L620,155 L660,155 L660,210 L710,210 L730,120 L760,120 L780,210 L830,210 L830,145 L865,145 L865,210 L920,210 L920,95 L940,95 L960,210 L1010,210 L1010,160 L1050,160 L1050,210 L1110,210 L1110,135 L1145,135 L1145,210 L1200,210 L1200,320 Z';

const PATH_MIDGROUND =
  'M0,320 L0,240 L45,240 L45,215 L95,215 L95,240 L150,240 L150,190 L195,190 L195,240 L260,240 L280,205 L310,205 L330,240 L390,240 L390,180 L435,180 L435,240 L495,240 L515,210 L555,210 L575,240 L640,240 L640,195 L685,195 L685,240 L750,240 L770,200 L810,200 L830,240 L890,240 L890,185 L940,185 L940,240 L1000,240 L1020,210 L1060,210 L1080,240 L1150,240 L1150,195 L1200,195 L1200,320 Z';

const PATH_FOREGROUND =
  'M0,320 L0,270 L35,270 L40,260 L45,270 L80,270 L80,255 L120,255 L120,270 L180,270 L190,245 L200,245 L210,270 L290,270 L300,250 L340,250 L350,270 L430,270 L440,255 L480,255 L490,270 L580,270 L590,240 L630,240 L640,270 L720,270 L730,250 L770,250 L780,270 L860,270 L870,245 L910,245 L920,270 L1010,270 L1020,255 L1060,255 L1070,270 L1150,270 L1160,250 L1200,250 L1200,320 Z';

function HazeGradientDef({ isSevere }: { readonly isSevere: boolean }): ReactElement {
  return (
    <defs>
      <linearGradient id="skyline-haze-grad" x1="0" y1="0" x2="0" y2="1">
        <stop
          offset="0%"
          stopColor={isSevere ? '#b48a52' : '#8ab4d8'}
          stopOpacity={isSevere ? OPACITY_HAZE_SEVERE : OPACITY_HAZE_CLEAN}
        />
        <stop
          offset="100%"
          stopColor={isSevere ? '#523820' : '#4a6b8c'}
          stopOpacity={isSevere ? '0.85' : '0.25'}
        />
      </linearGradient>
    </defs>
  );
}

export interface SmogSkylineFigureProps {
  readonly mode: InversionSimulationMode;
}

/**
 * 3-plane layered urban skyline silhouette depicting atmospheric extinction
 * during severe thermal inversion versus clean convective air.
 */
export const SmogSkylineFigure = memo(function SmogSkylineFigure({
  mode,
}: SmogSkylineFigureProps): ReactElement {
  const isSevere = mode === 'severe';

  return (
    <svg
      viewBox="0 0 1200 320"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full sm:h-56 md:h-64"
    >
      <HazeGradientDef isSevere={isSevere} />
      <path
        d={PATH_DISTANT}
        className="text-ink"
        fill="currentColor"
        fillOpacity={OPACITY_DISTANT}
      />
      <rect
        x="0"
        y="120"
        width="1200"
        height="200"
        fill="url(#skyline-haze-grad)"
      />
      <path
        d={PATH_MIDGROUND}
        className="text-ink"
        fill="currentColor"
        fillOpacity={OPACITY_MIDGROUND}
      />
      <path
        d={PATH_FOREGROUND}
        className="text-ink"
        fill="currentColor"
        fillOpacity={OPACITY_FOREGROUND}
      />
    </svg>
  );
});
