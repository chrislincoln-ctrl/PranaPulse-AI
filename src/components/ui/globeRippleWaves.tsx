import { type ReactElement } from 'react';
import { RIPPLE_AURA_MASK, RIPPLE_RING_GRADIENT, RIPPLE_RING_MASK } from './globeStyles.js';

const INTRO_BLUR_PX = 10;
const INTRO_AURA_ALPHA = 0.9;
const IDLE_A_BLUR_PX = 11;
const IDLE_B_BLUR_PX = 12;

function RippleRingPair({
  insetClass,
  auraInsetClass,
  blurPx,
  auraOpacity,
  ringOpacity,
}: {
  readonly insetClass: string;
  readonly auraInsetClass: string;
  readonly blurPx: number;
  readonly auraOpacity: number | string;
  readonly ringOpacity?: string;
}): ReactElement {
  return (
    <>
      <div
        className={`absolute ${insetClass}`}
        style={{ filter: `blur(${String(blurPx)}px)`, opacity: auraOpacity }}
      >
        <div
          className={`absolute ${auraInsetClass} rounded-full`}
          style={{
            background: RIPPLE_RING_GRADIENT,
            WebkitMaskImage: RIPPLE_AURA_MASK,
            maskImage: RIPPLE_AURA_MASK,
          }}
        />
      </div>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: RIPPLE_RING_GRADIENT,
          WebkitMaskImage: RIPPLE_RING_MASK,
          maskImage: RIPPLE_RING_MASK,
          ...(ringOpacity ? { opacity: ringOpacity } : {}),
        }}
      />
    </>
  );
}

function IntroRippleBurst(): ReactElement {
  return (
    <div
      className="pointer-events-none absolute -inset-[3%]"
      style={{
        transform: 'translate3d(1.8%, -1.6%, 0) scale(var(--orb-ripple-scale, 1))',
        opacity: 'calc(var(--orb-ripple-opacity, 0) * var(--orb-halo-mode-alpha, 1))',
        willChange: 'transform, opacity',
      }}
    >
      <RippleRingPair
        insetClass="-inset-[12px]"
        auraInsetClass="inset-[12px]"
        blurPx={INTRO_BLUR_PX}
        auraOpacity={INTRO_AURA_ALPHA}
      />
    </div>
  );
}

function RestingRipplePulses(): ReactElement {
  return (
    <>
      <div
        className="orb-ripple-idle pointer-events-none absolute -inset-[3%]"
        style={{ opacity: 0 }}
      >
        <RippleRingPair
          insetClass="-inset-[14px]"
          auraInsetClass="inset-[14px]"
          blurPx={IDLE_A_BLUR_PX}
          auraOpacity="calc(0.88 * var(--orb-halo-mode-alpha, 1))"
          ringOpacity="var(--orb-halo-mode-alpha, 1)"
        />
      </div>
      <div
        className="orb-ripple-idle-b pointer-events-none absolute -inset-[3%]"
        style={{ opacity: 0 }}
      >
        <RippleRingPair
          insetClass="-inset-[14px]"
          auraInsetClass="inset-[14px]"
          blurPx={IDLE_B_BLUR_PX}
          auraOpacity="calc(0.75 * var(--orb-halo-mode-alpha, 1))"
          ringOpacity="calc(0.85 * var(--orb-halo-mode-alpha, 1))"
        />
      </div>
    </>
  );
}

/** Layer 5: luminous intro ripple burst and alternating resting halo ripple pulses. */
export function GlobeRippleWaves({
  showIntroRipple,
  isResting,
}: {
  readonly showIntroRipple: boolean;
  readonly isResting: boolean;
}): ReactElement {
  return (
    <>
      {showIntroRipple && <IntroRippleBurst />}
      {isResting && <RestingRipplePulses />}
    </>
  );
}
