/**
 * What the coffee leaves behind. Everything here is added over the cup, never into it:
 * the cup's own meshes and materials stay exactly as built (cupModel.ts), and nothing
 * below is visible until the first sip.
 *
 *   liner   the inside of the cup below the coffee, glazed like the pale band above it
 *           (the cup's own inside below the coffee was never meant to be seen: it is red,
 *           roughly sampled, and the handle's ends show through it). The liner stands in a
 *           little further where the handle meets the wall, so they stay covered.
 *   rings   the faint line each sip leaves on the wall
 *   floor   grounds on the bottom: the clock, and the end of the trail
 *   wall    grounds on the inside wall above the handle: TWELVE, its first E under a
 *           drip that runs on down into the cup as the trail
 *   stamp   pressed into the base: _:__, and in the end the time
 *
 * Coordinates are the cup's own (artwork px, y up, the handle on +x). Seen from above,
 * a direction `a` degrees clockwise from the handle is (cos a, sin a) in (x, z).
 * Textures are drawn in code with a fixed seed, so the grounds look the same every time.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
} from 'three';
import type { CupModel } from './cupModel';
import { COFFEE_HEIGHT, COLOURS, FOOT_RADIUS, HANDLE, WALL, handlePath, outerSurface } from './profile';
import { ANSWER, HANDS, HIDDEN_LETTER, MARKS, MARK_DEG, WORD } from '../reading/puzzle';
import { SIPS } from '../reading/state';
import type { Part } from './views';

/** The inside wall's radius at a height. */
export const innerRadius = (h: number) => outerSurface(h) - WALL;

/** The grounds settle on a floor a little above the cup's own inside bottom (which curves up at its edge). */
export const FLOOR_HEIGHT = 24;
/** Each added surface sits this far inside the one it covers, so they never fight for the same pixels. */
const GAP = { liner: 1.2, decal: 2, ring: 1.6 } as const;
/** The coffee's surface before each sip; after the last, the cup is empty. */
export const LEVELS = [COFFEE_HEIGHT, 150, 80] as const;
const SEGMENTS = 96;

export const FLOOR_RADIUS = innerRadius(FLOOR_HEIGHT) - GAP.liner;
/** The liner reaches up to just under the coffee line, where the pale band of the cup's own inside begins. */
const LINER_TOP = COFFEE_HEIGHT - 2;

/**
 * Where the handle's tube ends inside the wall: the height of each end, and the radius its open end
 * reaches in to (less a margin). The tube runs in the plane of the axis on +x: direction 0.
 */
export const HANDLE_ROOTS = (() => {
  const path = handlePath();
  return [path[0], path[path.length - 1]].map((p) => ({ h: p.h, reach: p.x - HANDLE.tube - 1.5 }));
})();

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** How much further in than usual the liner stands at a point of the wall: a soft swelling over each handle root. */
export function rootSwell(deg: number, h: number): number {
  let d = 0;
  const arc = ((Math.abs(((deg + 540) % 360) - 180) * Math.PI) / 180) * innerRadius(h);
  for (const root of HANDLE_ROOTS) {
    const near = smooth(26, HANDLE.tube + 2, arc) * smooth(HANDLE.tube + 10, HANDLE.tube + 2, Math.abs(h - root.h));
    d = Math.max(d, Math.max(0, innerRadius(h) - GAP.liner - root.reach) * near);
  }
  // Flat again at the liner's top edge, where it meets the cup's own pale band.
  return d * smooth(LINER_TOP, LINER_TOP - 3, h);
}

/** The liner's radius (and, `inset` further in, anything laid over it) at a point of the wall. */
export const linerRadius = (deg: number, h: number, inset: number = GAP.liner) => innerRadius(h) - inset - rootSwell(deg, h);

/** The clock on the floor: the ring of marks and the two hands, in artwork px. */
export const CLOCK = {
  ring: FLOOR_RADIUS * 0.8,
  mark: 7,
  hub: 5,
  hour: { length: FLOOR_RADIUS * 0.8 * 0.52, width: 8 },
  minute: { length: FLOOR_RADIUS * 0.8 * 0.84, width: 3.5 },
  trail: 4,
} as const;

