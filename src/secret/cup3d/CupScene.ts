/**
 * Renders the cup and turns pointer input into view changes. Frames are drawn only
 * while something moves (a transition, a drag, a resize), so an idle page costs
 * nothing; rendering also stops while the tab is hidden.
 */
import {
  AmbientLight,
  DirectionalLight,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FOV, placeCamera } from './camera';
import { PICK_LAYER, SCALE, buildCup, type CupModel } from './cupModel';
import { CLICK_SLOP_PX, ViewController, describe, intentFor, type Pose, type Part } from './views';
import { Grounds, STAMP, type StampMode } from './grounds';
import { RIM_HEIGHT, outerSurface } from './profile';

/** Hover brightening of the pale lip: barely there. */
const LIP_HOVER = 0.07;
/** Holding still on the coffee this long takes a sip. */
export const HOLD_MS = 600;
/** How far a press waiting to become a sip may drift and still count as held (CSS px). */
export const HOLD_SLOP_PX = { mouse: 16, touch: 24 } as const;

/** Where the base is on the canvas: its centre and radius, in CSS px from the canvas's top left. */
export interface BaseOnScreen {
  x: number;
  y: number;
  r: number;
}

export interface CupSceneOptions {
  reduced: boolean;
  /** A short description of the view, after each settled change (for a live region). */
  onView?: (text: string, pose: Pose) => void;
  /** Every drawn frame: the pose, and where the base is on the canvas. */
  onFrame?: (pose: Pose, base: BaseOnScreen) => void;
  /** The coffee was held still long enough to sip: where (cup coordinates), or null if pressed on the inside wall. */
  onHold?: (at: Vector3 | null) => void;
  /** A tap (no drag, no sip) on a part: true if it was taken, so the view stays where it is. */
  onTap?: (part: Part) => boolean;
  /** The WebGL context was lost: the page falls back to the picture. */
  onLost?: () => void;
}

