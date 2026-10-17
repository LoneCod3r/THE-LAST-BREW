/**
 * The cup as three.js meshes, built from the traced profile (profile.ts): a lathe
 * for the bowl (split by material), a tube for the handle, a plain disc of coffee
 * with an empty layer above it reserved for the cipher, and an invisible ring at
 * the rim that makes the thin lip easy to click. No textures, no files.
 */
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshBasicMaterial,
  RingGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { COFFEE_HEIGHT, COLOURS, HANDLE, RIM_HEIGHT, WALL, coffeeRadius, cupProfile, handlePath, outerSurface, type ProfilePoint } from './profile';
import type { Part } from './views';

/** Artwork px → scene units: the cup is about 4.8 units across with its handle. */
export const SCALE = 0.01;
/** Layer for pick-only helpers: raycast, never drawn. */
export const PICK_LAYER = 1;
const LATHE_SEGMENTS = 96;

export interface CupModel {
  group: Group;
  /** Every mesh a click can land on; each has userData.part. */
  pickable: Mesh[];
  /** The pale lip, brightened very slightly on hover. */
  lipMaterial: MeshPhysicalMaterial;
  /** Empty, on the coffee's surface: where the cipher will be drawn later. */
  cipherLayer: Group;
  dispose: () => void;
}

function glaze(color: string, roughness: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    side: DoubleSide,
  });
}

/** Split the profile into runs of one part each; neighbouring runs share their boundary point. */
export function runs(profile: ProfilePoint[]): { part: ProfilePoint['part']; points: ProfilePoint[] }[] {
  const out: { part: ProfilePoint['part']; points: ProfilePoint[] }[] = [];
  let prev: ProfilePoint | null = null;
  for (const p of profile) {
    const last = out[out.length - 1];
    if (last && last.part === p.part) last.points.push(p);
    // A new run starts at the previous run's last point, so the surfaces meet without a gap.
    else out.push({ part: p.part, points: prev ? [prev, p] : [p] });
    prev = p;
  }
  return out;
}

export function buildCup(): CupModel {
  const group = new Group();
  group.name = 'cup';
  group.scale.setScalar(SCALE);
  const pickable: Mesh[] = [];
  const disposables: { dispose: () => void }[] = [];

  const materials = {
    body: glaze(COLOURS.glaze, 0.3),
    base: glaze(COLOURS.glazeDeep, 0.42),
    inner: glaze(COLOURS.glazeDeep, 0.34),
    lip: new MeshPhysicalMaterial({
      color: COLOURS.lip,
      roughness: 0.34,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      emissive: new Color(COLOURS.lip),
      emissiveIntensity: 0,
      side: DoubleSide,
    }),
  };
  disposables.push(...Object.values(materials));

  for (const run of runs(cupProfile())) {
    const geo = new LatheGeometry(
      run.points.map((p) => new Vector2(p.r, p.h)),
      LATHE_SEGMENTS,
    );
    const mesh = new Mesh(geo, materials[run.part]);
    mesh.name = run.part;
    mesh.userData.part = (run.part === 'lip' ? 'lip' : run.part) satisfies Part;
    group.add(mesh);
    pickable.push(mesh);
    disposables.push(geo);
  }

  // The handle: a tube along the traced loop, in the plane of the axis, on the +x side.
  const path = handlePath().map((p) => new Vector3(p.x, p.h, 0));
  const handleGeo = new TubeGeometry(new CatmullRomCurve3(path), 96, HANDLE.tube, 18, false);
  const handle = new Mesh(handleGeo, materials.body);
  handle.name = 'handle';
  handle.userData.part = 'handle' satisfies Part;
  group.add(handle);
  pickable.push(handle);
  disposables.push(handleGeo);

  // The coffee: plain, slightly lighter only at its very edge, as in the artwork.
  const r = coffeeRadius();
  const coffeeGeo = new RingGeometry(0.0001, r, 96, 10);
  const pos = coffeeGeo.getAttribute('position');
  const colours = new Float32Array(pos.count * 3);
  const centre = new Color(COLOURS.coffee);
  const edge = new Color(COLOURS.coffeeEdge);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 1) {
    const d = Math.hypot(pos.getX(i), pos.getY(i)) / r;
    const t = Math.min(1, Math.max(0, (d - 0.82) / 0.18)) ** 1.5;
    c.copy(centre).lerp(edge, t);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  coffeeGeo.setAttribute('color', new BufferAttribute(colours, 3));
  // No reflections at all: from some angles they read as a grey sheen or as marks, and the surface
  // must look the same, plain, from every view, ready for the cipher.
  const coffeeMat = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, specularIntensity: 0, envMapIntensity: 0 });
  const coffee = new Mesh(coffeeGeo, coffeeMat);
  coffee.name = 'coffee';
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = COFFEE_HEIGHT;
  coffee.userData.part = 'coffee' satisfies Part;
  group.add(coffee);
  pickable.push(coffee);
  disposables.push(coffeeGeo, coffeeMat);

  // Reserved for the cipher: sits just above the coffee, clipped to it later. Empty for now.
  const cipherLayer = new Group();
  cipherLayer.name = 'cipher';
  cipherLayer.position.y = COFFEE_HEIGHT + 0.3;
  cipherLayer.userData.radius = r;
  group.add(cipherLayer);

  // An invisible ring around the lip, a little wider than it, so the rim is easy to hit (also by touch).
  const rimGeo = new TorusGeometry(outerSurface(RIM_HEIGHT - 4) - WALL / 2, 15, 8, 72);
  const rimMat = new MeshBasicMaterial();
  const rim = new Mesh(rimGeo, rimMat);
  rim.name = 'rim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = RIM_HEIGHT - 3;
  rim.layers.set(PICK_LAYER);
  rim.userData.part = 'rim' satisfies Part;
  group.add(rim);
  pickable.push(rim);
  disposables.push(rimGeo, rimMat);

  return {
    group,
    pickable,
    lipMaterial: materials.lip,
    cipherLayer,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
