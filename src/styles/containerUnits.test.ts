import { describe, expect, it, vi } from 'vitest';
import { CONTAINERS, needsContainerUnitFallback, startContainerUnitFallback } from './containerUnits';

/** A stand-in container element: its class, connection state, and the custom properties set on it. */
function element(cls: string) {
  const props = new Map<string, string>();
  return {
    cls,
    isConnected: true,
    props,
    style: { setProperty: (k: string, v: string) => props.set(k, v) },
    matches: (selector: string) => selector.split(',').some((s) => s.trim() === `.${cls}`),
  };
}
type FakeEl = ReturnType<typeof element>;

/** Fake observers recording what is observed, with a way to deliver size entries. */
function env(elements: FakeEl[], supports: boolean | null) {
  const observed = new Set<FakeEl>();
  let resized: ((entries: { target: FakeEl; contentRect: { width: number; height: number } }[]) => void) | null = null;
  let mutated: (() => void) | null = null;
  const ResizeObserver = vi.fn(function (this: unknown, cb: typeof resized) {
    resized = cb;
    return { observe: (el: FakeEl) => observed.add(el), unobserve: (el: FakeEl) => observed.delete(el) };
  });
  const MutationObserver = vi.fn(function (this: unknown, cb: () => void) {
    mutated = cb;
    return { observe: vi.fn() };
  });
  const doc = { body: {}, querySelectorAll: (_: string) => elements.filter((e) => e.isConnected) };
  return {
    observed,
    ResizeObserver,
    MutationObserver,
    resize: (target: FakeEl, width: number, height: number) => resized?.([{ target, contentRect: { width, height } }]),
    mutate: () => mutated?.(),
    run: () =>
      startContainerUnitFallback({
        css: supports === null ? undefined : { supports: () => supports },
        doc: doc as never,
        ResizeObserver: ResizeObserver as never,
        MutationObserver: MutationObserver as never,
      }),
  };
}

describe('container-unit fallback: the runtime', () => {
  it('needed only where cqw is not supported', () => {
    expect(needsContainerUnitFallback({ supports: (p, v) => p === 'width' && v === '1cqw' })).toBe(false);
    expect(needsContainerUnitFallback({ supports: () => false })).toBe(true);
    expect(needsContainerUnitFallback(undefined)).toBe(true);
  });

  it('in a browser with container units: nothing is created, nothing measured', () => {
    const e = env([element('vm')], true);
    expect(e.run()).toBe(false);
    expect(e.ResizeObserver).not.toHaveBeenCalled();
    expect(e.MutationObserver).not.toHaveBeenCalled();
  });

  it('without them: watches the four containers, and sets --cqw (and --cqh on size containers) from each one’s size', () => {
    expect(CONTAINERS.map(([s]) => s)).toEqual(['.machine-slot', '.vm', '.sugar-fx', '.hand-layer']);
    const slot = element('machine-slot');
    const vm = element('vm');
    const e = env([slot, vm], false);
    expect(e.run()).toBe(true);
    expect([...e.observed]).toEqual([slot, vm]);
    e.resize(vm, 346, 432);
    expect(vm.props.get('--cqw')).toBe('3.46px');
    expect(vm.props.has('--cqh')).toBe(false);
    e.resize(slot, 360, 700);
    expect(slot.props.get('--cqw')).toBe('3.6px');
    expect(slot.props.get('--cqh')).toBe('7px');
    // A resize or a turn of the phone delivers new sizes: the values follow.
    e.resize(vm, 287, 358);
    expect(vm.props.get('--cqw')).toBe('2.87px');
  });

  it('follows screens mounting and unmounting their machines', () => {
    const first = element('vm');
    const list = [first];
    const e = env(list, false);
    e.run();
    expect([...e.observed]).toEqual([first]);
    first.isConnected = false;
    const next = element('vm');
    list.push(next);
    e.mutate();
    expect([...e.observed]).toEqual([next]);
  });
});
