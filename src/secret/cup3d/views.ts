/**
 * How the cup is looked at: pure state and rules, no rendering. The camera orbits
 * the cup (lights travel with it, so turning reads as turning the cup under a lamp).
 *
 *   yaw    degrees around the cup; 0 shows it as the game's artwork does, handle on the right
 *   pitch  degrees above the rim plane; negative looks from below, 89 looks straight down
 *   depth  0 outside, 1 looking down into the cup (the camera also comes down to the coffee)
 */
import { ART_ELEVATION_DEG } from './profile';

export interface Pose {
  yaw: number;
  pitch: number;
  depth: number;
}

/**
 * Eye level: the camera aims at the middle of the bowl, so it sits a little higher than the
 * artwork's 12° to show the rim at the artwork's angle.
 */
export const EYE_PITCH = ART_ELEVATION_DEG + 4.4;
/** The artwork's own view. */
export const INITIAL: Pose = { yaw: 0, pitch: EYE_PITCH, depth: 0 };
export const PITCH_MIN = -80;
export const PITCH_MAX = 89;
/** Looking into the cup: straight down onto the coffee. */
export const INSIDE_PITCH = PITCH_MAX;
/** The rim steps: three quarter turns at eye level after the start, then the underside, then round again. */
export const UNDERSIDE_PITCH = -62;
export const RIM_STEPS = 5;

export const DURATION = { inside: 1300, turn: 900, key: 260, settle: 2600, leaveInside: 320 } as const;
/** Degrees per pixel of drag, and per arrow-key press. */
export const DRAG_DEG_PER_PX = 0.42;
export const KEY_YAW = 15;
export const KEY_PITCH = 10;
/** A press that moves less than this is a click, not a drag. */
export const CLICK_SLOP_PX = 6;

export const clampPitch = (p: number) => Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));

/** The parts of the cup a click can land on (see CupScene). */
export type Part = 'coffee' | 'lip' | 'rim' | 'handle' | 'body' | 'inner' | 'base';
/** The top band of the outside counts as the rim, so the thin lip is easy to hit. */
export const RIM_BAND_HEIGHT = 205;

export type Intent = 'inside' | 'outside' | 'turn';

