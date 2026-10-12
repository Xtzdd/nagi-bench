// Playback engine: owns the renderer, the sets, the camera choreography and
// the clock. React only reads state out of it.

import * as THREE from 'three';
import { DURATION, shotAt, type Shot } from './shots';
import { SetResult } from './sets';
import * as SETS from './sets';
import { AudioEngine, SFX_CUES, AMBIENCE_BY_SET } from './audio';

const BUILDERS: Record<string, () => SetResult> = {
  titles: SETS.buildTitles,
  orbit: SETS.buildOrbit,
  chamber: SETS.buildChamber,
  quarters: SETS.buildQuarters,
  workshop: SETS.buildWorkshop,
  bay: SETS.buildBay,
  pod: SETS.buildPod,
  theshot: SETS.buildTheShot,
  aftermath: SETS.buildAftermath,
  credits: SETS.buildCredits
};

const smooth = (x: number) => x * x * (3 - 2 * x);

export class FilmEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  audio = new AudioEngine();

  private cache = new Map<string, SetResult>();
  private holder = new THREE.Group();
  private clock = new THREE.Clock();
  private raf = 0;
  private prevT = 0;
  private currentSetId = '';
  private currentShotId = '';

  time = 0;
  playing = false;
  onTick: ((t: number, shot: Shot) => void) | null = null;
  private disposers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.add(this.holder);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 3000);

    this.onResize();
    const onR = () => this.onResize();
    window.addEventListener('resize', onR);
    this.disposers.push(() => window.removeEventListener('resize', onR));
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private ensureSet(id: string): SetResult | null {
    if (this.cache.has(id)) return this.cache.get(id)!;
    const b = BUILDERS[id];
    if (!b) return null;
    const s = b();
    s.group.visible = false;
    this.holder.add(s.group);
    this.cache.set(id, s);
    return s;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.clock.getDelta();
    this.audio.unlock();
    this.loop();
  }

  pause() { this.playing = false; cancelAnimationFrame(this.raf); }

  seek(t: number) {
    this.time = Math.max(0, Math.min(DURATION, t));
    this.prevT = this.time;
    this.audio.resetFired();
    this.applyFrame(0, true);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  private loop = () => {
    if (!this.playing) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.time >= DURATION) { this.pause(); return; }
    this.time = Math.min(DURATION, this.time + dt);
    this.applyFrame(dt, false);
  };

  private applyFrame(dt: number, seeked: boolean) {
    const t = this.time;
    const shot = shotAt(t);
    const local = t - shot.start;

    if (this.currentShotId !== shot.id) {
      this.currentShotId = shot.id;
      this.currentSetId = '';
    }
    if (this.currentSetId !== shot.set) {
      for (const [k, v] of this.cache) v.group.visible = (k === shot.set);
      this.currentSetId = shot.set;
    }
    const set = this.ensureSet(shot.set);
    if (set) {
      set.group.visible = true;
      set.update?.(t, local, dt);
    }

    this.applyCamera(shot, t);

    // audio: ambience per set, one-shot cues by time window
    if (this.audio.enabled && !seeked) {
      this.audio.setAmbienceIfNeeded(AMBIENCE_BY_SET[shot.set] ?? 'none');
      this.audio.pump(SFX_CUES, this.prevT, t);
    }
    this.prevT = t;

    this.renderer.render(this.scene, this.camera);
    this.onTick?.(t, shot);
  }

  private applyCamera(shot: Shot, t: number) {
    const keys = shot.keys;
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
      if (t > keys[keys.length - 1].t) { a = b = keys[keys.length - 1]; }
      if (t < keys[0].t) { a = b = keys[0]; }
    }
    const span = b.t - a.t;
    const raw = span <= 0 ? 1 : (t - a.t) / span;
    const k = smooth(Math.max(0, Math.min(1, raw)));
    this.camera.position.set(
      a.p[0] + (b.p[0] - a.p[0]) * k,
      a.p[1] + (b.p[1] - a.p[1]) * k,
      a.p[2] + (b.p[2] - a.p[2]) * k
    );
    const lx = a.l[0] + (b.l[0] - a.l[0]) * k;
    const ly = a.l[1] + (b.l[1] - a.l[1]) * k;
    const lz = a.l[2] + (b.l[2] - a.l[2]) * k;
    this.camera.lookAt(lx, ly, lz);
    const fov = (a.fov ?? 48) + ((b.fov ?? a.fov ?? 48) - (a.fov ?? 48)) * k;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Render one frame without advancing (used before the first play). */
  renderStill() { this.applyFrame(0, true); }

  dispose() {
    this.pause();
    this.audio.ctx?.close();
    this.disposers.forEach(d => d());
    this.renderer.dispose();
  }
}
