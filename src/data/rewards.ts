/**
 * Every line the machine says after a coffee, for an Easter egg or at the end.
 * Kept in one place so the copy can be changed without touching components.
 */
export interface MachineMessage {
  title: string;
  body: string;
}

/**
 * Shown on the machine's display once the cup has been picked up (the drinking is complete),
 * by how many distinct coffees have been drunk so far, not by which one: first, second, third.
 */
export const POST_COFFEE: readonly MachineMessage[] = [
  {
    title: 'WELL PLAYED.',
    body: "Sometimes the right answers come at just the right moment. Enjoy your coffee. You've earned it.",
  },
  {
    title: 'ANOTHER ONE.',
    body: "You're getting good at this. The machine seems to remember you.",
  },
  {
    title: 'THREE DOWN.',
    body: 'Three puzzles. Three coffees. But the archive has one more secret.',
  },
];

/** After every coffee once the three distinct coffees had already been drunk, repeats included. */
export const HEART_RATE_CRITICAL: MachineMessage = {
  title: 'HEART RATE: CRITICAL.',
  body: 'Three coffees were a puzzle. The next one is a medical decision.',
};

/**
 * The message after a coffee, given the distinct coffees drunk this session (repeats count once)
 * and whether all of them had already been drunk before this one.
 */
export function postCoffeeMessage(distinctDrunk: number, setCompletedBefore = false): MachineMessage {
  if (setCompletedBefore) return HEART_RATE_CRITICAL;
  const i = Math.min(POST_COFFEE.length, Math.max(1, distinctDrunk)) - 1;
  return POST_COFFEE[i];
}

/** After Enough?: the pause before Enough., on the machine's otherwise silent display. */
export const MACHINE_SILENT = 'THE MACHINE HAS NOTHING LEFT TO OFFER.';

export type EggId = 'curiousBarista' | 'nightShift' | 'missingBean' | 'coffeeRitual';
export const EGG_IDS: readonly EggId[] = ['curiousBarista', 'nightShift', 'missingBean', 'coffeeRitual'];

/** Eggs found by poking at the machine; their message shows briefly on its display. */
export type NoticeId = Exclude<EggId, 'coffeeRitual'>;

export const EGG_NOTICES: Readonly<Record<NoticeId, { title?: string; body: string }>> = {
  curiousBarista: { body: 'You know, most people just want coffee.' },
  nightShift: {
    title: 'ARCHIVE ENTRY 07',
    body: 'The machine was here long before the first puzzle was written.',
  },
  missingBean: { body: 'A good eye makes a good barista.' },
};

/** Three distinct coffees drunk; repeats do not count. */
export const COFFEE_RITUAL = { title: 'Ah. A regular.', badge: 'REGULAR CUSTOMER', threshold: 3 } as const;

/** The final reward: every puzzle solved and every coffee drunk. */
export const SECRET_BLEND = {
  title: 'THE SECRET BLEND',
  lead: 'Three puzzles. Three coffees. One secret buried beneath them all.',
  entry: [
    'Before the first question was asked, the machine was already waiting. Three locks. Three cups. Three chances to see what others might miss.',
    'Somewhere between the bitter and the forgotten, something was left behind. The machine was never built to give answers. It was built to preserve what time could not erase.',
    'Every cup leaves a trace. Every trace hides a question. And some questions reveal themselves only to those patient enough to look beyond what is seen. The secret was never lost. It was waiting to be found.',
  ],
  achievement: 'MASTER OF THE ARCHIVE',
} as const;
