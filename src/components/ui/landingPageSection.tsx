import { type ReactElement } from 'react';
import { cn } from '@/lib/utils';

/** Feature card rendered inside a landing page Bento grid. */
export interface ScrollGlobeFeature {
  readonly title: string;
  readonly description: string;
  readonly tag?: string;
}

/** Call-to-action button rendered inside a landing page section. */
export interface ScrollGlobeAction {
  readonly label: string;
  readonly variant: 'primary' | 'secondary';
  readonly onClick?: () => void;
}

/** Structured content definition for one landing page narrative section. */
export interface ScrollGlobeSectionData {
  readonly id: string;
  readonly badge?: string;
  readonly navLabel?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly description: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly highlights?: readonly string[];
  readonly features?: readonly ScrollGlobeFeature[];
  readonly actions?: readonly ScrollGlobeAction[];
}

const FEATURE_DELAY_STEP_SEC = 0.08;
const ACTION_DELAY_STEP_SEC = 0.1;
const ACTION_DELAY_BASE_SEC = 0.2;
const ALIGN_JUSTIFY = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;
const ALIGN_SECTION = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;

function SectionBadge(p: {
  readonly badge: string;
  readonly align: ScrollGlobeSectionData['align'];
}): ReactElement {
  return (
    <div className={cn('mb-3 flex sm:mb-4', ALIGN_JUSTIFY[p.align ?? 'left'])}>
      <span className="measured inline-flex items-center gap-2 rounded-full border border-primary/45 bg-card/85 px-3.5 py-1 text-xs font-semibold tracking-wider text-primary uppercase backdrop-blur-md">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        <span>{p.badge}</span>
      </span>
    </div>
  );
}

function SectionHeading({
  isHero,
  title,
  subtitle,
}: {
  readonly isHero: boolean;
  readonly title: string;
  readonly subtitle?: string | undefined;
}): ReactElement {
  const HeadingTag = isHero ? 'h1' : 'h2';
  const headingClass = isHero
    ? 'font-bold mb-4 sm:mb-7 leading-[1.08] tracking-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl'
    : 'font-bold mb-4 sm:mb-7 leading-[1.1] tracking-tight text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl';

  return (
    <HeadingTag className={headingClass}>
      {subtitle ? (
        <div className="space-y-1 sm:space-y-2">
          <div className="landing-orb-contrast text-foreground">{title}</div>
          <div className="landing-orb-contrast text-[0.58em] font-semibold tracking-wider text-foreground/90 sm:text-[0.68em]">
            {subtitle}
          </div>
        </div>
      ) : (
        <div className="landing-orb-contrast text-foreground">{title}</div>
      )}
    </HeadingTag>
  );
}

function SectionHighlights({
  highlights,
  align,
}: {
  readonly highlights: readonly string[];
  readonly align: ScrollGlobeSectionData['align'];
}): ReactElement {
  return (
    <div
      className={cn(
        'mt-3 flex flex-wrap items-center gap-1.5 text-xs sm:mt-4 sm:gap-2',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end',
      )}
    >
      {highlights.map((chip) => (
        <span
          key={chip}
          className="measured inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-3 py-1 font-medium text-foreground backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span>{chip}</span>
        </span>
      ))}
    </div>
  );
}

function SectionFeaturesGrid({
  features,
}: {
  readonly features: readonly ScrollGlobeFeature[];
}): ReactElement {
  return (
    <div
      className={cn(
        'mb-6 grid gap-3 text-left sm:mb-8 sm:gap-4',
        features.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1',
      )}
    >
      {features.map((feature, featureIndex) => (
        <div
          key={feature.title}
          className={cn(
            'group rounded-xl border border-border/75 bg-card/90 p-4 backdrop-blur-md transition-colors duration-300 hover:bg-card/92 hover:shadow-xl hover:shadow-primary/10 sm:bg-card/78 sm:p-5',
            'hover:-translate-y-0.5 hover:border-primary/45',
          )}
          style={{ animationDelay: `${String(featureIndex * FEATURE_DELAY_STEP_SEC)}s` }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary/80 transition-colors group-hover:bg-primary" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-card-foreground sm:text-base">
                  {feature.title}
                </h3>
                {feature.tag && (
                  <span className="measured rounded-full border border-primary/35 bg-background/70 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {feature.tag}
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground/90 sm:text-sm">
                {feature.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionActionsBar({
  actions,
  align,
}: {
  readonly actions: readonly ScrollGlobeAction[];
  readonly align: ScrollGlobeSectionData['align'];
}): ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col flex-wrap gap-3 sm:flex-row sm:gap-4',
        ALIGN_JUSTIFY[align ?? 'left'],
      )}
    >
      {actions.map((action, actionIndex) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className={cn(
            'group relative rounded-lg px-6 py-3 text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:rounded-xl sm:px-8 sm:py-4 sm:text-base',
            'w-full hover:shadow-lg focus:ring-2 focus:ring-primary/20 focus:outline-none sm:w-auto',
            action.variant === 'primary'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30'
              : 'border-2 border-border/60 bg-background/50 text-foreground backdrop-blur-sm hover:border-primary/30 hover:bg-accent/50',
          )}
          style={{
            animationDelay: `${String(actionIndex * ACTION_DELAY_STEP_SEC + ACTION_DELAY_BASE_SEC)}s`,
          }}
        >
          <span className="relative z-10">{action.label}</span>
          {action.variant === 'primary' && (
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-primary/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:rounded-xl" />
          )}
        </button>
      ))}
    </div>
  );
}

function SectionLeadCopy({ section }: { readonly section: ScrollGlobeSectionData }): ReactElement {
  return (
    <div
      className={cn(
        'mb-5 text-sm leading-relaxed sm:mb-8 sm:text-lg lg:text-xl',
        section.align === 'center'
          ? 'mx-auto max-w-3xl text-center font-normal text-foreground'
          : 'max-w-3xl font-normal text-foreground/95',
      )}
    >
      <p className="landing-copy-plate mb-3 sm:mb-4">{section.description}</p>
      {section.highlights && section.highlights.length > 0 && (
        <SectionHighlights highlights={section.highlights} align={section.align} />
      )}
    </div>
  );
}

/** Renders one responsive narrative section inside the ScrollGlobe landing page. */
export function ScrollGlobeSection({
  section,
  index,
  heroTextRef,
  onAttachRef,
}: {
  readonly section: ScrollGlobeSectionData;
  readonly index: number;
  readonly heroTextRef: React.RefObject<HTMLDivElement | null>;
  readonly onAttachRef: (el: HTMLElement | null) => void;
}): ReactElement {
  const isHero = index === 0;
  return (
    <section
      ref={onAttachRef}
      className={cn(
        'relative z-20 flex w-full max-w-full flex-col justify-center overflow-hidden px-4 sm:px-6 md:px-8 lg:px-12',
        isHero
          ? 'min-h-[calc(100svh-4rem)] pt-5 pb-10 sm:pt-14 sm:pb-16'
          : 'py-14 sm:min-h-screen sm:pt-24 sm:pb-20',
        ALIGN_SECTION[section.align ?? 'left'],
      )}
    >
      <div
        ref={isHero ? heroTextRef : undefined}
        className="w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl"
      >
        {section.badge && <SectionBadge badge={section.badge} align={section.align} />}
        <SectionHeading isHero={isHero} title={section.title} subtitle={section.subtitle} />
        <SectionLeadCopy section={section} />
        {section.features && <SectionFeaturesGrid features={section.features} />}
        {section.actions && <SectionActionsBar actions={section.actions} align={section.align} />}
      </div>
    </section>
  );
}
