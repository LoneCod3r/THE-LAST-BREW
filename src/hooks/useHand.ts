import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HAND_NEAR_SCALE,
  HAND_PRESS_SCALE,
  HAND_REST,
  buttonTarget,
  type Point,
  type ScreenButtonId,
} from '../data/machine';
import { useReducedMotion } from './useReducedMotion';

/** Must match the .hand / .hand__aim transitions and press keyframes in vending.css. */
export const HAND_TRAVEL_MS = 620;
export const HAND_CONTACT_MS = 200;
export const HAND_PRESS_MS = 460;

export interface HandPose {
  tip: Point;
  /** Depth: larger is closer to the viewer. */
  scale: number;
}

const REST_POSE: HandPose = { tip: HAND_REST, scale: HAND_NEAR_SCALE };

interface PressOptions {
  /** Called the moment the fingertip touches the button. */
  onContact?: () => void;
  /** Pull back toward the viewer after the press (default true). */
  retract?: boolean;
}

/** Drives the hand: reach forward to a button, press it, pull back toward the viewer. */
export function useHand(initial: HandPose = REST_POSE) {
  const reduced = useReducedMotion();
  const [pose, setPose] = useState<HandPose>(initial);
  const [pressId, setPressId] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  const press = useCallback(
    (button: ScreenButtonId, { onContact, retract = true }: PressOptions = {}) => {
      clear();
      const travel = reduced ? 0 : HAND_TRAVEL_MS;
      const contact = reduced ? 0 : HAND_CONTACT_MS;
      const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
      setPose({ tip: buttonTarget(button), scale: HAND_PRESS_SCALE });
      after(travel, () => setPressId((n) => n + 1));
      after(travel + contact, () => onContact?.());
      if (retract) after(travel + (reduced ? 0 : HAND_PRESS_MS) + 80, () => setPose(REST_POSE));
    },
    [clear, reduced],
  );

  const moveTo = useCallback(
    (tip: Point, scale = HAND_NEAR_SCALE) => {
      clear();
      setPose({ tip, scale });
    },
    [clear],
  );

  return { tip: pose.tip, scale: pose.scale, pressId, press, moveTo };
}
