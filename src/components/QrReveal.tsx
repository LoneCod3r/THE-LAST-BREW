import { useEffect, useMemo, useRef, useState } from 'react';
import { QUIET_ZONE, encodeQr, qrPath } from '../secret/qr';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MoreCoffeeKey } from './MoreCoffeeKey';

/** The code surfaces this long before MORE COFFEE returns; must match .qr-reveal in vending.css. */
export const QR_SURFACE_MS = 2200;
const QR_SURFACE_REDUCED_MS = 400;

interface QrRevealProps {
  /** The address the code encodes (and opens, for anyone who cannot scan their own screen). */
  href: string;
  /** MORE COFFEE, once the code has surfaced: the machine carries on as before. */
  onContinue: () => void;
}

/** After Enough?: the machine goes quiet and a QR code surfaces in front of it. No caption. */
export function QrReveal({ href, onContinue }: QrRevealProps) {
  const reduced = useReducedMotion();
  const [keyShown, setKeyShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const code = useMemo(() => encodeQr(href), [href]);
  const side = code.size + 2 * QUIET_ZONE;

  // Focus moves to the code's frame (not the link), so a repeated Enter or Space opens nothing.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // MORE COFFEE comes back only after the code has surfaced: the reveal cannot be skipped by a double press.
  useEffect(() => {
    const t = window.setTimeout(() => setKeyShown(true), reduced ? QR_SURFACE_REDUCED_MS : QR_SURFACE_MS);
    return () => window.clearTimeout(t);
  }, [reduced]);

  return (
    <div ref={ref} className="qr-reveal" role="group" aria-label="QR code" tabIndex={-1}>
      <a className="qr-reveal__code" href={href} target="_blank" rel="noopener" aria-label="Follow the code">
        <svg viewBox={`0 0 ${side} ${side}`} shapeRendering="crispEdges" aria-hidden="true">
          <rect width={side} height={side} className="qr-reveal__paper" />
          <path d={qrPath(code)} className="qr-reveal__ink" />
        </svg>
      </a>
      <MoreCoffeeKey shown={keyShown} onPress={onContinue} className="more-key--free qr-reveal__key" />
    </div>
  );
}
