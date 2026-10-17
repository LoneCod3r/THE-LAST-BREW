import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import machinePhoto from '../assets/machine-empty.webp';
import { CUP_ART, CUP_BASE, CUP_CENTER, OPENING_CX, PHOTO, SCREEN, type Point, type Rect } from '../data/machine';
import { phaseIndex, type BrewPhase } from '../data/brew';
import { CartoonHand } from './CartoonHand';
import { Cup, type CupStage, type HandoffTarget } from './Cup';
import { HandLayer } from './HandLayer';

export function rectStyle(r: Rect): CSSProperties {
  return { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` };
}

interface VendingMachineProps {
  /** Content rendered on the touchscreen glass. */
  screen: ReactNode;
  hand: { tip: Point; scale: number; pressId: number };
  dispense?: { phase: BrewPhase; roast: string; pourMs: number; sugar: number } | null;
  /** Where the cup is in its handoff; anything but 'tray' means it has left the machine. */
  cupStage?: CupStage;
  onPickup?: () => void;
  /** Effects drawn around the machine, over the frame. */
  around?: ReactNode;
  /** Physical controls mounted on the casing. */
  controls?: ReactNode;
  /** Extra state classes for the machine (e.g. a reaction to an Easter egg). */
  mood?: string;
}

/**
 * Where the cup should end up: its bowl on the machine opening's centreline, close to the viewer
 * (about a third of the screen tall, never wider than the screen), resting just
 * above the bottom edge with room for its shadow. Measured from the real layout.
 */
function handoffTarget(vm: HTMLElement): HandoffTarget {
  const r = vm.getBoundingClientRect();
  const k = r.width / PHOTO.width;
  const vw = document.documentElement.clientWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const artW = CUP_ART.w * k;
  const artH = CUP_ART.h * k;
  const margin = Math.max(14, vh * 0.04);
  const toX = r.left + OPENING_CX * k;
  // The handle reaches further right of the bowl than the bowl does left: keep both on screen.
  const reachLeft = (CUP_CENTER.x - CUP_ART.x) * k;
  const reachRight = (CUP_ART.x + CUP_ART.w - CUP_CENTER.x) * k;
  let s = Math.min((vh * 0.32) / artH, ((vw - 32) * 0.7) / artW);
  s = Math.min(Math.max(s, 1.25), (toX - 12) / reachLeft, (vw - 12 - toX) / reachRight);
  const finalH = artH * s;
  const fromX = r.left + CUP_CENTER.x * k;
  const fromY = r.top + CUP_CENTER.y * k;
  const toY = vh - margin - finalH * 0.62;
  return { x: toX - fromX, y: toY - fromY, s };
}

export function VendingMachine({ screen, hand, dispense, cupStage = 'tray', onPickup, around, controls, mood }: VendingMachineProps) {
  const handoff = cupStage !== 'tray';
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const vmRef = useRef<HTMLDivElement>(null);
  const ref = (name: string) => `${uid}-${name}`;
  const idx = dispense ? phaseIndex(dispense.phase) : -1;
  const [target, setTarget] = useState<HandoffTarget | null>(null);

  // Measure before paint so the cup starts its move from exactly where it stands.
  useLayoutEffect(() => {
    if (!handoff) {
      setTarget(null);
      return;
    }
    const measure = () => {
      if (vmRef.current) setTarget(handoffTarget(vmRef.current));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [handoff]);

  const classes = [
    'vm',
    dispense && 'vm--dispense',
    idx >= 1 && 'is-powered',
    idx >= 3 && 'is-sugared',
    (idx === 2 || idx === 4) && 'is-working',
    idx === 4 && 'is-pouring',
    idx >= 4 && 'is-filling',
    idx >= 5 && 'is-steaming',
    target && 'is-handoff',
    cupStage === 'gone' && 'is-served',
    mood,
  ]
    .filter(Boolean)
    .join(' ');

  const vars = {
    '--pour-ms': `${dispense?.pourMs ?? 0}ms`,
    '--roast': dispense?.roast ?? '#4f2f17',
  } as CSSProperties;

  return (
    <figure className="vm-frame">
      <div ref={vmRef} className={classes} style={vars} data-phase={dispense?.phase ?? 'idle'}>
        <img
          className="vm__photo"
          src={machinePhoto}
          width={PHOTO.width}
          height={PHOTO.height}
          alt="A touchscreen coffee machine with a red cup on its drip tray."
          draggable={false}
        />

        <svg className="vm__fx" viewBox={`0 0 ${PHOTO.width} ${PHOTO.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient id={ref('glow')}>
              <stop offset="0" stopColor="#d6d9d2" stopOpacity="0.32" />
              <stop offset="1" stopColor="#d6d9d2" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={ref('contact')}>
              <stop offset="0" stopColor="#000" stopOpacity="0.7" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse className="vm__glow" cx="247" cy="365" rx="150" ry="95" fill={`url(#${ref('glow')})`} />
          {/* The cup's contact shadow on the tray; it fades as the cup is lifted away. */}
          <ellipse className="vm__contact" cx={CUP_BASE.cx} cy={CUP_BASE.y} rx={CUP_BASE.rx + 6} ry="4" fill={`url(#${ref('contact')})`} />
        </svg>

        <Cup sugar={dispense?.sugar ?? 0} target={target} stage={target ? cupStage : 'tray'} onPickup={onPickup} />

        <div className="vm__screen" style={rectStyle(SCREEN)}>
          {screen}
        </div>
        {controls}
      </div>
      <HandLayer anchor={vmRef}>
        <CartoonHand tip={hand.tip} scale={hand.scale} pressId={hand.pressId} />
      </HandLayer>
      {around}
    </figure>
  );
}
