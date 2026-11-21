/* eslint-disable */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Globe from '@/components/ui/globe';
import { SmokeCanvas } from '@/components/ui/smoke-canvas';
import { cn } from '@/lib/utils';

// Reusable ScrollGlobe component following shadcn/ui patterns
export interface ScrollGlobeProps {
  sections: {
    id: string;
    badge?: string;
    title: string;
    subtitle?: string;
    description: string;
    align?: 'left' | 'center' | 'right';
    highlights?: readonly string[];
    features?: { title: string; description: string; tag?: string }[];
    actions?: { label: string; variant: 'primary' | 'secondary'; onClick?: () => void }[];
  }[];
  globeConfig?: {
    positions: {
      top: string;
      left: string;
      scale: number;
    }[];
  };
  className?: string;
}

const defaultGlobeConfig = {
  positions: [
    { top: '50%', left: '75%', scale: 1.4 }, // Hero: Right side, balanced
    { top: '25%', left: '50%', scale: 0.9 }, // Innovation: Top side, subtle
    { top: '15%', left: '90%', scale: 2 }, // Discovery: Left side, medium
    { top: '50%', left: '50%', scale: 1.8 }, // Future: Center, large backdrop
  ],
};

// Parse percentage string to number
const parsePercent = (str: string): number => parseFloat(str.replace('%', ''));

