import { useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import { AmbientSmogLayers } from '@/components/ConsoleSmogBackdrop';
import { getDevIntroTime, getIsDarkMode, INTRO_DURATION } from './globeClock.js';
import { startLandingSmokeEngine } from './landingSmokeEngine.js';
import {
  evalSmokeIntroMultiplier,
  measureHeroTextRect,
  SMOKE_INTENSITY_BY_SECTION,
  SMOKE_MAX_ALPHA,
  TEXT_ALPHA_CAP,
} from './landingSmokeShader.js';

export { INTRO_DURATION, SMOKE_INTENSITY_BY_SECTION, SMOKE_MAX_ALPHA, TEXT_ALPHA_CAP };

/** Props for the landing page WebGL atmospheric smog backdrop. */
export interface SmokeCanvasProps {
  readonly activeSection: number;
  readonly scrollProgress: number;
  readonly heroTextRef: RefObject<HTMLDivElement | null>;
}

const FALLBACK_SECTION_INTENSITY = 0.2;
const CENTER_ALPHA_MULT = 0.35;
const EDGE_MID_MULT = 0.45;
const RIGHT_ALPHA_MULT = 0.72;
const ALPHA_DIGITS = 3;

function SmokeCssFallback({
  activeSection,
  isDark,
}: {
  readonly activeSection: number;
  readonly isDark: boolean;
}): ReactElement {
  const devT = getDevIntroTime();
  const introFactor = devT !== null ? evalSmokeIntroMultiplier(devT) : 1.0;
  const sectionFactor = SMOKE_INTENSITY_BY_SECTION[activeSection] ?? FALLBACK_SECTION_INTENSITY;
  const maxAlpha = isDark ? SMOKE_MAX_ALPHA.dark : SMOKE_MAX_ALPHA.light;
  const textCap = isDark ? TEXT_ALPHA_CAP.dark : TEXT_ALPHA_CAP.light;
  const rgb = isDark ? '205, 215, 220' : '70, 80, 90';
  const edgeAlpha = Math.min(maxAlpha, maxAlpha * sectionFactor * introFactor);
  const centerAlpha = Math.min(textCap, edgeAlpha * CENTER_ALPHA_MULT);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden transition-opacity duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
      style={{ opacity: 1 }}
    >
      <div
        className="smoke-fallback-blob-a absolute -top-[10%] -left-[12%] h-[58vh] w-[46vw] rounded-full blur-[48px]"
        style={{
          background: `radial-gradient(ellipse at 35% 35%, rgba(${rgb}, ${edgeAlpha.toFixed(ALPHA_DIGITS)}) 0%, rgba(${rgb}, ${(edgeAlpha * EDGE_MID_MULT).toFixed(ALPHA_DIGITS)}) 45%, transparent 74%)`,
        }}
      />
      <div
        className="smoke-fallback-blob-b absolute -bottom-[14%] -left-[8%] h-[62vh] w-[58vw] rounded-full blur-[54px]"
        style={{
          background: `radial-gradient(ellipse at 30% 70%, rgba(${rgb}, ${edgeAlpha.toFixed(ALPHA_DIGITS)}) 0%, rgba(${rgb}, ${centerAlpha.toFixed(ALPHA_DIGITS)}) 52%, transparent 78%)`,
        }}
      />
      <div
        className="smoke-fallback-blob-a absolute top-[18%] right-[6%] h-[56vh] w-[42vw] rounded-full blur-[56px]"
        style={{
          background: `radial-gradient(ellipse at 60% 50%, rgba(${rgb}, ${(edgeAlpha * RIGHT_ALPHA_MULT).toFixed(ALPHA_DIGITS)}) 0%, transparent 72%)`,
        }}
      />
    </div>
  );
}

function useFallbackThemeObserver(
  webglFailed: boolean,
  onThemeChange: (isDark: boolean) => void,
): void {
  useEffect(() => {
    if (!webglFailed || typeof document === 'undefined') {
      return undefined;
    }
    const observer = new MutationObserver(() => {
      onThemeChange(getIsDarkMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode'],
    });
    return () => {
      observer.disconnect();
    };
  }, [webglFailed, onThemeChange]);
}

function useSmokeSharedRefs(
  activeSection: number,
  scrollProgress: number,
  heroTextRef: RefObject<HTMLDivElement | null>,
) {
  const initialIntensity = SMOKE_INTENSITY_BY_SECTION[activeSection] ?? 1.0;
  const activeSectionRef = useRef(activeSection);
  const targetIntensityRef = useRef<number>(initialIntensity);
  const fromIntensityRef = useRef<number>(initialIntensity);
  const currentIntensityRef = useRef<number>(initialIntensity);
  const transitionStartRef = useRef<number>(0);
  const textRectRef = useRef<[number, number, number, number, number]>([0, 0, 0, 0, 0]);
  const triggerRedrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const nextTarget = SMOKE_INTENSITY_BY_SECTION[activeSection] ?? FALLBACK_SECTION_INTENSITY;
    if (activeSectionRef.current !== activeSection) {
      activeSectionRef.current = activeSection;
      fromIntensityRef.current = currentIntensityRef.current;
      targetIntensityRef.current = nextTarget;
      transitionStartRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      triggerRedrawRef.current?.();
    }
  }, [activeSection]);

  useEffect(() => {
    textRectRef.current = measureHeroTextRect(heroTextRef.current);
    triggerRedrawRef.current?.();
  }, [scrollProgress, activeSection, heroTextRef]);

  return useMemo(
    () => ({
      heroTextRef,
      targetIntensityRef,
      fromIntensityRef,
      currentIntensityRef,
      transitionStartRef,
      textRectRef,
      triggerRedrawRef,
    }),
    [heroTextRef],
  );
}

function useLandingSmokeCanvasState({
  activeSection,
  scrollProgress,
  heroTextRef,
}: SmokeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [isDarkState, setIsDarkState] = useState<boolean>(getIsDarkMode);
  const sharedRefs = useSmokeSharedRefs(activeSection, scrollProgress, heroTextRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') {
      return undefined;
    }
    const dispose = startLandingSmokeEngine({
      canvas,
      refs: sharedRefs,
      onThemeChange: setIsDarkState,
      onWebglLost: () => {
        setWebglFailed(true);
      },
    });
    if (!dispose) {
      setWebglFailed(true);
      return undefined;
    }
    return dispose;
  }, [sharedRefs]);

  useFallbackThemeObserver(webglFailed, setIsDarkState);
  return { canvasRef, webglFailed, isDarkState };
}

/** GPU-accelerated domain-warped winter smog canvas with graceful CSS fallback when WebGL is unavailable. */
export function SmokeCanvas(props: SmokeCanvasProps): ReactElement {
  const { canvasRef, webglFailed, isDarkState } = useLandingSmokeCanvasState(props);
  if (webglFailed) {
    return <SmokeCssFallback activeSection={props.activeSection} isDark={isDarkState} />;
  }
  return <AmbientSmogLayers canvasRef={canvasRef} zClass="z-[1]" />;
}

export default SmokeCanvas;
