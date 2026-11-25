import { type ReactElement } from 'react';
import { ORB_IMAGE_SRC, type ParticleSpec } from './globeClock.js';
import {
  BEZEL_SURFACE_STYLE,
  buildFrozenDelayStyle,
  buildParticleCssStyle,
  COOL_HALO_GRADIENT,
  COOL_RIM_GRADIENT,
  GLASS_GLARE_STYLE,
  HALO_RING_SOURCE_MASK,
  THIN_RING_MASK,
  VIGNETTE_OVERLAY_STYLE,
  WARM_HALO_GRADIENT,
  WARM_RIM_GRADIENT,
} from './globeStyles.js';

const WARM_RIM_BLUR_PX = 6;
const COOL_RIM_BLUR_PX = 7;

function HaloBlurRing({
  gradient,
  opacityExpr,
}: {
  readonly gradient: string;
  readonly opacityExpr: string;
}): ReactElement {
  return (
    <div
      className="absolute inset-0"
      style={{ filter: 'blur(26px)', opacity: opacityExpr, willChange: 'opacity' }}
    >
      <div
        className="absolute inset-[17%] rounded-full"
        style={{
          background: gradient,
          WebkitMaskImage: HALO_RING_SOURCE_MASK,
          maskImage: HALO_RING_SOURCE_MASK,
        }}
      />
    </div>
  );
}

/** Layer 1: unclipped rotating blurred conic halo glow cross-fading warm to cool. */
export function GlobeHaloGlow({ devIntroT }: { readonly devIntroT: number | null }): ReactElement {
  return (
    <div
      className="orb-halo-spin pointer-events-none absolute -inset-[26%]"
      style={buildFrozenDelayStyle(devIntroT)}
    >
      <HaloBlurRing
        gradient={WARM_HALO_GRADIENT}
        opacityExpr="calc(var(--orb-warm, 0) * var(--orb-halo-mode-alpha, 1) * 0.80)"
      />
      <HaloBlurRing
        gradient={COOL_HALO_GRADIENT}
        opacityExpr="calc(var(--orb-cool, 1) * var(--orb-halo-mode-alpha, 1) * 0.82)"
      />
    </div>
  );
}

/** Unclipped bokeh particle layer orbiting and rising around the orb rim. */
export function GlobeParticleField({
  particles,
  palette,
  devIntroT,
}: {
  readonly particles: readonly ParticleSpec[];
  readonly palette: readonly [string, string, string];
  readonly devIntroT: number | null;
}): ReactElement {
  return (
    <div className="pointer-events-none absolute -inset-[45%]">
      {particles.map((pt) => (
        <span
          key={pt.id}
          className="orb-particle"
          style={buildParticleCssStyle(pt, palette[pt.colorIndex], devIntroT)}
        />
      ))}
    </div>
  );
}

function OrbSkylineImages({ devIntroT }: { readonly devIntroT: number | null }): ReactElement {
  return (
    <div
      className="orb-image-kenburns relative h-full w-full"
      style={buildFrozenDelayStyle(devIntroT)}
    >
      <img
        src={ORB_IMAGE_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="h-full w-full rounded-full object-cover"
      />
      <img
        src={ORB_IMAGE_SRC}
        alt=""
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full rounded-full object-cover"
        style={{
          filter: 'saturate(0.55) brightness(0.6) blur(2px)',
          opacity: 'var(--orb-haze, 0)',
          willChange: 'opacity',
        }}
      />
    </div>
  );
}

/** Layers 2 & 3: black glass bezel, clipped Ken-Burns skyline image, haze cross-fade, and lip highlight. */
export function GlobeCoreImage({ devIntroT }: { readonly devIntroT: number | null }): ReactElement {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={BEZEL_SURFACE_STYLE}
      />
      <div
        className="pointer-events-none absolute inset-[2px] overflow-hidden rounded-full"
        style={{ transform: 'scale(var(--orb-inner-scale, 1))', willChange: 'transform' }}
      >
        <div
          className="h-full w-full"
          style={{ transform: 'scale(var(--orb-img-scale, 1.05))', willChange: 'transform' }}
        >
          <OrbSkylineImages devIntroT={devIntroT} />
        </div>
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={VIGNETTE_OVERLAY_STYLE}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.22)',
            opacity: 'var(--orb-bezel-lip, 0)',
          }}
        />
      </div>
    </>
  );
}

function RimBloomLayer({
  gradient,
  blurPx,
  bloomOpacity,
  sharpOpacity,
}: {
  readonly gradient: string;
  readonly blurPx: number;
  readonly bloomOpacity: string;
  readonly sharpOpacity: string;
}): ReactElement {
  return (
    <>
      <div
        className="pointer-events-none absolute -inset-[10px]"
        style={{
          filter: `blur(${String(blurPx)}px)`,
          opacity: bloomOpacity,
          willChange: 'opacity',
        }}
      >
        <div
          className="absolute inset-[8px] rounded-full"
          style={{
            background: gradient,
            WebkitMaskImage: THIN_RING_MASK,
            maskImage: THIN_RING_MASK,
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute -inset-[1px] rounded-full"
        style={{
          background: gradient,
          WebkitMaskImage: THIN_RING_MASK,
          maskImage: THIN_RING_MASK,
          opacity: sharpOpacity,
          willChange: 'opacity',
        }}
      />
    </>
  );
}

/** Layer 4: glass glare highlight plus warm and cool razor-sharp optical rim rings. */
export function GlobeRimLights(): ReactElement {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-[2px] rounded-full"
        style={GLASS_GLARE_STYLE}
      />
      <RimBloomLayer
        gradient={WARM_RIM_GRADIENT}
        blurPx={WARM_RIM_BLUR_PX}
        bloomOpacity="calc(var(--orb-warm, 0) * var(--orb-halo-mode-alpha, 1) * 0.85)"
        sharpOpacity="var(--orb-warm, 0)"
      />
      <RimBloomLayer
        gradient={COOL_RIM_GRADIENT}
        blurPx={COOL_RIM_BLUR_PX}
        bloomOpacity="calc(var(--orb-cool, 1) * var(--orb-halo-mode-alpha, 1) * 0.88)"
        sharpOpacity="var(--orb-cool, 1)"
      />
    </>
  );
}
