/** Where the camera stands for a pose (see views.ts). Shared by the scene and the tests. */
import { PerspectiveCamera, Vector3 } from 'three';
import { SCALE } from './cupModel';
import { COFFEE_HEIGHT } from './profile';
import type { Pose } from './views';

/** A long lens, as in the artwork's photograph: little perspective. */
export const FOV = 20;
/** Outside: the whole cup, handle included, at any turn. Inside: the rim just fills the view. */
export const DIST_OUT = 15.5;
export const DIST_IN = 12;
/** What the camera looks at: the middle of the bowl outside, the coffee inside. */
export const TARGET_OUT = 1.18;
export const TARGET_IN = COFFEE_HEIGHT * SCALE;

export function placeCamera(camera: PerspectiveCamera, p: Pose): void {
  const dist = DIST_OUT + (DIST_IN - DIST_OUT) * p.depth;
  const target = new Vector3(0, TARGET_OUT + (TARGET_IN - TARGET_OUT) * p.depth, 0);
  const yaw = (p.yaw * Math.PI) / 180;
  const pitch = (p.pitch * Math.PI) / 180;
  camera.position.set(
    target.x + dist * Math.cos(pitch) * Math.sin(yaw),
    target.y + dist * Math.sin(pitch),
    target.z + dist * Math.cos(pitch) * Math.cos(yaw),
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
