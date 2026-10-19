import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PATH_BY_ID } from '../data/paths';
import { openLastDrop } from '../secret/destination';
import { CasingDetails } from './MachineEggs';

// Records what each machine view hands the casing, then renders the real parts.
const casing = vi.hoisted(() => [] as { onLastDrop?: () => void }[]);
vi.mock('./MachineEggs', async (importActual) => {
  const real = await importActual<typeof import('./MachineEggs')>();
  return {
    ...real,
    CasingDetails: (props: Parameters<typeof real.CasingDetails>[0]) => {
      casing.push(props);
      return real.CasingDetails(props);
    },
  };
});

const { MachineSelect } = await import('./MachineSelect');
const { MachineScreen } = await import('./MachineScreen');
const noop = () => {};
const DISC = /<button type="button" class="casing__puzzle" style="left:76\.\d+%;top:44\.\d+%" aria-label="The last drop \(opens in a new tab\)">/;

describe('the ? disc: only on the coffee-selection machine', () => {
  const select = (onLastDrop?: () => void) =>
    renderToString(
      createElement(MachineSelect, { solved: [], selection: null, sugar: 0, onSugar: noop, onStart: noop, notice: null, onEgg: noop, onDismissNotice: noop, onLastDrop }),
    );

  it('is on the selection machine once unlocked, opening the Last Drop through the shared handler', () => {
    casing.length = 0;
    expect(select(openLastDrop)).toMatch(DISC);
    expect(casing.at(-1)?.onLastDrop).toBe(openLastDrop);
  });

  it('is not on the selection machine before the full set has been drunk', () => {
    casing.length = 0;
    expect(select()).not.toContain('casing__puzzle');
    expect(casing.at(-1)?.onLastDrop).toBeUndefined();
  });

  const machine = (screen: 'BREWING' | 'PUZZLE_SOLVED', serving: { pages: ('message' | 'ritual' | 'qr')[]; page: number } | null, drunk: number) =>
    renderToString(
      createElement(MachineScreen, {
        path: PATH_BY_ID.key,
        screen,
        brewRun: 1,
        record: { pathId: 'key', sugar: 0 } as never,
        serving: serving && { ...serving, unveiling: false },
        drunk,
        notice: null,
        dispatch: noop,
      }),
    );

  it('is never on the machine screen: brewing, THREE DOWN., REGULAR CUSTOMER or the silent page, even once unlocked', () => {
    casing.length = 0;
    const cases = [
      machine('BREWING', null, 1),
      machine('BREWING', null, 2),
      // The third coffee, which unlocks the final reward: brewing, then each of its pages.
      machine('BREWING', null, 3),
      machine('PUZZLE_SOLVED', { pages: ['message', 'ritual', 'qr'], page: 0 }, 3),
      machine('PUZZLE_SOLVED', { pages: ['message', 'ritual', 'qr'], page: 1 }, 3),
      machine('PUZZLE_SOLVED', { pages: ['message', 'ritual', 'qr'], page: 2 }, 3),
      // A later coffee after the unlock.
      machine('PUZZLE_SOLVED', { pages: ['message', 'qr'], page: 0 }, 3),
    ];
    for (const html of cases) expect(html).not.toContain('casing__puzzle');
    expect(casing.length).toBeGreaterThanOrEqual(cases.length);
    for (const props of casing) expect(props.onLastDrop).toBeUndefined();
  });

  it('is left out when no handler is given (the silent screen)', () => {
    casing.length = 0;
    expect(renderToString(createElement(CasingDetails, { onEgg: noop }))).not.toContain('casing__puzzle');
  });
});