/** What a click on `part` (at height `h`, artwork px) does. */
export function intentFor(part: Part, h: number, inside: boolean): Intent {
  if (part === 'lip' || part === 'rim' || part === 'handle') return 'turn';
  if (part === 'body' && h >= RIM_BAND_HEIGHT) return 'turn';
  if (part === 'coffee') return inside ? 'outside' : 'inside';
  // The body, the inside wall and the underside lead back into the cup: there is always a way back.
  return 'inside';
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Tween {
  from: Pose;
  to: Pose;
  start: number;
  ms: number;
}

/** A short spoken description of a pose, for the live region. */
export function describe(p: Pose): string {
  if (p.depth > 0.5) return 'Looking into the cup';
  if (p.pitch < -20) return 'The underside of the cup';
  if (p.pitch > 55) return 'The cup from above';
  const y = ((Math.round(p.yaw / 45) * 45) % 360 + 360) % 360;
  switch (y) {
    case 0:
      return 'The cup from the side, handle on the right';
    case 90:
      return 'The handle toward you';
    case 180:
      return 'The cup from the side, handle on the left';
    case 270:
      return 'The handle behind the cup';
    default:
      return 'The cup, turned';
  }
}

export class ViewController {
  private pose: Pose;
  private tween: Tween | null = null;
  /** The outside view to return to when leaving the inside. */
  private lastOutside: Pose;
  /** Where the rim steps count from, and how far along they are. */
  private stepBase: number;
  private step = 0;
  reduced: boolean;

  constructor(reduced: boolean, now: number) {
    this.reduced = reduced;
    this.pose = { ...INITIAL };
    this.lastOutside = { ...INITIAL };
    this.stepBase = INITIAL.yaw;
    // A slow settle into the artwork's view: the only hint that the cup can be turned.
    if (!reduced) this.go({ ...INITIAL }, DURATION.settle, now, { yaw: INITIAL.yaw + 22, pitch: INITIAL.pitch + 5, depth: 0 });
  }

  get inside(): boolean {
    return (this.tween?.to ?? this.pose).depth === 1;
  }

  /** The target the controller is heading for (or resting at). */
  get goal(): Pose {
    return { ...(this.tween?.to ?? this.pose) };
  }

  animating(now: number): boolean {
    return !!this.tween && now < this.tween.start + this.tween.ms;
  }

  /** The pose at `now`, advancing any transition. */
  at(now: number): Pose {
    const tw = this.tween;
    if (!tw) return { ...this.pose };
    const t = tw.ms <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.ms);
    const k = ease(t);
    this.pose = { yaw: lerp(tw.from.yaw, tw.to.yaw, k), pitch: lerp(tw.from.pitch, tw.to.pitch, k), depth: lerp(tw.from.depth, tw.to.depth, k) };
    if (t >= 1) {
      this.pose = { ...tw.to };
      this.tween = null;
    }
    return { ...this.pose };
  }

  private go(to: Pose, ms: number, now: number, from?: Pose): void {
    const start = from ?? this.at(now);
    this.pose = start;
    this.tween = { from: start, to: { ...to, pitch: clampPitch(to.pitch) }, start: now, ms: this.reduced ? 0 : ms };
    if (this.tween.ms === 0) this.at(now);
  }

  /** Into the cup, keeping the current turn so the handle stays where it was. */
  goInside(now: number): void {
    const cur = this.at(now);
    if (!this.inside) this.lastOutside = cur.depth === 0 ? { ...cur } : { ...this.lastOutside };
    this.go({ yaw: cur.yaw, pitch: INSIDE_PITCH, depth: 1 }, DURATION.inside, now);
  }

  /** Back out to the view the visitor came from. */
  goOutside(now: number): void {
    const back = { ...this.lastOutside, yaw: this.at(now).yaw, depth: 0 };
    this.go(back, DURATION.inside, now);
  }

  toggleInside(now: number): void {
    if (this.inside) this.goOutside(now);
    else this.goInside(now);
  }

  /** One controlled turn by the rim: quarter turns at eye level, then the underside, then round again. */
  rimTurn(now: number): void {
    const cur = this.at(now);
    this.step = (this.step + 1) % RIM_STEPS;
    if (this.step === 0) this.stepBase += 360;
    const to =
      this.step === RIM_STEPS - 1
        ? { yaw: this.stepBase + 315, pitch: UNDERSIDE_PITCH, depth: 0 }
        : { yaw: this.stepBase + this.step * 90, pitch: EYE_PITCH, depth: 0 };
    // Never spin the long way round: the next step is always ahead, by at most a little over a turn.
    while (to.yaw - cur.yaw > 360) to.yaw -= 360;
    while (to.yaw < cur.yaw) to.yaw += 360;
    this.lastOutside = { ...to };
    this.go(to, DURATION.turn, now);
  }

  /** Arrow keys: a small turn, eased. Leaving the inside view on the way if needed. */
  nudge(dYaw: number, dPitch: number, now: number): void {
    const g = this.goal;
    const to = { yaw: g.yaw + dYaw, pitch: clampPitch(g.pitch + dPitch), depth: 0 };
    this.go(to, g.depth > 0 ? DURATION.leaveInside : DURATION.key, now);
    this.afterFreeMove(to);
  }

  /** Free rotation by drag, applied directly (no easing), always within the pitch limits. */
  drag(dxPx: number, dyPx: number, now: number): void {
    const cur = this.at(now);
    const to = {
      yaw: cur.yaw - dxPx * DRAG_DEG_PER_PX,
      pitch: clampPitch(cur.pitch + dyPx * DRAG_DEG_PER_PX),
      // Dragging always leaves the inside view; the camera eases back out as it turns.
      depth: Math.max(0, cur.depth - (Math.abs(dxPx) + Math.abs(dyPx)) / 90),
    };
    this.tween = null;
    this.pose = to;
    this.afterFreeMove(to);
  }

  /** Escape: back to the artwork's view, at the current turn. */
  reset(now: number): void {
    const cur = this.at(now);
    const yaw = Math.round((cur.yaw - INITIAL.yaw) / 360) * 360 + INITIAL.yaw;
    const to = { ...INITIAL, yaw };
    this.go(to, DURATION.turn, now);
    this.afterFreeMove(to);
  }

  /** After a free move the rim steps start again from here, and leaving the inside returns here. */
  private afterFreeMove(to: Pose): void {
    this.stepBase = to.yaw;
    this.step = 0;
    if (to.depth === 0) this.lastOutside = { ...to };
  }
}

export type KeyCommand = 'left' | 'right' | 'up' | 'down' | 'toggle' | 'rim' | 'inside' | 'reset';

/** Keyboard controls on the focused cup. */
export function keyCommand(key: string): KeyCommand | null {
  switch (key) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'Enter':
    case ' ':
      return 'toggle';
    case 'r':
    case 'R':
      return 'rim';
    case 'Home':
      return 'inside';
    case 'Escape':
      return 'reset';
    default:
      return null;
  }
}

/** Apply a key command to the controller. */
export function runCommand(c: ViewController, cmd: KeyCommand, now: number): void {
  switch (cmd) {
    case 'left':
      return c.nudge(KEY_YAW, 0, now);
    case 'right':
      return c.nudge(-KEY_YAW, 0, now);
    case 'up':
      return c.nudge(0, KEY_PITCH, now);
    case 'down':
      return c.nudge(0, -KEY_PITCH, now);
    case 'toggle':
      return c.toggleInside(now);
    case 'rim':
      return c.rimTurn(now);
    case 'inside':
      return c.goInside(now);
    case 'reset':
      return c.reset(now);
  }
}
