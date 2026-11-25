export interface TelegramActionFeedback {
  readonly toast: string;
  readonly progressText: string;
}

interface ActionDescriptor {
  readonly label: string;
  readonly toast: string;
  readonly activity: string;
}

const LIVE_AIR_ACTION: ActionDescriptor = {
  label: 'Live Air',
  toast: 'Live Air requested...',
  activity: 'Checking live CPCB NAQI, PM2.5, weather & inversion data...',
};

const SCHEDULE_ACTION: ActionDescriptor = {
  label: 'My Schedule',
  toast: 'Loading My Schedule...',
  activity: 'Building your live hourly smog-safe schedule...',
};

const FAMILY_ACTION: ActionDescriptor = {
  label: 'Family Roster',
  toast: 'Loading Family Roster...',
  activity: 'Calculating live daily exposure for every family member...',
};

const WINDOWS_ACTION: ActionDescriptor = {
  label: 'Indoor & Windows',
  toast: 'Checking Indoor & Windows...',
  activity: 'Checking live mixing height (PBL) & safe ventilation windows...',
};

const COMMUTE_ACTION: ActionDescriptor = {
  label: 'Commute',
  toast: 'Calculating Commute options...',
  activity: 'Comparing live PM2.5 dose & CO2 across commute modes...',
};

const GEAR_ACTION: ActionDescriptor = {
  label: 'Masks & Gear',
  toast: 'Loading Masks & Gear...',
  activity: 'Calculating mask filtration & HEPA CADR target for live PM2.5...',
};

const RWA_ACTION: ActionDescriptor = {
  label: 'RWA Notice',
  toast: 'Preparing RWA Notice...',
  activity: 'Preparing live RWA community alert & neighborhood impact...',
};

const CONTROLS_ACTION: ActionDescriptor = {
  label: 'Controls & GPS',
  toast: 'Opening Controls & GPS...',
  activity: 'Loading your synced settings & GPS controls...',
};

const SWITCH_USER_ACTION: ActionDescriptor = {
  label: 'Change User',
  toast: 'Opening Family Member Picker...',
  activity: 'Loading your household member list...',
};

const GPS_ACTION: ActionDescriptor = {
  label: 'Share Live GPS',
  toast: 'Opening GPS Share...',
  activity: 'Opening live GPS location prompt...',
};

const EXACT_ACTIONS: Readonly<Record<string, ActionDescriptor>> = {
  'cmd:air': LIVE_AIR_ACTION,
  'live air': LIVE_AIR_ACTION,
  '/air': LIVE_AIR_ACTION,
  air: LIVE_AIR_ACTION,
  'cmd:schedule': SCHEDULE_ACTION,
  'my schedule': SCHEDULE_ACTION,
  '/schedule': SCHEDULE_ACTION,
  schedule: SCHEDULE_ACTION,
  '/brief': SCHEDULE_ACTION,
  'cmd:family': FAMILY_ACTION,
  'family roster': FAMILY_ACTION,
  '/family': FAMILY_ACTION,
  'cmd:windows': WINDOWS_ACTION,
  'indoor & windows': WINDOWS_ACTION,
  '/windows': WINDOWS_ACTION,
  windows: WINDOWS_ACTION,
  '/indoor': WINDOWS_ACTION,
  'cmd:commute': COMMUTE_ACTION,
  commute: COMMUTE_ACTION,
  '/commute': COMMUTE_ACTION,
  'cmd:gear': GEAR_ACTION,
  'masks & gear': GEAR_ACTION,
  '/gear': GEAR_ACTION,
  '/masks': GEAR_ACTION,
  'cmd:rwa': RWA_ACTION,
  'rwa notice': RWA_ACTION,
  '/rwa': RWA_ACTION,
  'cmd:controls': CONTROLS_ACTION,
  'controls & gps': CONTROLS_ACTION,
  '/controls': CONTROLS_ACTION,
  '/settings': CONTROLS_ACTION,
  '/menu': CONTROLS_ACTION,
  '/help': CONTROLS_ACTION,
  'cmd:switchuser': SWITCH_USER_ACTION,
  'change user': SWITCH_USER_ACTION,
  '/switch': SWITCH_USER_ACTION,
  '/user': SWITCH_USER_ACTION,
  'gps:ask': GPS_ACTION,
  '/gps': GPS_ACTION,
};

const PREFIX_ACTIONS: readonly (readonly [string, ActionDescriptor])[] = [
  [
    'member:',
    {
      label: 'Switch Active User',
      toast: 'Switching active member...',
      activity: 'Syncing active member & building live schedule...',
    },
  ],
  [
    'mask:',
    {
      label: 'Update Mask',
      toast: 'Updating mask preference...',
      activity: 'Syncing mask protection & recalculating exposure...',
    },
  ],
  [
    'lang:',
    {
      label: 'Change Language',
      toast: 'Updating language...',
      activity: 'Syncing preferred language...',
    },
  ],
  [
    'brief:toggle',
    {
      label: 'Daily 06:30 Brief',
      toast: 'Updating Daily Brief...',
      activity: 'Updating your daily 06:30 brief preference...',
    },
  ],
  [
    '/route',
    {
      label: 'Corridor Route',
      toast: 'Planning route...',
      activity: 'Planning low-exposure corridor & route telemetry...',
    },
  ],
  [
    '/city',
    {
      label: 'Update City',
      toast: 'Updating city...',
      activity: 'Updating city & fetching live local air quality...',
    },
  ],
];

const DEFAULT_CALLBACK_ACTION: ActionDescriptor = {
  label: 'Action',
  toast: 'Processing request...',
  activity: 'Syncing with PranaPulse & checking live air data...',
};

const DEFAULT_TEXT_ACTION: ActionDescriptor = {
  label: 'Message',
  toast: 'Processing message...',
  activity: 'Got your message — syncing with PranaPulse & checking live air data...',
};

const GPS_PIN_ACTION: ActionDescriptor = {
  label: 'Live GPS Pin',
  toast: 'GPS pin received...',
  activity: 'GPS pin received — resolving city, live CPCB NAQI & inversion data...',
};

function findActionDescriptor(
  lower: string,
  isCallback: boolean,
  hasGps: boolean,
): ActionDescriptor {
  if (hasGps) {
    return GPS_PIN_ACTION;
  }
  if (Object.hasOwn(EXACT_ACTIONS, lower)) {
    const exact = EXACT_ACTIONS[lower];
    if (exact) {
      return exact;
    }
  }
  const matchedPrefix = PREFIX_ACTIONS.find(([prefix]) => lower.startsWith(prefix));
  if (matchedPrefix) {
    return matchedPrefix[1];
  }
  return isCallback ? DEFAULT_CALLBACK_ACTION : DEFAULT_TEXT_ACTION;
}

/** Builds immediate callback toast and visible progress copy before upstream telemetry/LLM runs. */
export function resolveTelegramFeedback(params: {
  readonly rawText: string;
  readonly isCallback: boolean;
  readonly hasGps: boolean;
}): TelegramActionFeedback {
  const lower = params.rawText.trim().toLowerCase();
  const descriptor = findActionDescriptor(lower, params.isCallback, params.hasGps);
  const progressText = params.isCallback
    ? `You selected: ${descriptor.label}\n${descriptor.activity}`
    : descriptor.activity;
  return {
    toast: descriptor.toast,
    progressText,
  };
}
