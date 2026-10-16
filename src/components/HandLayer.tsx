import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const same = (a: Box, b: Box) =>
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

/**
 * Renders its children in a page-level layer laid exactly over `anchor` and
 * clipped to it. Living outside the page's stacking contexts lets the hand sit
 * above the CRT scanline overlay. Positions are document coordinates, so
 * scrolling needs no updates; layout changes are re-measured.
 */
export function HandLayer({ anchor, children }: { anchor: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const el = anchor.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
      setBox((prev) => (prev && same(prev, next) ? prev : next));
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    ro.observe(document.body);
    window.addEventListener('resize', schedule);
    // Entry animations move the anchor without resizing anything.
    document.addEventListener('animationend', schedule, true);
    document.addEventListener('transitionend', schedule, true);
    void document.fonts?.ready.then(schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('animationend', schedule, true);
      document.removeEventListener('transitionend', schedule, true);
    };
  }, [anchor]);

  if (!box) return null;
  return createPortal(
    <div className="hand-layer" style={box} aria-hidden="true">
      {children}
    </div>,
    document.body,
  );
}
