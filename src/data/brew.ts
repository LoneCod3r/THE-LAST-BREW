export const BREW_PHASES = ['granted', 'power', 'grind', 'pressure', 'pour', 'settle', 'done'] as const;
export type BrewPhase = (typeof BREW_PHASES)[number];

export function phaseIndex(phase: BrewPhase): number {
  return BREW_PHASES.indexOf(phase);
}