/** Where on the floor a direction (degrees clockwise from the handle) and a distance from the middle land. */
export function onFloor(deg: number, r: number): { x: number; z: number } {
  const a = (deg * Math.PI) / 180;
  return { x: r * Math.cos(a), z: r * Math.sin(a) };
}

/** The mark `k` places clockwise from the handle (k = 0 is twelve: under the handle, where the trail ends). */
export const markCentre = (k: number) => onFloor(k * MARK_DEG, CLOCK.ring);
export const handTip = (hand: 'hour' | 'minute') => onFloor(HANDS[hand], CLOCK[hand].length);
/** The trail on the floor: in from the foot of the wall under the handle, to the centre of the twelve mark. */
export const TRAIL = { from: onFloor(0, FLOOR_RADIUS), to: markCentre(0) } as const;

/** The band of wall that carries the word and the drip: heights, and directions either side of the handle. */
export const WALL_BAND = { bottom: FLOOR_HEIGHT, top: 214, spread: 60 } as const;
/** The word's cap height on the wall: 162 to 198 px up. */
export const WORD_BAND = { bottom: 162, top: 198 } as const;

/**
 * The stamp under the base: inside the shallow recess (at 3.5 px, inside the foot ring), facing down.
 * It reads upright from the underside view the rim steps come to (a turn of 315°, see views.ts).
 */
export const STAMP = { height: 3, radius: FOOT_RADIUS - 12, upright: 315 } as const;

/** The stamp's text frame on its canvas: setTransform(...) arguments, `k` canvas px per artwork px. */
export function stampFrame(size: number): [number, number, number, number, number, number] {
  const k = size / 2 / STAMP.radius;
  const a = (STAMP.upright * Math.PI) / 180;
  return [k * Math.cos(a), k * Math.sin(a), -k * Math.sin(a), k * Math.cos(a), size / 2, size / 2];
}

/** Floor texture: canvas px from a floor point (see the CircleGeometry mapping test). */
export function toFloorCanvas(p: { x: number; z: number }, size: number): { cx: number; cy: number } {
  return { cx: size / 2 + (p.x / FLOOR_RADIUS) * (size / 2), cy: size / 2 + (p.z / FLOOR_RADIUS) * (size / 2) };
}

/** Wall texture: u runs with the direction (left to right as read across the opening), v with height. */
export function wallUv(deg: number, h: number): { u: number; v: number } {
  return {
    u: (deg + WALL_BAND.spread) / (2 * WALL_BAND.spread),
    v: (h - WALL_BAND.bottom) / (WALL_BAND.top - WALL_BAND.bottom),
  };
}

// ── Drawing ──────────────────────────────────────────────────────────────────

type Rand = () => number;