export function ScrollGlobe({
  sections,
  globeConfig = defaultGlobeConfig,
  className,
}: ScrollGlobeProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [globeTransform, setGlobeTransform] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const animationFrameId = useRef<number | undefined>(undefined);
  const navLabelTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Pre-calculate positions for performance
  const calculatedPositions = useMemo(() => {
    return globeConfig.positions.map((pos) => ({
      top: parsePercent(pos.top),
      left: parsePercent(pos.left),
      scale: pos.scale,
    }));
  }, [globeConfig.positions]);

  // Simple, direct scroll tracking
  const updateScrollPosition = useCallback(() => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min(Math.max(scrollTop / docHeight, 0), 1);

    setScrollProgress(progress);

    // Simple section detection
    const viewportCenter = window.innerHeight / 2;
    let newActiveSection = 0;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);

        if (distance < minDistance) {
          minDistance = distance;
          newActiveSection = index;
        }
      }
    });

    // Direct position update - no interpolation
    const currentPos = calculatedPositions[newActiveSection] ?? calculatedPositions[0]!;
    const transform = `translate3d(${currentPos.left}vw, ${currentPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${currentPos.scale}, ${currentPos.scale}, 1)`;

    setGlobeTransform(transform);

    setActiveSection(newActiveSection);
  }, [calculatedPositions, activeSection]);

  // Throttled scroll handler with RAF
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        animationFrameId.current = requestAnimationFrame(() => {
          updateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Use passive listeners and immediate execution
    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollPosition(); // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (navLabelTimeoutRef.current) {
        clearTimeout(navLabelTimeoutRef.current);
      }
    };
  }, [updateScrollPosition]);

  // Initial globe position
  useEffect(() => {
    const initialPos = calculatedPositions[0]!;
    const initialTransform = `translate3d(${initialPos.left}vw, ${initialPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${initialPos.scale}, ${initialPos.scale}, 1)`;
    setGlobeTransform(initialTransform);
  }, [calculatedPositions]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full max-w-screen overflow-x-hidden min-h-screen bg-background text-foreground',
        className,
      )}
    >
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-gradient-to-r from-border/20 via-border/40 to-border/20 z-50">
        <div
          className="h-full bg-gradient-to-r from-primary via-blue-600 to-blue-900 will-change-transform shadow-sm"
          style={{
            transform: `scaleX(${scrollProgress})`,
            transformOrigin: 'left center',
            transition: 'transform 0.15s ease-out',
            filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.3))',
          }}
        />
      </div>

      {/* Minimalist vertical section progress dots */}
      <div className="hidden sm:flex fixed right-2 sm:right-4 lg:right-8 top-1/2 -translate-y-1/2 z-30">
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="relative group">
              <button
                type="button"
                title={section.badge || section.title}
                onClick={() => {
                  sectionRefs.current[index]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }}
                className={cn(
                  'relative w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full border-2 transition-all duration-300 hover:scale-125',
                  'before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300',
                  activeSection === index
                    ? 'bg-primary border-primary shadow-lg before:animate-ping before:bg-primary/20'
                    : 'bg-transparent border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/10',
                )}
                aria-label={`Go to ${section.badge || `section ${index + 1}`}`}
              />
            </div>
          ))}
        </div>

        {/* Enhanced navigation line - Responsive */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 lg:w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent -translate-x-1/2 -z-10" />
      </div>

      {/* Drifting wisp smoke canvas behind orb and header/footer */}
      <SmokeCanvas
        activeSection={activeSection}
        scrollProgress={scrollProgress}
        heroTextRef={heroTextRef}
      />

      {/* Ultra-smooth Globe with responsive scaling & contrast-safe mode/mobile opacity */}
      <div
        data-dim={activeSection === 3 ? 'true' : undefined}
        className="landing-globe-backdrop fixed z-10 pointer-events-none will-change-transform transition-all duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{
          transform: globeTransform,
        }}
      >
        <div className="scale-75 sm:scale-90 lg:scale-100">
          <Globe />
        </div>
      </div>

      {/* Dynamic sections - fully responsive */}
      {sections.map((section, index) => (
        <section
          key={section.id}
          ref={(el) => {
            sectionRefs.current[index] = el;
          }}
          className={cn(
            'relative flex flex-col justify-center px-4 sm:px-6 md:px-8 lg:px-12 z-20',
            index === 0
              ? 'min-h-[calc(100svh-4rem)] pt-5 pb-10 sm:pt-14 sm:pb-16'
              : 'min-h-screen pt-16 pb-14 sm:pt-24 sm:pb-20',
            'w-full max-w-full overflow-hidden',
            section.align === 'center' && 'items-center text-center',
            section.align === 'right' && 'items-end text-right',
            section.align !== 'center' && section.align !== 'right' && 'items-start text-left',
          )}
        >
          <div
            ref={index === 0 ? heroTextRef : undefined}
            className={cn(
              'w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl will-change-transform transition-all duration-700',
              'opacity-100 translate-y-0',
            )}
          >
            {section.badge && (
              <div
                className={cn(
                  'mb-3 flex sm:mb-4',
                  section.align === 'center' && 'justify-center',
                  section.align === 'right' && 'justify-end',
                )}
              >
                <span className="measured inline-flex items-center gap-2 rounded-full border border-primary/45 bg-card/85 px-3.5 py-1 text-xs font-semibold tracking-wider text-primary uppercase backdrop-blur-md">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
                  <span>{section.badge}</span>
                </span>
              </div>
            )}

            {index === 0 ? (
              <h1 className="font-bold mb-4 sm:mb-7 leading-[1.08] tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl">
                {section.subtitle ? (
                  <div className="space-y-1 sm:space-y-2">
                    <div className="text-foreground landing-orb-contrast">{section.title}</div>
                    <div className="text-foreground/90 text-[0.58em] sm:text-[0.68em] font-semibold tracking-wider landing-orb-contrast">
                      {section.subtitle}
                    </div>
                  </div>
                ) : (
                  <div className="text-foreground landing-orb-contrast">{section.title}</div>
                )}
              </h1>
            ) : (
              <h2 className="font-bold mb-4 sm:mb-7 leading-[1.1] tracking-tight text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl">
                {section.subtitle ? (
                  <div className="space-y-1 sm:space-y-2">
                    <div className="text-foreground landing-orb-contrast">{section.title}</div>
                    <div className="text-foreground/90 text-[0.58em] sm:text-[0.68em] font-semibold tracking-wider landing-orb-contrast">
                      {section.subtitle}
                    </div>
                  </div>
                ) : (
                  <div className="text-foreground landing-orb-contrast">{section.title}</div>
                )}
              </h2>
            )}

            <div
              className={cn(
                'leading-relaxed mb-5 sm:mb-8 text-sm sm:text-lg lg:text-xl',
                section.align === 'center'
                  ? 'max-w-3xl mx-auto text-center text-foreground font-normal'
                  : 'max-w-3xl text-foreground/95 font-normal',
              )}
            >
              <p className="landing-copy-plate mb-3 sm:mb-4">{section.description}</p>
              {section.highlights && section.highlights.length > 0 && (
                <div
                  className={cn(
                    'mt-3 flex flex-wrap items-center gap-1.5 text-xs sm:mt-4 sm:gap-2',
                    section.align === 'center' && 'justify-center',
                    section.align === 'right' && 'justify-end',
                  )}
                >
                  {section.highlights.map((chip) => (
                    <span
                      key={chip}
                      className="measured inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-3 py-1 font-medium text-foreground backdrop-blur-md"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <span>{chip}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Enhanced Features - Responsive 2-column Bento grid */}
            {section.features && (
              <div
                className={cn(
                  'grid gap-3 sm:gap-4 mb-6 sm:mb-8 text-left',
                  section.features.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1',
                )}
              >
                {section.features.map((feature, featureIndex) => (
                  <div
                    key={feature.title}
                    className={cn(
                      'group p-4 sm:p-5 rounded-xl border border-border/75 bg-card/78 backdrop-blur-md hover:bg-card/92 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10',
                      'hover:border-primary/45 hover:-translate-y-0.5',
                    )}
                    style={{ animationDelay: `${featureIndex * 0.08}s` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary/80 mt-2 group-hover:bg-primary transition-colors flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-card-foreground text-sm sm:text-base">
                            {feature.title}
                          </h3>
                          {feature.tag && (
                            <span className="measured rounded-full border border-primary/35 bg-background/70 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                              {feature.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground/90 leading-relaxed text-xs sm:text-sm">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Enhanced Actions - Responsive buttons */}
            {section.actions && (
              <div
                className={cn(
                  'flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4',
                  section.align === 'center' && 'justify-center',
                  section.align === 'right' && 'justify-end',
                  (!section.align || section.align === 'left') && 'justify-start',
                )}
              >
                {section.actions.map((action, actionIndex) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className={cn(
                      'group relative px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base',
                      'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-auto',
                      action.variant === 'primary'
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30'
                        : 'border-2 border-border/60 bg-background/50 backdrop-blur-sm hover:bg-accent/50 hover:border-primary/30 text-foreground',
                    )}
                    style={{ animationDelay: `${actionIndex * 0.1 + 0.2}s` }}
                  >
                    <span className="relative z-10">{action.label}</span>
                    {action.variant === 'primary' && (
                      <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

// Demo component showcasing the ScrollGlobe
export default function GlobeScrollDemo() {
  const demoSections = [
    {
      id: 'hero',
      badge: 'Winter Smog AI',
      title: 'PranaPulse',
      subtitle: 'Atmospheric Intelligence',
      description:
        'Real-time atmospheric thermal boundary layer modeling, CADR indoor filtration dynamics, and low-emission family schedule protection engineered for seasonal severe winter smog.',
      align: 'left' as const,
      actions: [
        {
          label: 'Launch Console',
          variant: 'primary' as const,
          onClick: () => {
            const mainEl = document.getElementById('main-content');
            if (mainEl) {
              mainEl.scrollIntoView({ behavior: 'smooth' });
            }
          },
        },
        {
          label: 'Explore Inversion Physics',
          variant: 'secondary' as const,
          onClick: () => {
            window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
          },
        },
      ],
    },
    {
      id: 'innovation',
      badge: 'Inversion Physics',
      title: 'Planetary Trapping Engine',
      description:
        'When winter ground cooling collapses the Planetary Boundary Layer to 200m, particulate matter concentrates up to 30x safe ceilings. PranaPulse tracks surface thermal plumes and ventilation collapse in real time.',
      align: 'center' as const,
    },
    {
      id: 'discovery',
      badge: 'Exposure Defense',
      title: 'Science-Backed',
      subtitle: 'Clearance Architecture',
      description:
        'Replace guesswork with mass-balance physics. Calculate exact air changes per hour (ACH), mask filtration efficiency, and optimal transit routes across dynamic pollution corridors.',
      align: 'left' as const,
      features: [
        {
          title: 'Dynamic PBL Inversion Tracking',
          description:
            'Real-time boundary layer height monitoring and forecast down to 100-meter vertical resolution.',
        },
        {
          title: 'Deterministic Indoor CADR Physics',
          description:
            'Mass-balance air exchange calculation tailored to room volume, envelope tightness, and occupant load.',
        },
        {
          title: 'Family Vulnerability Defense',
          description:
            'Personalized pulmonary deposition dose calculations for children, seniors, and active commuters.',
        },
      ],
    },
    {
      id: 'future',
      badge: 'Clean Air Mission',
      title: 'Breathing Safe',
      subtitle: 'Every Season',
      description:
        'Empowering communities, housing societies, and families with hyper-local air quality science, actionable health protection, and AI-assisted community mitigation strategies.',
      align: 'center' as const,
      actions: [
        {
          label: 'Open Workbench Console',
          variant: 'primary' as const,
          onClick: () => {
            const mainEl = document.getElementById('main-content');
            if (mainEl) {
              mainEl.scrollIntoView({ behavior: 'smooth' });
            }
          },
        },
        {
          label: 'Simulate Smog Trap',
          variant: 'secondary' as const,
          onClick: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
        },
      ],
    },
  ];

  return (
    <ScrollGlobe
      sections={demoSections}
      className="bg-gradient-to-br from-background via-muted/20 to-background"
    />
  );
}
