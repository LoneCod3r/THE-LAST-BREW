/**
 * Every line the machine says after a coffee, for an Easter egg or at the end.
 * Kept in one place so the copy can be changed without touching components.
 */
import type { PathId } from './paths';

export interface MachineMessage {
  title: string;
  body: string;
}

/** Shown on the machine's display once the cup has been picked up (the drinking is complete). */
export const POST_COFFEE: Readonly<Record<PathId, MachineMessage>> = {
  key: {
    title: 'WELL PLAYED.',
    body: "Sometimes the right answers come at just the right moment. Enjoy your coffee. You've earned it.",
  },
  mind: {
    title: 'ANOTHER ONE.',
    body: "You're getting good at this. The machine seems to remember you.",
  },
  void: {
    title: 'THREE DOWN.',
    body: 'Three puzzles. Three coffees. But the archive has one more secret.',
  },
};

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

/** Three completed coffees, of any kind. */
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