/** A small seeded generator (mulberry32): the same grounds on every visit. */
function seeded(seed: number): Rand {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUNDS = ['#1a0e06', '#24140a', '#2f1b0d', '#3d2412'] as const;

/** A clump of grounds: `n` grains scattered around (x, y), denser in the middle. */
function clump(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, spread: number, n: number, grain: number, alpha = 1) {
  for (let i = 0; i < n; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = spread * Math.sqrt(rand()) * (rand() < 0.08 ? 1.35 : 1);
    ctx.globalAlpha = alpha * (0.6 + rand() * 0.4);
    ctx.fillStyle = GROUNDS[(rand() * GROUNDS.length) | 0];
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, grain * (0.45 + rand() * 0.85), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A streak of grounds from one point to another, `width` across. */
function streak(ctx: CanvasRenderingContext2D, rand: Rand, x0: number, y0: number, x1: number, y1: number, width: number, grain: number) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.ceil(len / (width * 0.3)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    clump(ctx, rand, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, Math.ceil(width / grain) + 2, grain);
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** The floor: a thin film of grounds, the twelve marks, the hub, both hands and the end of the trail. */
function drawFloor(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const rand = seeded(720);
  const k = size / 2 / FLOOR_RADIUS;
  const at = (p: { x: number; z: number }) => toFloorCanvas(p, size);
  const grain = 0.9 * k;

  // The film: faint, a little heavier toward the edge, never enough to hide the clock.
  for (let i = 0; i < 2600; i += 1) {
    const r = FLOOR_RADIUS * Math.sqrt(rand()) ** 0.7;
    const p = at(onFloor(rand() * 360, r));
    clump(ctx, rand, p.cx, p.cy, 0.8 * k, 1, grain * 0.8, 0.14 + 0.16 * (r / FLOOR_RADIUS));
  }

  // The trail first, so the twelve mark sits on its end: it stops at the mark's centre.
  const from = at(TRAIL.from);
  const to = at(TRAIL.to);
  streak(ctx, rand, from.cx + 0.02 * size, from.cy, to.cx, to.cy, CLOCK.trail * k, grain);

  for (let m = 0; m < MARKS; m += 1) {
    const p = at(markCentre(m));
    clump(ctx, rand, p.cx, p.cy, CLOCK.mark * k, 150, grain);
  }

  const mid = at({ x: 0, z: 0 });
  for (const hand of ['hour', 'minute'] as const) {
    const tip = at(handTip(hand));
    streak(ctx, rand, mid.cx, mid.cy, tip.cx, tip.cy, CLOCK[hand].width * k, grain);
  }
  clump(ctx, rand, mid.cx, mid.cy, CLOCK.hub * k, 90, grain);
  return c;
}

/** The wall: TWELVE, with a drip over its first E that runs on down to the floor. */
function drawWall(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const rand = seeded(12);
  const xAt = (deg: number) => wallUv(deg, 0).u * w;
  const yAt = (height: number) => (1 - wallUv(0, height).v) * h;
  const ky = h / (WALL_BAND.top - WALL_BAND.bottom);
  const grain = 0.9 * ky;
  const capTop = yAt(WORD_BAND.top);
  const base = yAt(WORD_BAND.bottom);
  const cap = base - capTop;

  // The letters, drawn solid on a scratch canvas, then broken up into grains.
  const [lc, lx] = canvas(w, h);
  lx.font = `700 ${Math.round(cap / 0.716)}px "Arial Narrow", Arial, "Helvetica Neue", sans-serif`;
  lx.textBaseline = 'alphabetic';
  lx.fillStyle = GROUNDS[1];
  const gap = cap * 0.12;
  const widths = [...WORD].map((ch) => lx.measureText(ch).width);
  const before = widths.slice(0, HIDDEN_LETTER).reduce((a, b) => a + b + gap, 0);
  // The hidden letter's centre sits exactly above the handle (direction 0).
  let x = xAt(0) - before - widths[HIDDEN_LETTER] / 2;
  const hidden = { left: 0, right: 0 };
  [...WORD].forEach((ch, i) => {
    if (i === HIDDEN_LETTER) Object.assign(hidden, { left: x, right: x + widths[i] });
    lx.fillText(ch, x, base);
    x += widths[i] + gap;
  });
  // Where the letters are, before they are broken up: loose grains settle only close to them.
  const solid = lx.getImageData(0, 0, w, h).data;
  const inked = (px: number, py: number) => {
    const ix = Math.round(px);
    const iy = Math.round(py);
    return ix >= 0 && iy >= 0 && ix < w && iy < h && solid[(iy * w + ix) * 4 + 3] > 0;
  };
  lx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9000; i += 1) {
    lx.globalAlpha = 0.5 + rand() * 0.5;
    lx.beginPath();
    lx.arc(rand() * w, capTop - 4 + rand() * (cap + 8), grain * (0.3 + rand() * 0.5), 0, Math.PI * 2);
    lx.fill();
  }
  ctx.drawImage(lc, 0, 0);
  // Loose grains along the letters' edges: a point is kept only if a letter is within a few grains of it.
  const near = grain * 3;
  for (let i = 0; i < 6000; i += 1) {
    const px = xAt(-40) + rand() * (xAt(40) - xAt(-40));
    const py = capTop - near + rand() * (cap + 2 * near);
    const a = rand() * Math.PI * 2;
    if (!inked(px + Math.cos(a) * near * rand(), py + Math.sin(a) * near * rand())) continue;
    clump(ctx, rand, px, py, grain, 1, grain * 0.7, 0.4);
  }

  // The drip: a heavy smear over the whole letter, narrowing into the trail, straight down above the handle.
  const cx = xAt(0);
  const half = (hidden.right - hidden.left) / 2 + cap * 0.14;
  const smearBottom = base + cap * 0.35;
  for (let y = capTop - cap * 0.12; y <= smearBottom; y += grain * 0.8) {
    const t = Math.max(0, (y - base) / (smearBottom - base));
    const halfW = half * (1 - t) + ((CLOCK.trail * ky) / 2) * t;
    clump(ctx, rand, cx + (rand() - 0.5) * halfW * 0.2, y, halfW, Math.ceil((halfW / grain) * 3), grain);
  }
  // The trail: on down to the foot of the wall, where the floor's trail takes over.
  streak(ctx, rand, cx, smearBottom, cx, h + grain, CLOCK.trail * ky, grain);
  return c;
}

/** The stamp: three slots and a colon, pressed in; or, once given, the time. */
function drawStamp(ctx: CanvasRenderingContext2D, size: number, filled: boolean) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.setTransform(...stampFrame(size));
  const slots = [-30, 6, 30];
  const press = (dx: number, dy: number, colour: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    if (filled) {
      ctx.font = '600 26px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const [hour, minutes] = ANSWER.split(':');
      ctx.fillText(hour, slots[0] + dx, 10 + dy);
      ctx.fillText(minutes[0], slots[1] + dx, 10 + dy);
      ctx.fillText(minutes[1], slots[2] + dx, 10 + dy);
    } else {
      for (const s of slots) ctx.fillRect(s - 9 + dx, 10 + dy, 18, 3);
    }
    for (const y of [-6, 4]) {
      ctx.beginPath();
      ctx.arc(-12 + dx, y + dy, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  press(0.7, 0.7, '#c4545b', 0.35);
  press(0, 0, '#2c0206', 0.85);
  ctx.globalAlpha = 1;
}

// ── The meshes ───────────────────────────────────────────────────────────────

function texture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function decal(map: CanvasTexture): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    roughness: 0.85,
    metalness: 0,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * A band of the inside wall between two heights and two directions, `inset` in from the wall
 * (following the liner's swellings), with texture coordinates: u along the direction, v up.
 */
export function wallBand(bottom: number, top: number, from: number, to: number, rows: number, cols: number, inset: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= rows; i += 1) {
    const h = bottom + ((top - bottom) * i) / rows;
    for (let j = 0; j <= cols; j += 1) {
      const deg = from + ((to - from) * j) / cols;
      const p = onFloor(deg, linerRadius(deg, h, inset));
      pos.push(p.x, h, p.z);
      uv.push(j / cols, i / rows);
    }
  }
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const a = i * (cols + 1) + j;
      index.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(index);
  g.computeVertexNormals();
  // A full turn: the first and last columns are the same place; give them one normal so no seam shows.
  if (to - from >= 360) {
    const n = g.getAttribute('normal');
    for (let i = 0; i <= rows; i += 1) {
      const a = i * (cols + 1);
      const b = a + cols;
      const avg = new Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
      n.setXYZ(a, avg.x, avg.y, avg.z);
      n.setXYZ(b, avg.x, avg.y, avg.z);
    }
  }
  return g;
}

/** The band of wall that carries the word and the drip, either side of the handle. */
export const wallGeometry = (rows = 64, cols = 64) =>
  wallBand(WALL_BAND.bottom, WALL_BAND.top, -WALL_BAND.spread, WALL_BAND.spread, rows, cols, GAP.decal);

/** A flat disc in the cup's horizontal plane, facing up (or down), centred on the axis. */
export function flatDisc(radius: number, height: number, facing: 'up' | 'down'): Mesh {
  const mesh = new Mesh(new CircleGeometry(radius, SEGMENTS));
  mesh.rotation.x = facing === 'up' ? -Math.PI / 2 : Math.PI / 2;
  mesh.position.y = height;
  return mesh;
}

export type StampMode = 'hidden' | 'slots' | 'field' | 'solved';

const DURATION = { sip: 900, reveal: 1200, ripple: 700 } as const;
const ease = (t: number) => 1 - (1 - t) ** 3;

export class Grounds {
  readonly group = new Group();
  private coffee: Mesh;
  private liner: Mesh;
  private linerFloor: Mesh;
  private rings: Mesh[] = [];
  private floor: Mesh;
  private wall: Mesh;
  private stamp: Mesh;
  private stampCtx: CanvasRenderingContext2D;
  private stampSize = 512;
  private stampMode: StampMode = 'hidden';
  private ripple: Mesh;
  private disposables: { dispose: () => void }[] = [];
  private sips = 0;
  private level: { from: number; to: number; start: number; ms: number } | null = null;
  private reveal: { start: number; ms: number } | null = null;
  private revealed = 0;
  private rippleAt: { start: number } | null = null;

  constructor(private model: CupModel) {
    this.group.name = 'grounds';
    const coffee = model.pickable.find((m) => m.name === 'coffee');
    if (!coffee) throw new Error('The cup has no coffee');
    this.coffee = coffee;

    // The inside below the coffee, glazed like the pale band above it: a floor, then the wall up to the coffee line.
    const linerMat = new MeshPhysicalMaterial({
      color: COLOURS.lip,
      roughness: 0.34,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      side: DoubleSide,
    });
    this.liner = new Mesh(wallBand(FLOOR_HEIGHT, LINER_TOP, -180, 180, 64, 192, GAP.liner), linerMat);
    this.liner.name = 'liner';
    this.add(this.liner, linerMat);
    this.linerFloor = flatDisc(FLOOR_RADIUS, FLOOR_HEIGHT, 'up');
    this.add(this.linerFloor, linerMat);

    // A faint line where each sip left the coffee standing.
    const ringMat = new MeshStandardMaterial({ color: COLOURS.coffeeEdge, transparent: true, opacity: 0.4, depthWrite: false, roughness: 0.8, side: DoubleSide });
    this.disposables.push(ringMat);
    for (const h of [LINER_TOP - 1.5, LEVELS[1], LEVELS[2]]) {
      const geo = wallBand(h - 1, h + 0.8, -180, 180, 1, SEGMENTS, GAP.ring);
      const ring = new Mesh(geo, ringMat);
      this.rings.push(ring);
      this.group.add(ring);
      this.disposables.push(geo);
    }

    this.floor = flatDisc(FLOOR_RADIUS, FLOOR_HEIGHT + 0.5, 'up');
    this.floor.name = 'grounds-floor';
    // Clicking the bottom does what clicking the coffee did: look in, or back out.
    this.floor.userData.part = 'coffee' satisfies Part;
    this.add(this.floor, decal(texture(drawFloor(1024))));

    this.wall = new Mesh(wallGeometry());
    this.wall.name = 'grounds-wall';
    this.add(this.wall, decal(texture(drawWall(1024, 512))));

    const [sc, sx] = canvas(this.stampSize, this.stampSize);
    this.stampCtx = sx;
    drawStamp(sx, this.stampSize, false);
    this.stamp = flatDisc(STAMP.radius, STAMP.height, 'down');
    this.stamp.name = 'stamp';
    this.add(this.stamp, decal(texture(sc)));

    this.ripple = new Mesh(new RingGeometry(0.75, 1, 48), new MeshBasicMaterial({ color: new Color(COLOURS.coffeeEdge), transparent: true, opacity: 0, depthWrite: false }));
    this.ripple.rotation.x = -Math.PI / 2;
    this.add(this.ripple, this.ripple.material as Material);

    this.show();
    model.group.add(this.group);
  }

  private add(mesh: Mesh, material: Material): void {
    mesh.material = material;
    this.group.add(mesh);
    this.disposables.push(mesh.geometry, material);
    const map = (material as MeshStandardMaterial).map;
    if (map) this.disposables.push(map);
  }

  get empty(): boolean {
    return this.sips >= SIPS;
  }

  /** A sip is under way (or the grounds are still surfacing). */
  get busy(): boolean {
    return !!this.level || !!this.reveal;
  }

  /** Take a sip, from a point on the coffee (cup coordinates) or from the middle. False if none can be taken now. */
  sip(at: Vector3 | null, now: number, reduced: boolean): boolean {
    if (this.empty || this.busy) return false;
    const from = LEVELS[this.sips];
    this.sips += 1;
    const to = this.empty ? FLOOR_HEIGHT + 0.2 : LEVELS[this.sips];
    this.level = { from, to, start: now, ms: reduced ? 0 : DURATION.sip };
    if (!reduced) {
      this.rippleAt = { start: now };
      this.ripple.position.set(at?.x ?? 0, from + 0.4, at?.z ?? 0);
    }
    this.update(now);
    return true;
  }

  setStamp(mode: StampMode): void {
    if (mode === this.stampMode) return;
    if (mode === 'solved' || this.stampMode === 'solved') {
      drawStamp(this.stampCtx, this.stampSize, mode === 'solved');
      ((this.stamp.material as MeshStandardMaterial).map as CanvasTexture).needsUpdate = true;
    }
    this.stampMode = mode;
    this.show();
  }

  /** Advance any sip, reveal or ripple; true while something is still moving. */
  update(now: number): boolean {
    let moving = false;
    if (this.level) {
      const { from, to, start, ms } = this.level;
      const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
      this.setLevel(from + (to - from) * ease(t));
      if (t < 1) moving = true;
      else {
        this.level = null;
        // A sip given no time (reduced motion) reveals the grounds at once too.
        if (this.empty) this.reveal = { start: now, ms: ms <= 0 ? 0 : DURATION.reveal };
      }
    }
    if (this.reveal) {
      const t = this.reveal.ms <= 0 ? 1 : Math.min(1, (now - this.reveal.start) / this.reveal.ms);
      this.revealed = t;
      if (t < 1) moving = true;
      else this.reveal = null;
    }
    if (this.rippleAt) {
      const t = (now - this.rippleAt.start) / DURATION.ripple;
      const m = this.ripple.material as MeshBasicMaterial;
      if (t >= 1) {
        this.rippleAt = null;
        m.opacity = 0;
      } else {
        this.ripple.scale.setScalar(6 + 40 * ease(t));
        m.opacity = 0.45 * (1 - t);
        moving = true;
      }
    }
    this.show();
    return moving;
  }

  private setLevel(h: number): void {
    this.coffee.position.y = h;
    const s = innerRadius(h) / innerRadius(COFFEE_HEIGHT);
    this.coffee.scale.set(s, s, 1);
    this.ripple.position.y = h + 0.4;
  }

  /** Visibility follows the sips: nothing at all shows before the first one. */
  private show(): void {
    const started = this.sips > 0;
    this.liner.visible = started;
    this.linerFloor.visible = started;
    this.rings.forEach((r, i) => (r.visible = this.sips > i));
    this.ripple.visible = !!this.rippleAt;
    const emptied = this.empty && !this.level;
    this.coffee.visible = !emptied;
    const pick = this.model.pickable;
    if (emptied && !pick.includes(this.floor)) pick.splice(pick.indexOf(this.coffee), 1, this.floor);
    for (const m of [this.floor, this.wall]) {
      m.visible = emptied;
      (m.material as MeshStandardMaterial).opacity = this.revealed;
    }
    const stampOpacity = this.stampMode === 'field' ? 0 : this.revealed;
    this.stamp.visible = emptied && stampOpacity > 0;
    (this.stamp.material as MeshStandardMaterial).opacity = stampOpacity;
  }

  dispose(): void {
    this.model.group.remove(this.group);
    this.disposables.forEach((d) => d.dispose());
  }
}
