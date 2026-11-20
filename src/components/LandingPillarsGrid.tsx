import { Bot, Home, Layers, Navigation, Users, type LucideIcon } from 'lucide-react';
import { memo, type ReactElement } from 'react';
import type { LocaleDictionary } from '../i18n/translations.js';

export interface LandingPillarsGridProps {
  readonly t: LocaleDictionary;
}

interface PillarItem {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

function PillarCard({ item }: { readonly item: PillarItem }): ReactElement {
  const Icon = item.icon;
  return (
    <article className="card flex flex-col gap-3 border border-rule bg-paper-2 p-5 shadow-xs transition-colors hover:border-accent/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cool/10 text-cool">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-ink sm:text-base">{item.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
          {item.description}
        </p>
      </div>
    </article>
  );
}

function getPillarsList(t: LocaleDictionary): readonly PillarItem[] {
  return [
    {
      id: 'pbl',
      icon: Layers,
      title: t.landingPillarPblTitle,
      description: t.landingPillarPblDesc,
    },
    {
      id: 'cadr',
      icon: Home,
      title: t.landingPillarCadrTitle,
      description: t.landingPillarCadrDesc,
    },
    {
      id: 'commute',
      icon: Navigation,
      title: t.landingPillarCommuteTitle,
      description: t.landingPillarCommuteDesc,
    },
    {
      id: 'family',
      icon: Users,
      title: t.landingPillarFamilyTitle,
      description: t.landingPillarFamilyDesc,
    },
    {
      id: 'advisor',
      icon: Bot,
      title: t.landingPillarAdvisorTitle,
      description: t.landingPillarAdvisorDesc,
    },
  ];
}

export const LandingPillarsGrid = memo(function LandingPillarsGrid({
  t,
}: LandingPillarsGridProps): ReactElement {
  const pillars = getPillarsList(t);

  return (
    <section aria-labelledby="pillars-heading" className="space-y-6 py-8">
      <div className="space-y-1.5 text-center">
        <h2
          id="pillars-heading"
          className="text-xl font-bold tracking-tight text-ink sm:text-2xl"
        >
          {t.landingPillarsHeading}
        </h2>
        <p className="mx-auto max-w-xl text-xs text-muted sm:text-sm">
          {t.landingPillarsSubheading}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((item) => (
          <PillarCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
});
