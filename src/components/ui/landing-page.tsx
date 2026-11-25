import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import Globe from '@/components/ui/globe';
import { SmokeCanvas } from '@/components/ui/smoke-canvas';
import { cn } from '@/lib/utils';
import { ScrollGlobeSection, type ScrollGlobeSectionData } from './landingPageSection.js';

/** Props for the interactive scroll-linked Globe landing page container. */
export interface ScrollGlobeProps {
  readonly sections: readonly ScrollGlobeSectionData[];
  readonly globeConfig?: {
    readonly positions: readonly {
      readonly top: string;
      readonly left: string;
      readonly scale: number;
    }[];
  };
  readonly className?: string;
}

interface GlobeNumericPos {
  readonly top: number;
  readonly left: number;
  readonly scale: number;
}

const DEFAULT_HERO_SCALE = 1.4;
const DEFAULT_INNOVATION_SCALE = 0.9;
const DEFAULT_FUTURE_SCALE = 1.8;
const FINAL_DIM_SECTION_INDEX = 3;

const DEFAULT_GLOBE_CONFIG: NonNullable<ScrollGlobeProps['globeConfig']> = {
  positions: [
    { top: '50%', left: '75%', scale: DEFAULT_HERO_SCALE },
    { top: '25%', left: '50%', scale: DEFAULT_INNOVATION_SCALE },
    { top: '15%', left: '90%', scale: 2 },
    { top: '50%', left: '50%', scale: DEFAULT_FUTURE_SCALE },
  ],
};

const FALLBACK_GLOBE_POS: GlobeNumericPos = { top: 50, left: 75, scale: DEFAULT_HERO_SCALE };

function parsePercent(str: string): number {
  return Number.parseFloat(str.replace('%', ''));
}

function buildGlobeTransform(pos: GlobeNumericPos): string {
  const left = String(pos.left);
  const top = String(pos.top);
  const scale = String(pos.scale);
  return `translate3d(${left}vw, ${top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${scale}, ${scale}, 1)`;
}

