import { PerspectiveCamera, Raycaster, Vector2, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { FOV, placeCamera } from './camera';
import { PICK_LAYER, SCALE, buildCup, runs } from './cupModel';
import { COFFEE_HEIGHT, cupProfile } from './profile';
import { EYE_PITCH, INITIAL, INSIDE_PITCH, UNDERSIDE_PITCH, type Part, type Pose } from './views';

const model = buildCup();
model.group.updateMatrixWorld(true);

/** Cast a ray from the camera of `pose` through a point of the view (-1..1) and name the part it meets. */
function look(pose: Pose, x = 0, y = 0): { part: Part; h: number } | null {
  const camera = new PerspectiveCamera(FOV, 1.1, 0.1, 100);
  placeCamera(camera, pose);
  camera.updateProjectionMatrix();
  const ray = new Raycaster();
  ray.layers.enable(PICK_LAYER);
  ray.setFromCamera(new Vector2(x, y), camera);
  const hit = ray.intersectObjects(model.pickable, false)[0];
  return hit ? { part: hit.object.userData.part as Part, h: hit.point.y / SCALE } : null;
}

describe('the 3D cup', () => {
  it('is built from the traced profile: one lathe per material, the handle, the coffee and a pick ring', () => {
    const names = model.pickable.map((m) => m.name).sort();
    expect(names).toEqual(['base', 'body', 'coffee', 'handle', 'inner', 'lip', 'rim'].sort());
    expect(runs(cupProfile()).map((r) => r.part)).toEqual(['base', 'body', 'lip', 'inner']);
    const rim = model.pickable.find((m) => m.name === 'rim') as Mesh;
    expect(rim.layers.isEnabled(0)).toBe(false);
  });

  it('is light enough for a phone', () => {
    const triangles = model.pickable
      .filter((m) => m.name !== 'rim')
      .reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
    expect(triangles).toBeLessThan(40000);
  });

  it('the coffee surface is plain and its cipher layer is reserved and empty', () => {
    expect(model.cipherLayer.children).toHaveLength(0);
    expect(model.cipherLayer.position.y).toBeGreaterThan(COFFEE_HEIGHT);
    expect(model.cipherLayer.userData.radius).toBeGreaterThan(150);
  });

  it('from the first view, the middle of the opening is coffee and the middle of the bowl is the body', () => {
    // The coffee shows through the opening near the top of the cup, as in the artwork.
    const coffee = [0.36, 0.38, 0.4, 0.42].map((y) => look(INITIAL, 0, y)?.part);
    expect(coffee).toContain('coffee');
    expect(look(INITIAL, 0, -0.1)?.part).toBe('body');
    expect(look(INITIAL, 0.95, 0.9)).toBeNull();
  });

  it('looking inside, the camera genuinely sees the interior: coffee in the middle, the pale lip and rim at the edge', () => {
    const inside = { yaw: 0, pitch: INSIDE_PITCH, depth: 1 };
    // (Just off the exact centre, where the disc's triangles meet in a point.)
    expect(look(inside, 0.01, 0.01)).toMatchObject({ part: 'coffee' });
    expect(look(inside, 0.3, 0.3)?.part).toBe('coffee');
    // Toward the edge of the view the ray meets the rim, not the outside of the bowl.
    const edge = [0.7, 0.75, 0.8, 0.85].map((x) => look(inside, -x, 0)?.part);
    expect(edge.some((p) => p === 'rim' || p === 'lip')).toBe(true);
    expect(edge).not.toContain('base');
  });

  it('from below, the middle is the underside; turned, the handle comes toward the viewer', () => {
    expect(look({ yaw: 0, pitch: UNDERSIDE_PITCH, depth: 0 }, 0, 0)?.part).toBe('base');
    const towardYou = look({ yaw: 90, pitch: EYE_PITCH, depth: 0 }, 0, 0.0);
    expect(towardYou?.part).toBe('handle');
  });
});
