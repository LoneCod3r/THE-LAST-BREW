import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { SUGAR_MAX } from '../data/machine';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Sigil } from './Glyphs';

export type SugarDirection = 'up' | 'down';

type Tone = 'accent' | 'pale' | 'ash';

interface Particle {
  key: number;
  /** Start position, % of the machine frame. */
  x: number;
  y: number;
  /** Travel, in container units of the frame. */
  dx: number;
  dy: number;
  size: number;
  delay: number;
  duration: number;
  tone: Tone;
}

interface Burst {
  id: number;
  dir: SugarDirection;
  peak: number;
  particles: Particle[];
}

/** Longest particle life (delay + duration) plus a margin, in ms. */
const BURST_LIFETIME = 2000;
/** At most this many bursts on screen at once, however fast the buttons are pressed. */
const MAX_BURSTS = 3;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function pickTone(): Tone {
  const r = Math.random();
  return r < 0.55 ? 'pale' : r < 0.85 ? 'accent' : 'ash';
}

/** A point on an ellipse around the machine, never below its base. */
function aroundMachine(spread: number): { x: number; y: number } {
  for (;;) {
    const a = rand(0, Math.PI * 2);
    const x = 50 + Math.cos(a) * rand(48, 56) * spread;
    const y = 46 + Math.sin(a) * rand(44, 52) * spread;
    if (y < 96) return { x, y };
  }
}

/** Sparse by design: 9 crystals at level 1, 21 at level 5; fewer when dissolving. */
function makeParticles(dir: SugarDirection, level: number): Particle[] {
  const count = dir === 'up' ? 6 + level * 3 : 5 + level * 2;
  return Array.from({ length: count }, (_, key) => {
    if (dir === 'up') {
      const { x, y } = aroundMachine(1);
      return {
        key,
        x,
        y,
        dx: rand(-2.2, 2.2),
        dy: -rand(5, 11),
        size: rand(1.8, 3.6),
        delay: rand(0, 260),
        duration: rand(1100, 1700),
        tone: pickTone(),
      };
    }
    // Dissolving: start a little further out and fall inward into dust.
    const { x, y } = aroundMachine(1.08);
    return {
      key,
      x,
      y,
      dx: (50 - x) * rand(0.18, 0.3),
      dy: (46 - y) * rand(0.18, 0.3),
      size: rand(1.5, 3),
      delay: rand(0, 120),
      duration: rand(600, 900),
      tone: pickTone(),
    };
  });
}

/**
 * Drives the sugar effects: particle bursts around the machine, a brief screen
 * flicker on every change, and the sigil when sugar reaches its maximum.
 * Reduced motion keeps the level change but skips particles and the sigil.
 */
export function useSugarEffects() {
  const reduced = useReducedMotion();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flicker, setFlicker] = useState(0);
  const [sigil, setSigil] = useState(0);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const trigger = useCallback(
    (dir: SugarDirection, level: number) => {
      setFlicker((n) => n + 1);
      if (reduced) return;
      nextId.current += 1;
      const id = nextId.current;
      const burst: Burst = { id, dir, peak: 0.45 + level * 0.1, particles: makeParticles(dir, level) };
      setBursts((all) => [...all.slice(-(MAX_BURSTS - 1)), burst]);
      timers.current.push(window.setTimeout(() => setBursts((all) => all.filter((b) => b.id !== id)), BURST_LIFETIME));
      if (dir === 'up' && level === SUGAR_MAX) setSigil((n) => n + 1);
    },
    [reduced],
  );

  return { bursts, flicker, sigil, trigger };
}

/** Crystals around the machine. Rendered in the frame, over the photo's edges. */
export function SugarParticles({ bursts }: { bursts: Burst[] }) {
  return (
    <div className="sugar-fx" aria-hidden="true">
      {bursts.flatMap((b) =>
        b.particles.map((p) => (
          <i
            key={`${b.id}-${p.key}`}
            className={`sugar-fx__p sugar-fx__p--${b.dir} is-${p.tone}`}
            style={
              {
                left: `${p.x}%`,
                top: `${p.y}%`,
                '--dx': `${p.dx}cqw`,
                '--dy': `${p.dy}cqh`,
                '--s': `${p.size}px`,
                '--peak': b.peak,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.duration}ms`,
              } as CSSProperties
            }
          />
        )),
      )}
    </div>
  );
}

/** The symbol that surfaces through the screen at maximum sugar, then is gone. */
export function SugarSigil({ trigger }: { trigger: number }) {
  if (trigger === 0) return null;
  return (
    <div key={trigger} className="sugar-sigil" aria-hidden="true">
      <Sigil className="sugar-sigil__mark" />
    </div>
  );
}
