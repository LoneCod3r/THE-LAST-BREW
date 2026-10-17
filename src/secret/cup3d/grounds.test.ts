import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FOV, placeCamera } from './camera';
import { SCALE } from './cupModel';
import {
  CLOCK,
  FLOOR_HEIGHT,
  FLOOR_RADIUS,
  HANDLE_ROOTS,
  LEVELS,
  STAMP,
  TRAIL,
  WALL_BAND,
  WORD_BAND,
  flatDisc,
  handTip,
  innerRadius,
  linerRadius,
  markCentre,
  onFloor,
  rootSwell,
  stampFrame,
  toFloorCanvas,
  wallGeometry,
  wallUv,
} from './grounds';
import { COFFEE_HEIGHT, HANDLE, handlePath } from './profile';
import { EYE_PITCH, INSIDE_PITCH, UNDERSIDE_PITCH, ViewController, type Pose } from './views';
import { HANDS, MARKS } from '../reading/puzzle';

/** Where a point of the cup (artwork px) lands on screen for a pose: x right, y up, -1..1. */
function screen(pose: Pose, x: number, h: number, z: number): { x: number; y: number } {
  const camera = new PerspectiveCamera(FOV, 1.1, 0.1, 100);
  placeCamera(camera, pose);
  camera.updateProjectionMatrix();
  const p = new Vector3(x * SCALE, h * SCALE, z * SCALE).project(camera);
  return { x: p.x * 1.1, y: p.y };
}

/** Clockwise angle on screen from straight up, around a centre, in degrees 0..360. */
function clockwiseFromUp(c: { x: number; y: number }, p: { x: number; y: number }): number {
  return (((Math.atan2(p.x - c.x, p.y - c.y) * 180) / Math.PI) % 360 + 360) % 360;
}

/** A point drawn on a disc's texture (canvas px, as drawn) → where it is on the cup. */
function canvasToCup(mesh: Mesh, radius: number, size: number, cx: number, cy: number): Vector3 {
  // Canvas textures are flipped on upload: canvas row 0 is the top of the texture (v = 1).
  const u = cx / size;
  const v = 1 - cy / size;
  mesh.updateMatrix();
  return new Vector3((2 * u - 1) * radius, (2 * v - 1) * radius, 0).applyMatrix4(mesh.matrix);
}

const angleDiff = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

describe('the grounds: layout', () => {
  it('the handle is on +x, and the twelve mark lies straight under it', () => {
    expect(HANDLE.x).toBeGreaterThan(0);
    const twelve = markCentre(0);
    expect(twelve.x).toBeGreaterThan(0);
    expect(twelve.z).toBeCloseTo(0, 9);
  });

  it('the trail runs in from the foot of the wall under the handle and ends exactly at the centre of the twelve mark', () => {
    expect(TRAIL.from).toEqual(onFloor(0, FLOOR_RADIUS));
    expect(TRAIL.to).toEqual(markCentre(0));
    // On the wall, the drip falls at the same direction: the middle of the wall's band.
    expect(wallUv(0, FLOOR_HEIGHT)).toEqual({ u: 0.5, v: 0 });
    // It is long enough to follow on a phone: from the edge to the mark is a fifth of the floor's radius, plus the whole wall.
    expect(FLOOR_RADIUS - CLOCK.ring).toBeGreaterThan(FLOOR_RADIUS * 0.18);
  });

  it('the clock fits the floor; the hands stop short of the marks, so only the trail reaches one', () => {
    expect(CLOCK.ring + CLOCK.mark * 1.35).toBeLessThan(FLOOR_RADIUS);
    for (const hand of ['hour', 'minute'] as const) {
      expect(CLOCK[hand].length + CLOCK[hand].width / 2).toBeLessThan(CLOCK.ring - CLOCK.mark * 1.35);
    }
    expect(CLOCK.hour.length).toBeLessThan(CLOCK.minute.length * 0.7);
    expect(CLOCK.hour.width).toBeGreaterThan(CLOCK.minute.width * 2);
  });

  it('the grounds and liner sit inside the cup, above its own inside bottom, below the coffee line', () => {
    expect(FLOOR_RADIUS).toBeLessThan(innerRadius(FLOOR_HEIGHT));
    expect(FLOOR_HEIGHT).toBeGreaterThan(20);
    expect(LEVELS[0]).toBe(COFFEE_HEIGHT);
    expect(WORD_BAND.top).toBeLessThan(COFFEE_HEIGHT);
    expect(WORD_BAND.bottom).toBeGreaterThan(LEVELS[1]);
    expect(WALL_BAND.top).toBeLessThan(COFFEE_HEIGHT);
  });

  it('the liner covers the ends of the handle where they reach through the wall, and is plain everywhere else', () => {
    expect(HANDLE_ROOTS).toHaveLength(2);
    const path = handlePath();
    for (const end of [path[0], path[path.length - 1]]) {
      // The open end of the tube: a circle of the tube's radius around the end of its centreline.
      for (let dh = -HANDLE.tube; dh <= HANDLE.tube; dh += 2) {
        for (let ds = -HANDLE.tube; ds <= HANDLE.tube; ds += 2) {
          if (Math.hypot(dh, ds) > HANDLE.tube) continue;
          const deg = (ds / innerRadius(end.h + dh)) * (180 / Math.PI);
          expect(linerRadius(deg, end.h + dh)).toBeLessThan(end.x - HANDLE.tube);
        }
      }
    }
    for (const [deg, h] of [[40, 124], [-40, 202], [180, 124], [0, 60], [0, 160]]) expect(rootSwell(deg, h)).toBe(0);
    expect(rootSwell(0, COFFEE_HEIGHT - 2)).toBe(0);
  });

  it('the floor texture lands where it is drawn (the CircleGeometry mapping)', () => {
    const disc = flatDisc(FLOOR_RADIUS, FLOOR_HEIGHT, 'up');
    for (const p of [markCentre(0), markCentre(3), handTip('hour'), handTip('minute'), TRAIL.from]) {
      const { cx, cy } = toFloorCanvas(p, 1024);
      const at = canvasToCup(disc, FLOOR_RADIUS, 1024, cx, cy);
      expect(at.x).toBeCloseTo(p.x, 6);
      expect(at.z).toBeCloseTo(p.z, 6);
      expect(at.y).toBeCloseTo(FLOOR_HEIGHT, 6);
    }
  });

  it('the wall band carries its texture left to right with the direction, and up with the height', () => {
    const g = wallGeometry(4, 4);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i += 1) {
      const deg = (Math.atan2(pos.getZ(i), pos.getX(i)) * 180) / Math.PI;
      const t = wallUv(deg, pos.getY(i));
      expect(uv.getX(i)).toBeCloseTo(t.u, 6);
      expect(uv.getY(i)).toBeCloseTo(t.v, 6);
    }
  });
});