export class CupScene {
  readonly controller: ViewController;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  private model: CupModel;
  private raycaster = new Raycaster();
  private frame = 0;
  private resize: ResizeObserver;
  private lastSaid = '';
  private hoverPart: Part | null = null;
  private drag: { id: number; x: number; y: number; moved: boolean; sipped: boolean; slop: number } | null = null;
  private hold = 0;
  readonly grounds: Grounds;
  private reduced: boolean;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: CupSceneOptions,
  ) {
    // Throws when WebGL is unavailable; the caller shows the picture instead.
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.95;
    room.dispose();
    pmrem.dispose();

    // The lamp travels with the camera: turning the view reads as turning the cup under one light.
    const key = new DirectionalLight(0xfff4ea, 1.7);
    key.position.set(-3.5, 4.5, 4);
    const fill = new DirectionalLight(0xdfe6ee, 0.55);
    fill.position.set(4, 0.5, 2);
    const back = new DirectionalLight(0xffffff, 0.8);
    back.position.set(1.5, 3, -5);
    this.camera.add(key, fill, back, new AmbientLight(0xffffff, 0.12));
    this.scene.add(this.camera);

    this.model = buildCup();
    this.scene.add(this.model.group);
    this.grounds = new Grounds(this.model);
    this.reduced = opts.reduced;
    this.raycaster.layers.enable(PICK_LAYER);

    this.controller = new ViewController(opts.reduced, performance.now());

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    this.fit();

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('contextmenu', this.onMenu);
    document.addEventListener('visibilitychange', this.invalidate);
    this.invalidate();
  }

  /** Model access for tests and, later, the cipher. */
  get cipherLayer() {
    return this.model.cipherLayer;
  }

  setReduced(reduced: boolean): void {
    this.controller.reduced = reduced;
    this.reduced = reduced;
    this.invalidate();
  }

  /** Take a sip (from a point on the coffee, or the middle). False if none can be taken now. */
  sip(at: Vector3 | null = null): boolean {
    const taken = this.grounds.sip(at, performance.now(), this.reduced);
    this.invalidate();
    return taken;
  }

  setStamp(mode: StampMode): void {
    this.grounds.setStamp(mode);
    this.invalidate();
  }

  /** Run a controller change and draw it. */
  act(fn: (c: ViewController, now: number) => void): void {
    fn(this.controller, performance.now());
    this.invalidate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.hold);
    this.resize.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('webglcontextlost', this.onLost);
    c.removeEventListener('contextmenu', this.onMenu);
    document.removeEventListener('visibilitychange', this.invalidate);
    this.grounds.dispose();
    this.model.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }

  private fit(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  /** Ask for a frame; frames keep coming only while the view is still changing. */
  readonly invalidate = (): void => {
    if (this.disposed || this.frame || document.hidden) return;
    this.frame = requestAnimationFrame(this.draw);
  };

  private draw = (): void => {
    this.frame = 0;
    const now = performance.now();
    const pose = this.controller.at(now);
    placeCamera(this.camera, pose);
    const moving = this.grounds.update(now);
    this.renderer.render(this.scene, this.camera);
    this.opts.onFrame?.(pose, this.base());
    if (this.controller.animating(now) || moving) this.invalidate();
    if (!this.controller.animating(now)) this.announce(pose);
  };

  private base(): BaseOnScreen {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    const at = (x: number, z: number) => {
      const p = this.model.group.localToWorld(new Vector3(x, STAMP.height, z)).project(this.camera);
      return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
    };
    const c = at(0, 0);
    const r = Math.max(...[at(STAMP.radius, 0), at(0, STAMP.radius)].map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
    return { x: c.x, y: c.y, r };
  }

  private announce(p: Pose): void {
    const text = describe(p);
    if (text !== this.lastSaid) {
      this.lastSaid = text;
      this.opts.onView?.(text, p);
    }
  }

  /** Which part of the cup is under a client point, how high on the cup (artwork px), and where. */
  pick(clientX: number, clientY: number): { part: Part; h: number; point: Vector3 } | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    placeCamera(this.camera, this.controller.at(performance.now()));
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.model.pickable, false)[0];
    if (!hit) return null;
    return { part: hit.object.userData.part as Part, h: hit.point.y / SCALE, point: hit.point };
  }

  private onDown = (e: PointerEvent): void => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const d = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, sipped: false, slop: CLICK_SLOP_PX };
    this.drag = d;
    this.canvas.focus({ preventScroll: true });
    // Held still on the cup's opening, a press becomes a sip; moving first makes it a drag, as before.
    clearTimeout(this.hold);
    const hit = this.grounds.empty ? null : this.pick(e.clientX, e.clientY);
    if (hit && hit.part !== 'handle' && this.intoMouth()) {
      // A resting finger, or a thumb pressing a trackpad, drifts a little: that is still holding.
      d.slop = e.pointerType === 'mouse' ? HOLD_SLOP_PX.mouse : HOLD_SLOP_PX.touch;
      const at = hit.part === 'coffee' ? this.model.group.worldToLocal(hit.point.clone()) : null;
      this.hold = window.setTimeout(() => {
        if (this.drag !== d || d.moved) return;
        d.sipped = true;
        this.opts.onHold?.(at);
      }, HOLD_MS);
    }
  };

  /**
   * Whether the ray just picked (see pick) goes into the cup through its mouth: seen from above the
   * rim, it crosses the rim's plane inside the rim. Whatever it then meets (the coffee, or once the
   * level has dropped the inside wall, or the rim itself) is the coffee being reached for.
   */
  private intoMouth(): boolean {
    const ray = this.raycaster.ray.clone().applyMatrix4(this.model.group.matrixWorld.clone().invert());
    if (ray.origin.y <= RIM_HEIGHT || ray.direction.y >= 0) return false;
    const t = (RIM_HEIGHT - ray.origin.y) / ray.direction.y;
    const p = ray.at(t, new Vector3());
    return Math.hypot(p.x, p.z) <= outerSurface(RIM_HEIGHT);
  }

  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (d && e.pointerId === d.id) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      // Once a sip is taken, the press is spent: it neither turns the cup nor clicks.
      if (d.sipped || (!d.moved && Math.hypot(dx, dy) < d.slop)) return;
      d.moved = true;
      clearTimeout(this.hold);
      d.x = e.clientX;
      d.y = e.clientY;
      this.canvas.dataset.cursor = 'grabbing';
      this.act((c, now) => c.drag(dx, dy, now));
      return;
    }
    if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    clearTimeout(this.hold);
    delete this.canvas.dataset.cursor;
    if (d.moved || d.sipped) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit || this.opts.onTap?.(hit.part)) return;
    const intent = intentFor(hit.part, hit.h, this.controller.inside);
    this.act((c, now) => (intent === 'turn' ? c.rimTurn(now) : intent === 'inside' ? c.goInside(now) : c.goOutside(now)));
    if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY);
  };

  private onCancel = (): void => {
    this.drag = null;
    clearTimeout(this.hold);
    delete this.canvas.dataset.cursor;
  };

  /** A long press on a touch screen opens no menu while it is turning or sipping. */
  private onMenu = (e: Event): void => {
    if (this.drag) e.preventDefault();
  };

  private onLeave = (): void => {
    if (!this.drag) this.setHover(null);
  };

  /** The cursor and a faint warming of the lip are the only hints. */
  private hover(x: number, y: number): void {
    const hit = this.pick(x, y);
    this.setHover(hit ? (intentFor(hit.part, hit.h, this.controller.inside) === 'turn' ? 'rim' : hit.part) : null);
  }

  private setHover(part: Part | null): void {
    if (part === this.hoverPart) return;
    this.hoverPart = part;
    const inside = this.controller.inside;
    this.canvas.dataset.hover = part === null ? '' : part === 'rim' ? 'rim' : part === 'coffee' && inside ? 'out' : 'in';
    this.model.lipMaterial.emissiveIntensity = part === 'rim' ? LIP_HOVER : 0;
    this.invalidate();
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.opts.onLost?.();
  };
}
