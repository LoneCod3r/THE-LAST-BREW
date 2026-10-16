import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer, type GameState } from '../state/machine';
import { parseProgress } from '../state/progress';
import { MachineSelect, type MachineSelectProps } from './MachineSelect';
import { machineSelectProps } from './machineSelectProps';

const noop = () => {};
const atMachine = (stored: unknown): GameState => gameReducer(createInitialState(parseProgress(stored)), { type: 'OPEN_ARCHIVE' });
const render = (props: MachineSelectProps) => renderToString(createElement(MachineSelect, props));
const seals = (html: string) => html.match(/class="vmui__seal"/g)?.length ?? 0;

describe('MachineSelect wiring (regression: "Cannot read properties of undefined (reading \'includes\')")', () => {
  it('reproduces the original crash: the renamed prop left `solved` undefined', () => {
    // The app briefly passed the retired `closedCases` prop while MachineSelect already read `solved`.
    const stale = { ...machineSelectProps(atMachine(null), noop), solved: undefined, closedCases: [] } as unknown as MachineSelectProps;
    expect(() => render(stale)).toThrow(/reading 'includes'/);
  });

  it('the app always passes a solved list, whatever is (or is not) in storage', () => {
    for (const stored of [null, '', '{', '{"version":1}', '{"version":1,"solved":"key"}', '{"version":2,"solved":["key"]}', { version: 1, solved: null }]) {
      const props = machineSelectProps(atMachine(stored), noop);
      expect(Array.isArray(props.solved)).toBe(true);
      expect(seals(render(props))).toBe(0);
    }
  });

  it('marks exactly the solved coffees with a seal', () => {
    const props = machineSelectProps(atMachine({ version: 1, solved: ['key', 'void'] }), noop);
    const html = render(props);
    expect(seals(html)).toBe(2);
    expect(html.match(/, case closed/g)).toHaveLength(2);
  });

  it('offers the Secret Blend seal only once the final reward is unlocked', () => {
    expect(machineSelectProps(atMachine({ version: 1, solved: ['key', 'mind', 'void'] }), noop).onSecret).toBeUndefined();
    const all = machineSelectProps(atMachine({ version: 1, solved: ['key', 'mind', 'void'], drunk: ['key', 'mind', 'void'], coffees: 3 }), noop);
    expect(all.onSecret).toBeTypeOf('function');
    expect(render(all)).toContain('aria-label="The secret blend"');
  });
});