function findNearestSectionIndex(
  refs: readonly (HTMLElement | null)[],
  viewportCenter: number,
): number {
  let nearest = 0;
  let minDistance = Number.POSITIVE_INFINITY;
  refs.forEach((el, index) => {
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

function ScrollProgressBar({ scrollProgress }: { readonly scrollProgress: number }): ReactElement {
  return (
    <div className="fixed top-0 left-0 z-50 h-0.5 w-full bg-gradient-to-r from-border/20 via-border/40 to-border/20">
      <div
        className="h-full bg-gradient-to-r from-primary via-blue-600 to-blue-900 shadow-sm will-change-transform"
        style={{
          transform: `scaleX(${String(scrollProgress)})`,
          transformOrigin: 'left center',
          transition: 'transform 0.15s ease-out',
          filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.3))',
        }}
      />
    </div>
  );
}

function SectionProgressDots({
  sections,
  activeSection,
  onJumpToSection,
}: {
  readonly sections: readonly ScrollGlobeSectionData[];
  readonly activeSection: number;
  readonly onJumpToSection: (index: number) => void;
}): ReactElement {
  return (
    <div className="fixed top-1/2 right-2 z-30 hidden -translate-y-1/2 sm:right-4 sm:flex lg:right-8">
      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        {sections.map((section, index) => (
          <div key={section.id} className="group relative">
            <button
              type="button"
              title={section.badge ?? section.title}
              onClick={() => {
                onJumpToSection(index);
              }}
              className={cn(
                'relative h-2 w-2 rounded-full border-2 transition-all duration-300 hover:scale-125 sm:h-2.5 sm:w-2.5 lg:h-3 lg:w-3',
                'before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300',
                activeSection === index
                  ? 'border-primary bg-primary shadow-lg before:animate-ping before:bg-primary/20'
                  : 'border-muted-foreground/40 bg-transparent hover:border-primary/60 hover:bg-primary/10',
              )}
              aria-label={
                section.navLabel ?? `Go to ${section.badge ?? `section ${String(index + 1)}`}`
              }
            />
          </div>
        ))}
      </div>
      <div className="absolute top-0 bottom-0 left-1/2 -z-10 w-0.5 -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/20 to-transparent lg:w-px" />
    </div>
  );
}

function toNumericPositions(
  positions: NonNullable<ScrollGlobeProps['globeConfig']>['positions'],
): readonly GlobeNumericPos[] {
  return positions.map((pos) => ({
    top: parsePercent(pos.top),
    left: parsePercent(pos.left),
    scale: pos.scale,
  }));
}

function useScrollGlobeTracking(
  positions: NonNullable<ScrollGlobeProps['globeConfig']>['positions'],
) {
  const calculatedPositions = useMemo(() => toNumericPositions(positions), [positions]);
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [globeTransform, setGlobeTransform] = useState('');
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const animationFrameId = useRef<number | undefined>(undefined);

  const updateScrollPosition = useCallback(() => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const rawProgress = docHeight > 0 ? window.scrollY / docHeight : 0;
    setScrollProgress(Math.min(Math.max(rawProgress, 0), 1));
    const nearest = findNearestSectionIndex(sectionRefs.current, window.innerHeight / 2);
    const currentPos = calculatedPositions[nearest] ?? calculatedPositions[0] ?? FALLBACK_GLOBE_POS;
    setGlobeTransform(buildGlobeTransform(currentPos));
    setActiveSection(nearest);
  }, [calculatedPositions]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = (): void => {
      if (ticking) {
        return;
      }
      ticking = true;
      animationFrameId.current = requestAnimationFrame(() => {
        updateScrollPosition();
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollPosition();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameId.current !== undefined) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [updateScrollPosition]);

  useEffect(() => {
    const initialPos = calculatedPositions[0] ?? FALLBACK_GLOBE_POS;
    setGlobeTransform(buildGlobeTransform(initialPos));
  }, [calculatedPositions]);

  return { activeSection, scrollProgress, globeTransform, sectionRefs };
}

function GlobeBackdropLayer({
  dimmed,
  globeTransform,
}: {
  readonly dimmed: boolean;
  readonly globeTransform: string;
}): ReactElement {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <div
        data-dim={dimmed ? 'true' : undefined}
        className="landing-globe-backdrop absolute transition-all duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform"
        style={{ transform: globeTransform }}
      >
        <div className="scale-75 sm:scale-90 lg:scale-100">
          <Globe />
        </div>
      </div>
    </div>
  );
}

/** Scroll-choreographed landing showcase uniting the atmospheric orb, WebGL smog canvas, and narrative sections. */
export function ScrollGlobe({
  sections,
  globeConfig = DEFAULT_GLOBE_CONFIG,
  className,
}: ScrollGlobeProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const { activeSection, scrollProgress, globeTransform, sectionRefs } = useScrollGlobeTracking(
    globeConfig.positions,
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-screen w-full max-w-screen overflow-x-hidden bg-background text-foreground',
        className,
      )}
    >
      <ScrollProgressBar scrollProgress={scrollProgress} />
      <SectionProgressDots
        sections={sections}
        activeSection={activeSection}
        onJumpToSection={(idx) => {
          sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />
      <SmokeCanvas
        activeSection={activeSection}
        scrollProgress={scrollProgress}
        heroTextRef={heroTextRef}
      />
      <GlobeBackdropLayer
        dimmed={activeSection === FINAL_DIM_SECTION_INDEX}
        globeTransform={globeTransform}
      />
      {sections.map((section, index) => (
        <ScrollGlobeSection
          key={section.id}
          section={section}
          index={index}
          heroTextRef={heroTextRef}
          onAttachRef={(el) => {
            sectionRefs.current[index] = el;
          }}
        />
      ))}
    </div>
  );
}
