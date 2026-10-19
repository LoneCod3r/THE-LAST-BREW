/**
 * Runtime half of the container-unit fallback (see containerUnitFallback.ts). In browsers
 * without cqw/cqh it measures every container the stylesheet relies on and sets --cqw (and,
 * for size containers, --cqh) on it: 1% of its content box, in px, kept current as it
 * resizes (window resizes and orientation changes included). The custom properties inherit,
 * so each rule picks up its nearest container's value, as the real units would.
 *
 * Browsers that support the units return at once: no observers, no measuring.
 */

/** The elements vending.css makes containers, and whether they also give cqh (size containers). */
export const CONTAINERS: readonly (readonly [selector: string, givesHeight: boolean])[] = [
  ['.machine-slot', true],
  ['.vm', false],
  ['.sugar-fx', true],
  ['.hand-layer', false],
];

type Supports = { supports?: (property: string, value: string) => boolean };

export function needsContainerUnitFallback(css: Supports | undefined = globalThis.CSS): boolean {
  return !(css && typeof css.supports === 'function' && css.supports('width', '1cqw'));
}

interface Env {
  css?: Supports;
  doc: Pick<Document, 'querySelectorAll' | 'body'>;
  ResizeObserver?: typeof ResizeObserver;
  MutationObserver?: typeof MutationObserver;
  frame?: (cb: () => void) => unknown;
}

/** Returns false when nothing was needed (or nothing could be measured with). */
export function startContainerUnitFallback(env: Env = defaultEnv()): boolean {
  if (!needsContainerUnitFallback(env.css)) return false;
  const RO = env.ResizeObserver;
  const MO = env.MutationObserver;
  if (!RO || !MO) return false;

  const selector = CONTAINERS.map(([s]) => s).join(', ');
  const heightSelector = CONTAINERS.filter(([, h]) => h)
    .map(([s]) => s)
    .join(', ');
  const watched = new Set<Element>();

  const sizes = new RO((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      const { width, height } = entry.contentRect;
      el.style.setProperty('--cqw', `${width / 100}px`);
      if (el.matches(heightSelector)) el.style.setProperty('--cqh', `${height / 100}px`);
    }
  });

  // Screens mount and unmount their machines: watch the new containers, let go of the gone ones.
  const scan = () => {
    for (const el of watched) {
      if (!el.isConnected) {
        sizes.unobserve(el);
        watched.delete(el);
      }
    }
    env.doc.querySelectorAll(selector).forEach((el) => {
      if (watched.has(el)) return;
      watched.add(el);
      sizes.observe(el);
    });
  };
  let queued = false;
  const queueScan = () => {
    if (queued) return;
    queued = true;
    (env.frame ?? ((cb: () => void) => cb()))(() => {
      queued = false;
      scan();
    });
  };

  scan();
  new MO(queueScan).observe(env.doc.body, { childList: true, subtree: true });
  return true;
}

function defaultEnv(): Env {
  return {
    css: globalThis.CSS,
    doc: document,
    ResizeObserver: globalThis.ResizeObserver,
    MutationObserver: globalThis.MutationObserver,
    frame: (cb) => window.requestAnimationFrame(cb),
  };
}
