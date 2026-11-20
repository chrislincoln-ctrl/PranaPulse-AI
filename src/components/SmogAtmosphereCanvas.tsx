/* eslint-disable @typescript-eslint/no-magic-numbers, max-lines-per-function */
import { memo, useEffect, useRef, type ReactElement } from 'react';
import {
  SMOG_SIMULATION_PARAMS,
  type InversionSimulationMode,
} from '../config/uiConstants.js';

export interface SmogAtmosphereCanvasProps {
  readonly mode: InversionSimulationMode;
}

interface SmogParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulsePhase: number;
}

const DASH_SEGMENT_A = 6;
const DASH_SEGMENT_B = 5;
const INVERSION_LINE_WIDTH = 1.5;
const STOP_FIRST = 0.42;
const STOP_SECOND = 0.75;
const TWO_PI = Math.PI * 2;
const SPEED_SPREAD = 0.3;
const ALPHA_SPREAD = 0.12;
const PHASE_SPREAD = 6.28;
const BOUNCE_DAMP = 0.9;
const CEILING_PAD = 4;
const MIN_SPAN = 10;
const MIN_ALPHA = 0.02;

function createParticle(
  width: number,
  ceilingY: number,
  height: number,
  isSevere: boolean,
): SmogParticle {
  const spanY = Math.max(height - ceilingY - CEILING_PAD, MIN_SPAN);
  const minR = SMOG_SIMULATION_PARAMS.MIN_RADIUS;
  const maxR = isSevere
    ? SMOG_SIMULATION_PARAMS.MAX_RADIUS_SEVERE
    : SMOG_SIMULATION_PARAMS.MAX_RADIUS_CLEAN;
  const radius = minR + Math.random() * (maxR - minR);
  const baseAlpha = isSevere
    ? SMOG_SIMULATION_PARAMS.BASE_ALPHA_SEVERE
    : SMOG_SIMULATION_PARAMS.BASE_ALPHA_CLEAN;

  return {
    x: Math.random() * width,
    y: ceilingY + CEILING_PAD + Math.random() * spanY,
    vx: (Math.random() - 0.5) * SPEED_SPREAD + (isSevere ? 0.25 : 0.4),
    vy: (Math.random() - 0.5) * SMOG_SIMULATION_PARAMS.BROWNIAN_JITTER,
    radius,
    baseAlpha: baseAlpha + (Math.random() - 0.5) * ALPHA_SPREAD,
    pulsePhase: Math.random() * PHASE_SPREAD,
  };
}

function drawBackgroundSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isSevere: boolean,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (isSevere) {
    grad.addColorStop(0, '#3a2b1f');
    grad.addColorStop(STOP_FIRST, '#644830');
    grad.addColorStop(STOP_SECOND, '#966c42');
    grad.addColorStop(1, '#be9466');
  } else {
    grad.addColorStop(0, '#1c2f42');
    grad.addColorStop(STOP_FIRST, '#3a5975');
    grad.addColorStop(STOP_SECOND, '#6586a6');
    grad.addColorStop(1, '#98b7d5');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawInversionLid(
  ctx: CanvasRenderingContext2D,
  width: number,
  ceilingY: number,
  isSevere: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = isSevere
    ? 'rgba(245, 130, 32, 0.85)'
    : 'rgba(130, 215, 255, 0.7)';
  ctx.lineWidth = INVERSION_LINE_WIDTH;
  ctx.setLineDash([DASH_SEGMENT_A, DASH_SEGMENT_B]);
  ctx.beginPath();
  ctx.moveTo(0, ceilingY);
  ctx.lineTo(width, ceilingY);
  ctx.stroke();
  ctx.restore();
}

function updateAndDrawParticles(config: {
  ctx: CanvasRenderingContext2D;
  particles: SmogParticle[];
  ceilingY: number;
  width: number;
  height: number;
  isSevere: boolean;
}): void {
  const { ctx, particles, ceilingY, width, height, isSevere } = config;
  const colorPrefix = isSevere ? 'rgba(235, 190, 140, ' : 'rgba(210, 235, 255, ';
  for (const p of particles) {
    p.pulsePhase += SMOG_SIMULATION_PARAMS.PULSE_BASE;
    const alphaPulse = Math.max(
      MIN_ALPHA,
      p.baseAlpha + Math.sin(p.pulsePhase) * SMOG_SIMULATION_PARAMS.PULSE_AMP * p.baseAlpha,
    );
    ctx.fillStyle = `${colorPrefix}${alphaPulse.toFixed(SMOG_SIMULATION_PARAMS.DECIMAL_PLACES)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, TWO_PI);
    ctx.fill();

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -p.radius) {
      p.x = width + p.radius;
    } else if (p.x > width + p.radius) {
      p.x = -p.radius;
    }
    if (p.y - p.radius < ceilingY) {
      p.y = ceilingY + p.radius + 1;
      p.vy = Math.abs(p.vy) * BOUNCE_DAMP;
    } else if (p.y + p.radius > height) {
      p.y = height - p.radius - 1;
      p.vy = -Math.abs(p.vy) * BOUNCE_DAMP;
    }
  }
}

/**
 * Atmospheric aerosol simulation canvas demonstrating thermal inversion ceiling trapping.
 */
export const SmogAtmosphereCanvas = memo(function SmogAtmosphereCanvas({
  mode,
}: SmogAtmosphereCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSevere = mode === 'severe';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const ratio = isSevere
      ? SMOG_SIMULATION_PARAMS.SEVERE_CEILING_RATIO
      : SMOG_SIMULATION_PARAMS.CLEAN_CEILING_RATIO;
    const ceilingY = Math.floor(height * ratio);
    const count = isSevere
      ? SMOG_SIMULATION_PARAMS.SEVERE_PARTICLE_COUNT
      : SMOG_SIMULATION_PARAMS.CLEAN_PARTICLE_COUNT;

    const particles: SmogParticle[] = Array.from({ length: count }, () =>
      createParticle(width, ceilingY, height, isSevere),
    );

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const renderFrame = (): void => {
      drawBackgroundSky(ctx, width, height, isSevere);
      drawInversionLid(ctx, width, ceilingY, isSevere);
      updateAndDrawParticles({
        ctx,
        particles,
        ceilingY,
        width,
        height,
        isSevere,
      });
    };

    if (mediaQuery.matches) {
      renderFrame();
      return;
    }

    let animId: number;
    const loop = (): void => {
      renderFrame();
      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isSevere]);

  return (
    <canvas
      ref={canvasRef}
      width={SMOG_SIMULATION_PARAMS.DEFAULT_WIDTH}
      height={SMOG_SIMULATION_PARAMS.DEFAULT_HEIGHT}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
});
