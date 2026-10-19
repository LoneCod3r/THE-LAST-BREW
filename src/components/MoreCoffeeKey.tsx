import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';

/** The key's caps once the full set has been drunk: two distinct steps, punctuation included. */
export const ENOUGH_LABELS = {
  /** Opens THE LAST DROP in a new tab. */
  lastDrop: 'Enough?',
  /** Carries on into THE SECRET BLEND. */
  secretBlend: 'Enough.',
} as const;

/** A second activation this soon after the first is the same press (a double click or tap). */
export const KEY_LOCKOUT_MS = 450;

interface MoreCoffeeKeyProps {
  ref?: Ref<HTMLButtonElement>;
  /** Hidden keys are out of the tab order and the accessibility tree. */
  shown: boolean;
  onPress: () => void;
  /** The key's cap; the same key reads one of ENOUGH_LABELS once the full set has been drunk. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * MORE COFFEE: a wide, spacebar-style metal key. It is an ordinary button, so mouse,
 * touch, Enter and Space each activate it once; the key also stays visibly down
 * while it is held, by pointer or keyboard.
 */
export function MoreCoffeeKey({ ref, shown, onPress, label = 'MORE COFFEE', className = '', style }: MoreCoffeeKeyProps) {
  const [down, setDown] = useState(false);
  const [tap, setTap] = useState(false);
  const tapTimer = useRef<number | undefined>(undefined);
  const lastPress = useRef(-Infinity);

  useEffect(() => () => window.clearTimeout(tapTimer.current), []);
  useEffect(() => {
    if (!shown) setDown(false);
  }, [shown]);

  const release = () => setDown(false);

  return (
    <button
      ref={ref}
      type="button"
      className={`more-key${shown ? ' is-shown' : ''}${down || tap ? ' is-down' : ''} ${className}`.trim()}
      style={style}
      onPointerDown={() => setDown(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') setDown(true);
      }}
      onKeyUp={release}
      onBlur={release}
      onClick={() => {
        // A key that is fading out (or not yet in) is not pressable.
        if (!shown) return;
        const now = performance.now();
        if (now - lastPress.current < KEY_LOCKOUT_MS) return;
        lastPress.current = now;
        // A brief travel even when the activation had no press phase (e.g. Enter, or assistive tech).
        window.clearTimeout(tapTimer.current);
        setTap(true);
        tapTimer.current = window.setTimeout(() => setTap(false), 140);
        onPress();
      }}
    >
      <span className="more-key__cap">{label}</span>
    </button>
  );
}
