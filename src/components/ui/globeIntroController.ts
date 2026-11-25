import type { RefObject } from 'react';
import {
  applyOrbClock,
  broadcastHeroIntroStart,
  getDevIntroTime,
  hasPlayedHeroIntro,
  INTRO_DURATION,
  markHeroIntroPlayed,
  type OrbState,
} from './globeClock.js';

const MS_PER_SEC = 1000;
const WRAPPER_SETTLE_TIMEOUT_MS = 1480;

interface ClockHandles {
  cancelled: boolean;
  rafId: number | null;
  waitTimer: number | null;
}

function getRunningWrapperAnimations(rootEl: HTMLDivElement | null): Animation[] {
  const wrapper = rootEl?.closest('.fixed.z-10');
  if (!wrapper || typeof wrapper.getAnimations !== 'function') {
    return [];
  }
  return wrapper.getAnimations().filter((anim) => anim.playState === 'running');
}

function startOrbRafClock(
  orbEl: HTMLElement,
  handles: ClockHandles,
  setOrbState: (state: OrbState) => void,
): void {
  if (handles.cancelled) {
    return;
  }
  const startMs = performance.now();
  broadcastHeroIntroStart(startMs);
  const step = (nowMs: number): void => {
    if (handles.cancelled) {
      return;
    }
    const elapsedSec = Math.max(0, (nowMs - startMs) / MS_PER_SEC);
    if (elapsedSec >= INTRO_DURATION) {
      applyOrbClock(orbEl, INTRO_DURATION);
      markHeroIntroPlayed();
      setOrbState('resting');
      handles.rafId = null;
      return;
    }
    applyOrbClock(orbEl, elapsedSec);
    handles.rafId = requestAnimationFrame(step);
  };
  handles.rafId = requestAnimationFrame(step);
}

function scheduleIntroAfterWrapper(
  orbEl: HTMLElement,
  rootRef: RefObject<HTMLDivElement | null>,
  handles: ClockHandles,
  setOrbState: (state: OrbState) => void,
): void {
  handles.rafId = requestAnimationFrame(() => {
    if (handles.cancelled) {
      return;
    }
    const running = getRunningWrapperAnimations(rootRef.current);
    if (running.length === 0) {
      startOrbRafClock(orbEl, handles, setOrbState);
      return;
    }
    let started = false;
    const kickOff = (): void => {
      if (started || handles.cancelled) {
        return;
      }
      started = true;
      if (handles.waitTimer !== null) {
        window.clearTimeout(handles.waitTimer);
        handles.waitTimer = null;
      }
      startOrbRafClock(orbEl, handles, setOrbState);
    };
    void Promise.allSettled(running.map((anim) => anim.finished)).then(kickOff);
    handles.waitTimer = window.setTimeout(kickOff, WRAPPER_SETTLE_TIMEOUT_MS);
  });
}

function applyStaticOrbMode(
  orbEl: HTMLElement,
  handles: ClockHandles,
  setOrbState: (state: OrbState) => void,
  config: { readonly timeSec: number; readonly state: OrbState; readonly broadcast: boolean },
): void {
  if (handles.rafId !== null) {
    cancelAnimationFrame(handles.rafId);
    handles.rafId = null;
  }
  applyOrbClock(orbEl, config.timeSec);
  setOrbState(config.state);
  if (config.broadcast) {
    broadcastHeroIntroStart(-1);
  }
}

function initializeOrbPlayback(
  orbEl: HTMLElement,
  rootRef: RefObject<HTMLDivElement | null>,
  handles: ClockHandles,
  params: {
    readonly isReduced: boolean;
    readonly setOrbState: (state: OrbState) => void;
  },
): void {
  const { isReduced, setOrbState } = params;
  const frozenT = getDevIntroTime();
  if (isReduced) {
    applyStaticOrbMode(orbEl, handles, setOrbState, {
      timeSec: INTRO_DURATION,
      state: 'reduced',
      broadcast: true,
    });
    return;
  }
  if (frozenT !== null) {
    applyStaticOrbMode(orbEl, handles, setOrbState, {
      timeSec: frozenT,
      state: 'frozen',
      broadcast: false,
    });
    return;
  }
  if (hasPlayedHeroIntro()) {
    applyStaticOrbMode(orbEl, handles, setOrbState, {
      timeSec: INTRO_DURATION,
      state: 'resting',
      broadcast: true,
    });
    return;
  }
  applyOrbClock(orbEl, 0);
  setOrbState('intro');
  scheduleIntroAfterWrapper(orbEl, rootRef, handles, setOrbState);
}

/** Attaches the orb's intro animation timeline and reduced-motion listeners, returning a cleanup callback. */
export function attachOrbIntroLifecycle(
  orbEl: HTMLElement,
  rootRef: RefObject<HTMLDivElement | null>,
  setOrbState: (state: OrbState) => void,
): () => void {
  const handles: ClockHandles = { cancelled: false, rafId: null, waitTimer: null };
  const motionMq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const handleMotionChange = (): void => {
    if (motionMq?.matches) {
      applyStaticOrbMode(orbEl, handles, setOrbState, {
        timeSec: INTRO_DURATION,
        state: 'reduced',
        broadcast: true,
      });
      return;
    }
    const frozen = getDevIntroTime();
    applyStaticOrbMode(orbEl, handles, setOrbState, {
      timeSec: frozen ?? INTRO_DURATION,
      state: frozen !== null ? 'frozen' : 'resting',
      broadcast: false,
    });
  };
  motionMq?.addEventListener('change', handleMotionChange);
  initializeOrbPlayback(orbEl, rootRef, handles, {
    isReduced: Boolean(motionMq?.matches),
    setOrbState,
  });

  return () => {
    handles.cancelled = true;
    if (handles.rafId !== null) {
      cancelAnimationFrame(handles.rafId);
    }
    if (handles.waitTimer !== null) {
      window.clearTimeout(handles.waitTimer);
    }
    motionMq?.removeEventListener('change', handleMotionChange);
  };
}