describe('the grounds: as the player sees them', () => {
  it('looking in, at any turn of the cup, the hands stand 120° and 220° clockwise from the twelve mark', () => {
    for (const yaw of [0, 37, 90, 180, 270, -45, 270 + 360 * 3]) {
      const pose = { yaw, pitch: INSIDE_PITCH, depth: 1 };
      const c = screen(pose, 0, FLOOR_HEIGHT, 0);
      const at = (p: { x: number; z: number }) => clockwiseFromUp(c, screen(pose, p.x, FLOOR_HEIGHT, p.z));
      const twelve = at(markCentre(0));
      for (let k = 0; k < MARKS; k += 1) expect(angleDiff(at(markCentre(k)) - twelve, k * 30)).toBeLessThan(1.5);
      expect(angleDiff(at(handTip('minute')) - twelve, HANDS.minute)).toBeLessThan(1.5);
      expect(angleDiff(at(handTip('hour')) - twelve, HANDS.hour)).toBeLessThan(1.5);
    }
  });

  it('looking in from where the word is read (handle behind), the clock stands upright: twelve at the top', () => {
    const pose = { yaw: 270, pitch: INSIDE_PITCH, depth: 1 };
    const c = screen(pose, 0, FLOOR_HEIGHT, 0);
    const twelve = markCentre(0);
    expect(angleDiff(clockwiseFromUp(c, screen(pose, twelve.x, FLOOR_HEIGHT, twelve.z)), 0)).toBeLessThan(1.5);
  });

  it('across the opening, with the handle behind, the word reads left to right, upright, its hidden letter in the middle', () => {
    const pose = { yaw: 270, pitch: EYE_PITCH, depth: 0 };
    const h = (WORD_BAND.bottom + WORD_BAND.top) / 2;
    const wall = (deg: number, height = h) => {
      const p = onFloor(deg, innerRadius(height));
      return screen(pose, p.x, height, p.z);
    };
    expect(wall(-20).x).toBeLessThan(wall(0).x);
    expect(wall(0).x).toBeLessThan(wall(20).x);
    expect(Math.abs(wall(0).x)).toBeLessThan(0.01);
    expect(wall(0, WORD_BAND.top).y).toBeGreaterThan(wall(0, WORD_BAND.bottom).y);
    // And the near rim does not hide it: the rim's top edge is below the word's bottom on screen.
    const rim = onFloor(180, innerRadius(COFFEE_HEIGHT));
    expect(screen(pose, rim.x, 237, rim.z).y).toBeLessThan(wall(0, WORD_BAND.bottom).y);
  });

  it('the stamp reads upright from below, where the rim steps turn the cup over', () => {
    const c = new ViewController(true, 0);
    for (let i = 0; i < 4; i += 1) c.rimTurn(0);
    const pose = c.at(0);
    expect(pose.pitch).toBe(UNDERSIDE_PITCH);
    expect(((pose.yaw % 360) + 360) % 360).toBe(STAMP.upright);
    const size = 512;
    const [a, b, cc, d, e, f] = stampFrame(size);
    const disc = flatDisc(STAMP.radius, STAMP.height, 'down');
    const fromText = (tx: number, ty: number) => canvasToCup(disc, STAMP.radius, size, a * tx + cc * ty + e, b * tx + d * ty + f);
    const look = (v: Vector3) => screen(pose, v.x, v.y, v.z);
    const centre = look(fromText(0, 0));
    const right = look(fromText(20, 0));
    const up = look(fromText(0, -20));
    expect(right.x - centre.x).toBeGreaterThan(Math.abs(right.y - centre.y) * 5); // text's right is screen right
    expect(up.y - centre.y).toBeGreaterThan(Math.abs(up.x - centre.x) * 5); // text's up is screen up
  });
});
