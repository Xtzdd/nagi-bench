// Game engine: simulation, rendering and the React <-> loop bridge.
//
// The simulation owns plain data (Actor records). React only reads a snapshot
// published at a fixed cadence, so the render loop never waits on a re-render.

import * as THREE from 'three';
import {
  WEAPONS, TEAM_COLOR, TUNE, HITBOX_MULT, PRIMARY_ORDER, SECONDARY_ORDER,
  type Team, type WeaponDef, type HitboxName, type KillFeedItem
} from './core';
import {
  buildMapGeometry, blockedCell, isCrateCell, moveWithCollision, losClear,
  inSite, SITES, SPAWNS, WAYPOINTS, WALL_H, CRATE_H, GRID
} from './map';
import { findPath, clearLine } from './nav';
import { GameAudio, WEAPON_SFX, type Sfx } from './audio';

export type RoundState = 'freeze' | 'live' | 'over';
export type BotState = 'advance' | 'engage' | 'plant' | 'defuse' | 'hold' | 'dead';

export interface Actor {
  id: number; name: string; team: Team; isHuman: boolean; controlled: boolean;
  alive: boolean; hp: number; armor: number; helmet: boolean;
  x: number; y: number; z: number; vy: number;
  yaw: number; pitch: number; onGround: boolean;
  primary: string | null; secondary: string;
  slot: 'primary' | 'secondary' | 'melee';
  mags: Record<string, number>; reserves: Record<string, number>;
  nextFire: number; reloadingUntil: number;
  spreadHeat: number; recoil: number;
  kills: number; deaths: number;
  hasBomb: boolean;
  plantingUntil: number; defusingUntil: number;
  scoped: boolean;
  // bot only
  state: BotState; goal: { x: number; z: number } | null; goalName: string | null;
  path: Array<{ x: number; z: number }>; pathIdx: number; repathAt: number;
  target: Actor | null; lastSeenAt: number; strafe: number; thinkAt: number;
  footTimer: number; fireHold: number;
  root: THREE.Group; rig: any; viewVisible: boolean;
}

export interface BombState {
  planted: boolean;
  site: 'A' | 'B' | null;
  x: number; z: number;
  plantedAt: number;
  defusedAt: number;
  carrier: number | null;
}

export interface Snapshot {
  round: number; state: RoundState; timeLeft: number; freezeLeft: number;
  scoreT: number; scoreCT: number;
  hp: number; armor: number; helmet: boolean;
  weapon: string; weaponName: string; mag: number; reserve: number;
  slot: string; reloading: boolean; scoped: boolean;
  bomb: { planted: boolean; site: string | null; left: number; carrying: boolean;
          planting: number; defusing: number };
  killfeed: KillFeedItem[];
  actors: Array<{ name: string; team: Team; alive: boolean; hp: number; kills: number; deaths: number; controlled: boolean }>;
  banner: string | null;
  pistolRound: boolean;
  spectating: string | null;
  crosshairSpread: number;
  hitFlash: number;
  deadCount: { T: number; CT: number };
}

const BOT_NAMES_T = ['Kaze', 'Ryu', 'Oni', 'Hao', 'Zhen'];
const BOT_NAMES_CT = ['Vex', 'Nord', 'Iris', 'Kite', 'Lark'];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ============================================================
   Character construction — distinct head / torso / two arms / two legs
   ============================================================ */
interface Rig {
  root: THREE.Group;
  head: THREE.Group; torso: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; foreL: THREE.Group; foreR: THREE.Group;
  legL: THREE.Group; legR: THREE.Group;
  hand: THREE.Group;
  weaponGroup: THREE.Group;
}

function buildRig(team: Team): Rig {
  const root = new THREE.Group();
  const cloth = team === 'T' ? 0x8a6a42 : 0x46536b;
  const clothDark = team === 'T' ? 0x5d452a : 0x2f3849;
  const skin = 0xc79a6a;
  const mCloth = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.85 });
  const mDark = new THREE.MeshStandardMaterial({ color: clothDark, roughness: 0.85 });
  const mSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const mGear = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.7, metalness: 0.2 });

  const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    return mesh;
  };

  // pelvis
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);
  hips.add(box(0.44, 0.2, 0.26, mDark));

  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  torso.add(box(0.52, 0.6, 0.28, mCloth, 0, 0.3, 0));
  torso.add(box(0.56, 0.12, 0.3, mGear, 0, 0.56, 0));        // vest collar
  torso.add(box(0.5, 0.16, 0.1, mGear, 0, 0.3, 0.16));       // chest rig
  torso.add(box(0.14, 0.14, 0.28, mCloth, -0.32, 0.5, 0));   // shoulders
  torso.add(box(0.14, 0.14, 0.28, mCloth, 0.32, 0.5, 0));

  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);
  head.add(box(0.26, 0.26, 0.24, mSkin, 0, 0.13, 0));
  head.add(box(0.28, 0.09, 0.26, mDark, 0, 0.28, 0));        // hair / cap
  head.add(box(0.26, 0.12, 0.06, mDark, 0, 0.16, -0.11));
  if (team === 'CT') head.add(box(0.3, 0.16, 0.28, mGear, 0, 0.31, 0));   // helmet
  if (team === 'T') head.add(box(0.3, 0.08, 0.28, mGear, 0, 0.29, 0.02)); // bandana

  const mkArm = (side: number) => {
    const upper = new THREE.Group();
    upper.position.set(side * 0.32, 0.5, 0);
    torso.add(upper);
    upper.add(box(0.13, 0.3, 0.14, mCloth, 0, -0.15, 0));
    const fore = new THREE.Group();
    fore.position.y = -0.3;
    upper.add(fore);
    fore.add(box(0.12, 0.28, 0.13, mCloth, 0, -0.14, 0));
    fore.add(box(0.12, 0.09, 0.13, mSkin, 0, -0.32, 0));
    return { upper, fore };
  };
  const aL = mkArm(-1), aR = mkArm(1);

  const mkLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, -0.06, 0);
    hips.add(leg);
    leg.add(box(0.17, 0.4, 0.18, mDark, 0, -0.2, 0));
    leg.add(box(0.18, 0.34, 0.19, mCloth, 0, -0.56, 0));
    leg.add(box(0.19, 0.09, 0.26, mGear, 0, -0.76, 0.03));
    return leg;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // weapon anchor held in front of the torso
  const hand = new THREE.Group();
  hand.position.set(0.26, 0.34, 0.24);
  torso.add(hand);
  const weaponGroup = new THREE.Group();
  hand.add(weaponGroup);

  return {
    root, head, torso, armL: aL.upper, armR: aR.upper, foreL: aL.fore, foreR: aR.fore,
    legL, legR, hand, weaponGroup
  };
}

/** Third-person weapon built from the definition's model numbers. */
function buildWeaponMesh(def: WeaponDef): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: def.model.color, roughness: 0.55, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: def.model.accent, roughness: 0.4, metalness: 0.6 });
  const m = def.model;
  const add = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    g.add(mesh);
  };
  add(m.bodyW, m.bodyH, m.bodyLen, body, 0, 0, 0);
  add(m.barrelR * 2, m.barrelR * 2, m.barrelLen, accent, 0, 0.01, m.bodyLen / 2 + m.barrelLen / 2);
  add(m.bodyW * 0.9, m.bodyH * 0.9, m.stockLen, body, 0, -0.01, -m.bodyLen / 2 - m.stockLen / 2);
  if (m.magLen > 0) add(m.bodyW * 0.8, m.magLen, m.bodyW * 0.9, accent, 0, -m.magLen / 2 - 0.02, 0.04);
  add(m.bodyW * 0.5, 0.05, 0.06, accent, 0, m.bodyH / 2 + 0.02, -0.02);
  return g;
}

/* ============================================================
   Ray helpers
   ============================================================ */
function rayAABB(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number, hx: number, hy: number, hz: number
): number | null {
  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = i === 0 ? ox : i === 1 ? oy : oz;
    const d = i === 0 ? dx : i === 1 ? dy : dz;
    const c = i === 0 ? cx : i === 1 ? cy : cz;
    const h = i === 0 ? hx : i === 1 ? hy : hz;
    if (Math.abs(d) < 1e-8) { if (o < c - h || o > c + h) return null; continue; }
    const t1 = (c - h - o) / d, t2 = (c + h - o) / d;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  if (tmax < 0 || tmin > tmax) return null;
  return tmin >= 0 ? tmin : tmax;
}

/** Distance to the first map surface along a ray, or Infinity. */
function rayWall(
  ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxD: number
): number {
  let cx = Math.floor(ox), cz = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tdZ = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tmX = dx === 0 ? Infinity : ((dx > 0 ? (cx + 1 - ox) : (ox - cx)) || 1e-9) * tdX;
  let tmZ = dz === 0 ? Infinity : ((dz > 0 ? (cz + 1 - oz) : (oz - cz)) || 1e-9) * tdZ;
  // floor
  if (dy < 0) { const tf = -oy / dy; if (tf > 0 && tf < maxD) return tf; }
  let travelled = 0;
  for (let guard = 0; guard < 256; guard++) {
    const t = Math.min(tmX, tmZ);
    if (t > maxD) break;
    if (tmX < tmZ) { cx += stepX; tmX += tdX; travelled = tmX - tdX; }
    else { cz += stepZ; tmZ += tdZ; travelled = tmZ - tdZ; }
    if (blockedCell(cx, cz)) {
      const y = oy + dy * travelled;
      const h = isCrateCell(cx, cz) ? CRATE_H : WALL_H;
      if (y <= h) return travelled;
    }
  }
  return Infinity;
}

function hitboxesOf(a: Actor): Array<{ name: HitboxName; c: [number, number, number]; h: [number, number, number] }> {
  const y = a.y;
  const s = Math.sin(a.yaw), c = Math.cos(a.yaw);
  const off = (fx: number, fz: number): [number, number] => [a.x + fx * c + fz * s, a.z - fx * s + fz * c];
  const [hx, hz] = off(0, 0);
  return [
    { name: 'head', c: [hx, y + 1.62, hz], h: [0.15, 0.15, 0.15] },
    { name: 'chest', c: [hx, y + 1.24, hz], h: [0.26, 0.22, 0.16] },
    { name: 'stomach', c: [hx, y + 0.98, hz], h: [0.23, 0.15, 0.15] },
    { name: 'arm', c: [off(-0.32, 0.02)[0], y + 1.2, off(-0.32, 0.02)[1]], h: [0.09, 0.22, 0.1] },
    { name: 'arm', c: [off(0.32, 0.02)[0], y + 1.2, off(0.32, 0.02)[1]], h: [0.09, 0.22, 0.1] },
    { name: 'leg', c: [off(-0.13, 0)[0], y + 0.45, off(-0.13, 0)[1]], h: [0.1, 0.42, 0.11] },
    { name: 'leg', c: [off(0.13, 0)[0], y + 0.45, off(0.13, 0)[1]], h: [0.1, 0.42, 0.11] }
  ];
}

/* ============================================================
   Game
   ============================================================ */
export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  viewScene = new THREE.Scene();
  viewCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 12);
  audio = new GameAudio();

  actors: Actor[] = [];
  bomb: BombState = { planted: false, site: null, x: 0, z: 0, plantedAt: 0, defusedAt: 0, carrier: null };
  round = 1;
  roundState: RoundState = 'freeze';
  roundClock = 0;
  scoreT = 0; scoreCT = 0;
  killfeed: KillFeedItem[] = [];
  banner: string | null = null;
  bannerUntil = 0;
  pistolRound = true;
  hitFlashUntil = 0;
  bombBeepAt = 0;

  keys: Record<string, boolean> = {};
  mouseLocked = false;
  private clock = new THREE.Clock();
  private raf = 0;
  private kfId = 1;
  onSnapshot: ((s: Snapshot) => void) | null = null;
  private blockedInput = false;

  private viewGroup = new THREE.Group();
  private viewWeapon: THREE.Group | null = null;
  private viewWeaponId = '';
  private lastWeaponId = '';
  private baseFov = 78;
  private camShake = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.1, 400);
    this.scene.background = new THREE.Color(0x9fb4c4);
    this.scene.fog = new THREE.Fog(0x9fb4c4, 70, 210);

    // lights
    const sun = new THREE.DirectionalLight(0xfff1d8, 2.1);
    sun.position.set(40, 70, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 200;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ee, 0x6b5a44, 0.85));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    this.scene.add(buildMapGeometry());

    // bomb mesh
    const bombMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.4 });
    const bombGroup = new THREE.Group();
    bombGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.36), bombMat));
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), ledMat);
    led.position.set(0, 0.14, 0);
    bombGroup.add(led);
    bombGroup.visible = false;
    this.scene.add(bombGroup);
    (this as any).bombGroup = bombGroup;
    (this as any).bombLed = ledMat;

    // viewmodel scene
    this.viewScene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const vKey = new THREE.DirectionalLight(0xfff0d8, 1.8);
    vKey.position.set(1.2, 1.6, 2.2);
    this.viewScene.add(vKey);
    const vRim = new THREE.DirectionalLight(0x88aaff, 0.7);
    vRim.position.set(-1.5, 0.4, -1.2);
    this.viewScene.add(vRim);
    this.viewScene.add(this.viewGroup);

    this.setupActors();
    this.startRound(1);
    this.bindInput();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  get me(): Actor { return this.actors.find(a => a.controlled)!; }

  /* ---------------- actors & rounds ---------------- */
  private setupActors() {
    let id = 0;
    const mk = (team: Team, isHuman: boolean, name: string): Actor => {
      const rig = buildRig(team);
      this.scene.add(rig.root);
      const a: Actor = {
        id: id++, name, team, isHuman, controlled: false,
        alive: true, hp: 100, armor: 0, helmet: false,
        x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, onGround: true,
        primary: null, secondary: team === 'T' ? 'glock' : 'usp',
        slot: 'secondary', mags: {}, reserves: {},
        nextFire: 0, reloadingUntil: 0, spreadHeat: 0, recoil: 0,
        kills: 0, deaths: 0, hasBomb: false,
        plantingUntil: 0, defusingUntil: 0, scoped: false,
        state: 'advance', goal: null, goalName: null,
        path: [], pathIdx: 0, repathAt: 0, target: null, lastSeenAt: 0,
        strafe: 1, thinkAt: 0, footTimer: 0, fireHold: 0,
        root: rig.root, rig, viewVisible: true
      };
      for (const w of Object.keys(WEAPONS)) {
        a.mags[w] = WEAPONS[w].mag;
        a.reserves[w] = WEAPONS[w].reserve;
      }
      return a;
    };

    const human = mk('T', true, 'You');
    human.controlled = true;
    this.actors.push(human);
    for (let i = 0; i < TUNE.botCount; i++) this.actors.push(mk('T', false, BOT_NAMES_T[i]));
    // CT side: 5 enemies
    for (let i = 0; i < TUNE.enemyCount; i++) this.actors.push(mk('CT', false, BOT_NAMES_CT[i]));
  }

  startRound(n: number) {
    this.round = n;
    this.roundState = 'freeze';
    this.roundClock = TUNE.freezeTime;
    this.bomb = { planted: false, site: null, x: 0, z: 0, plantedAt: 0, defusedAt: 0, carrier: null };
    (this as any).bombGroup.visible = false;

    const pistol = this.pistolRound;
    let ti = 0, ci = 0;
    for (const a of this.actors) {
      a.alive = true; a.hp = 100;
      a.armor = pistol ? 0 : 100;
      a.helmet = pistol ? false : true;
      a.vy = 0; a.plantingUntil = 0; a.defusingUntil = 0; a.scoped = false;
      a.state = 'advance'; a.target = null; a.path = []; a.pathIdx = 0;
      a.reloadingUntil = 0; a.spreadHeat = 0; a.recoil = 0; a.nextFire = 0;
      a.hasBomb = false;
      a.slot = 'secondary';
      for (const w of Object.keys(WEAPONS)) { a.mags[w] = WEAPONS[w].mag; a.reserves[w] = WEAPONS[w].reserve; }

      if (pistol) {
        a.primary = null;
        a.secondary = a.team === 'T' ? 'glock' : 'usp';
      } else {
        if (!a.isHuman) {
          const roll = Math.random();
          a.primary = a.team === 'T'
            ? (roll < 0.55 ? 'ak47' : roll < 0.85 ? 'm4a4' : 'awp')
            : (roll < 0.55 ? 'm4a4' : roll < 0.85 ? 'ak47' : 'awp');
        } else {
          a.primary = 'ak47';
        }
        a.secondary = a.team === 'T' ? 'glock' : 'usp';
      }
      a.root.visible = true;

      const sp = a.team === 'T' ? SPAWNS.T[ti++ % SPAWNS.T.length] : SPAWNS.CT[ci++ % SPAWNS.CT.length];
      a.x = sp.x + 0.5 + (Math.random() - .5) * 1.6;
      a.z = sp.z + 0.5 + (Math.random() - .5) * 1.6;
      a.y = 0;
      // face roughly toward the enemy side
      a.yaw = a.team === 'T' ? Math.PI * -0.75 : Math.PI * 0.25;
      a.pitch = 0;
      a.root.position.set(a.x, 0, a.z);
      a.root.rotation.y = a.yaw + Math.PI;
    }

    // give the bomb to a random T
    const ts = this.actors.filter(a => a.team === 'T');
    const carrier = ts[Math.floor(Math.random() * ts.length)];
    if (carrier) { carrier.hasBomb = true; this.bomb.carrier = carrier.id; }

    this.banner = pistol ? '手枪局 · Pistol round' : `第 ${n} 回合 · Round ${n}`;
    this.bannerUntil = performance.now() + 2600;
  }

  /* ---------------- input ---------------- */
  private bindInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (!this.mouseLocked) { canvas.requestPointerLock?.(); }
      this.audio.unlock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (!this.mouseLocked) return;
      const me = this.me;
      if (!me || !me.alive) return;
      const sens = me.scoped ? 0.0011 : 0.0022;
      me.yaw -= e.movementX * sens;
      me.pitch -= e.movementY * sens;
      me.pitch = clamp(me.pitch, -TUNE.maxPitch, TUNE.maxPitch);
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.mouseLocked) return;
      const me = this.me; if (!me || !me.alive) return;
      if (e.button === 0) { this.keys.fire = true; }
      if (e.button === 2) { this.toggleScope(me); }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.keys.fire = false;
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      const me = this.me; if (!me || !me.alive) {
        if (e.code === 'Space') this.cycleSpectate();
        return;
      }
      if (e.code === 'KeyR') this.startReload(me);
      if (e.code === 'Digit1') this.switchSlot(me, 'primary');
      if (e.code === 'Digit2') this.switchSlot(me, 'secondary');
      if (e.code === 'Digit3') this.switchSlot(me, 'melee');
      if (e.code === 'KeyE') this.tryUse(me);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
  }

  /* ---------------- weapons ---------------- */
  currentWeaponId(a: Actor): string {
    if (a.slot === 'primary' && a.primary) return a.primary;
    if (a.slot === 'melee') return 'knife';
    return a.secondary;
  }
  currentWeapon(a: Actor): WeaponDef { return WEAPONS[this.currentWeaponId(a)]; }

  switchSlot(a: Actor, slot: 'primary' | 'secondary' | 'melee') {
    if (slot === 'primary' && !a.primary) return;
    if (a.slot === slot) return;
    a.slot = slot;
    a.reloadingUntil = 0;
    if (a.scoped) { a.scoped = false; if (a.controlled) this.audio.play('scopeOut'); }
    if (a.controlled) this.audio.play('reload', 0.5);
  }

  startReload(a: Actor) {
    const id = this.currentWeaponId(a);
    const w = WEAPONS[id];
    if (w.melee) return;
    if (a.reloadingUntil > 0) return;
    if (a.mags[id] >= w.mag) return;
    if (a.reserves[id] <= 0) return;
    a.reloadingUntil = performance.now() + w.reloadTime * 1000;
    if (a.controlled || this.nearMe(a)) this.audio.play('reload', 0.6);
  }

  private nearMe(a: Actor): boolean {
    const me = this.me; if (!me) return false;
    return Math.hypot(a.x - me.x, a.z - me.z) < 26;
  }

  private finishReload(a: Actor) {
    const id = this.currentWeaponId(a);
    const w = WEAPONS[id];
    const need = w.mag - a.mags[id];
    const take = Math.min(need, a.reserves[id]);
    a.mags[id] += take;
    a.reserves[id] -= take;
    if (a.controlled || this.nearMe(a)) this.audio.play('reloadEnd', 0.6);
  }

  toggleScope(a: Actor) {
    const w = this.currentWeapon(a);
    if (!w.scoped) return;
    a.scoped = !a.scoped;
    if (a.controlled) this.audio.play(a.scoped ? 'scopeIn' : 'scopeOut');
  }

  /* ---------------- firing ---------------- */
  private fire(a: Actor) {
    const now = performance.now();
    const id = this.currentWeaponId(a);
    const w = WEAPONS[id];
    if (a.reloadingUntil > 0) return;
    if (now < a.nextFire) return;

    if (w.melee) {
      a.nextFire = now + 60000 / w.rpm;
      this.meleeSwing(a, w);
      return;
    }
    if (a.mags[id] <= 0) {
      a.nextFire = now + 240;
      if (a.controlled) this.audio.play('dryFire');
      this.startReload(a);
      return;
    }

    a.nextFire = now + 60000 / w.rpm;
    a.mags[id]--;

    // direction with spread
    const heat = a.spreadHeat;
    const spread = w.spread + heat;
    const cy = Math.cos(a.pitch);
    const dir = new THREE.Vector3(-Math.sin(a.yaw) * cy, Math.sin(a.pitch), -Math.cos(a.yaw) * cy);
    const sx = (Math.random() - .5) * spread * 2;
    const sy = (Math.random() - .5) * spread * 2;
    const right = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, sx).addScaledVector(up, sy).normalize();

    const ox = a.x, oy = a.y + TUNE.eyeHeight, oz = a.z;
    const wallD = rayWall(ox, oy, oz, dir.x, dir.y, dir.z, w.range);

    let best: { t: number; victim: Actor; box: HitboxName } | null = null;
    for (const v of this.actors) {
      if (v === a || !v.alive || v.team === a.team) continue;
      const rough = Math.hypot(v.x - ox, v.z - oz) - 1;
      if (rough > wallD || rough > w.range) continue;
      for (const hb of hitboxesOf(v)) {
        const t = rayAABB(ox, oy, oz, dir.x, dir.y, dir.z, hb.c[0], hb.c[1], hb.c[2], hb.h[0], hb.h[1], hb.h[2]);
        if (t !== null && t > 0 && t < w.range && t < wallD && (!best || t < best.t)) {
          best = { t, victim: v, box: hb.name };
        }
      }
    }

    if (best) this.applyDamage(a, best.victim, w, best.box, best.t);

    // recoil & heat
    a.spreadHeat = Math.min(w.spread * 5 + 0.06, a.spreadHeat + w.spreadPerShot);
    if (a.controlled) {
      a.recoil += w.recoilPitch;
      a.pitch = clamp(a.pitch + w.recoilPitch * 0.85, -TUNE.maxPitch, TUNE.maxPitch);
      a.yaw += (Math.random() - .5) * w.recoilYaw * 2;
      this.camShake = Math.min(0.5, this.camShake + w.recoilPitch * 8);
    }

    const dist3d = a.controlled ? 1 : clamp(1 - Math.hypot(a.x - (this.me?.x ?? 0), a.z - (this.me?.z ?? 0)) / 60, 0, 1);
    this.audio.play(WEAPON_SFX[id] as Sfx, a.controlled ? 1 : 0.55 * dist3d);
  }

  private meleeSwing(a: Actor, w: WeaponDef) {
    const ox = a.x, oy = a.y + TUNE.eyeHeight, oz = a.z;
    const cy = Math.cos(a.pitch);
    const dir = new THREE.Vector3(-Math.sin(a.yaw) * cy, Math.sin(a.pitch), -Math.cos(a.yaw) * cy);
    const wallD = rayWall(ox, oy, oz, dir.x, dir.y, dir.z, w.range);
    let best: { t: number; victim: Actor; box: HitboxName } | null = null;
    for (const v of this.actors) {
      if (v === a || !v.alive || v.team === a.team) continue;
      for (const hb of hitboxesOf(v)) {
        const t = rayAABB(ox, oy, oz, dir.x, dir.y, dir.z, hb.c[0], hb.c[1], hb.c[2], hb.h[0], hb.h[1], hb.h[2]);
        if (t !== null && t > 0 && t < w.range && t < wallD && (!best || t < best.t)) best = { t, victim: v, box: hb.name };
      }
    }
    if (best) this.applyDamage(a, best.victim, w, best.box, best.t);
    else if (a.controlled) this.audio.play('knife', 0.5);
  }

  private applyDamage(shooter: Actor, victim: Actor, w: WeaponDef, box: HitboxName, dist: number) {
    // headshot = twice body damage (per spec), then hitbox zone scaling
    let dmg = w.damage;
    if (box === 'head') dmg *= w.headMultiplier;
    dmg *= HITBOX_MULT[box];
    const falloff = 1 - (1 - w.falloff) * clamp(dist / w.range, 0, 1);
    dmg *= falloff;

    // armor
    if (victim.armor > 0 && box !== 'leg') {
      const absorbed = dmg * w.armorRatio;
      const taken = Math.min(victim.armor, absorbed);
      victim.armor -= taken;
      dmg -= taken;
      victim.armor = Math.max(0, victim.armor);
    }
    dmg = Math.round(dmg);
    victim.hp -= dmg;

    if (shooter.controlled) {
      this.hitFlashUntil = performance.now() + 130;
      this.audio.play(box === 'head' ? 'hitHead' : 'hit', 0.85);
    }
    if (victim.hp <= 0) this.kill(shooter, victim, w, box === 'head');
  }

  private kill(shooter: Actor, victim: Actor, w: WeaponDef, headshot: boolean) {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    shooter.kills++;
    victim.target = null;
    victim.state = 'dead';
    victim.path = [];
    victim.root.visible = false;

    this.killfeed.unshift({
      id: this.kfId++, killer: shooter.name, victim: victim.name,
      weapon: w.name, headshot, killerTeam: shooter.team, victimTeam: victim.team,
      at: performance.now()
    });
    if (this.killfeed.length > 6) this.killfeed.pop();

    if (victim.hasBomb) {
      victim.hasBomb = false;
      // bomb drops where he died
      (this as any).bombGroup.position.set(victim.x, 0.12, victim.z);
      (this as any).bombGroup.visible = true;
      this.bomb.planted = false;
      this.bomb.site = null;
      this.bomb.x = victim.x; this.bomb.z = victim.z;
      this.bomb.carrier = null;
    }
    if (shooter.controlled || (this.me && victim.id === this.me.id)) this.audio.play('kill', 0.8);

    if (victim.controlled) {
      victim.controlled = false;
      setTimeout(() => this.cycleSpectate(), 900);
    }
    this.checkRoundEnd();
  }

  cycleSpectate() {
    if (this.me && this.me.alive) return;
    const team = this.actors.find(a => a.id === (this as any).lastTeam)?.team ?? 'T';
    const alive = this.actors.filter(a => a.alive && a.team === team && !a.isHuman);
    const pool = alive.length ? alive : this.actors.filter(a => a.alive);
    if (!pool.length) return;
    const cur = pool.findIndex(a => a.controlled);
    const next = pool[(cur + 1) % pool.length];
    for (const a of this.actors) a.controlled = false;
    next.controlled = true;
    (this as any).lastTeam = next.team;
  }

  /* ---------------- bomb ---------------- */
  private tryUse(a: Actor) {
    const now = performance.now();
    if (a.team === 'T' && a.hasBomb && !this.bomb.planted) {
      const site = inSite('A', a.x, a.z) ? 'A' : inSite('B', a.x, a.z) ? 'B' : null;
      if (!site) return;
      a.plantingUntil = now + TUNE.plantTime * 1000;
      this.audio.play('plant', 0.8);
      (this as any).plantingSite = site;
      return;
    }
    if (a.team === 'CT' && this.bomb.planted) {
      const d = Math.hypot(a.x - this.bomb.x, a.z - this.bomb.z);
      if (d > 1.6) return;
      a.defusingUntil = now + (a.controlled ? TUNE.defuseKitTime : TUNE.defuseTime) * 1000;
      this.audio.play('defuse', 0.7);
    }
  }

  private updateBomb(dt: number) {
    const now = performance.now();
    const grp = (this as any).bombGroup;
    const led = (this as any).bombLed as THREE.MeshStandardMaterial;

    if (!this.bomb.planted) {
      // loose bomb pickup
      if (this.bomb.carrier === null && grp.visible) {
        for (const a of this.actors) {
          if (a.team !== 'T' || !a.alive) continue;
          if (Math.hypot(a.x - this.bomb.x, a.z - this.bomb.z) < 1.1) {
            a.hasBomb = true; this.bomb.carrier = a.id; grp.visible = false;
            break;
          }
        }
      }
      return;
    }

    grp.visible = true;
    grp.position.set(this.bomb.x, 0.12, this.bomb.z);
    grp.rotation.y += dt * 0.6;
    const left = (this.bomb.plantedAt + TUNE.bombTimer * 1000 - now) / 1000;
    led.emissiveIntensity = 1 + Math.abs(Math.sin(now / 160)) * 3;
    if (now > this.bombBeepAt) {
      this.bombBeepAt = now + Math.max(120, left * 26);
      this.audio.play('beep', 0.5);
    }
    if (left <= 0) {
      this.audio.play('explode', 1);
      this.endRound('T', 'C4 爆炸 · Bomb detonated');
    }
  }

  private checkRoundEnd() {
    if (this.roundState === 'over') return;
    const tAlive = this.actors.some(a => a.team === 'T' && a.alive);
    const ctAlive = this.actors.some(a => a.team === 'CT' && a.alive);
    if (!ctAlive) this.endRound('T', '反恐精英被全歼 · CT eliminated');
    else if (!tAlive && !this.bomb.planted) this.endRound('CT', '恐怖分子被全歼 · T eliminated');
  }

  private endRound(winner: Team, reason: string) {
    if (this.roundState === 'over') return;
    this.roundState = 'over';
    this.roundClock = TUNE.roundEndDelay;
    if (winner === 'T') this.scoreT++; else this.scoreCT++;
    this.banner = `${winner === 'T' ? '恐怖分子' : '反恐精英'}获胜 · ${reason}`;
    this.bannerUntil = performance.now() + TUNE.roundEndDelay * 1000;
    this.audio.play(winner === 'T' ? 'roundWinT' : 'roundWinCT', 0.9);
  }

  /* ---------------- main step ---------------- */
  private step(dt: number) {
    const now = performance.now();
    if (this.banner && now > this.bannerUntil) this.banner = null;

    if (this.roundState === 'freeze') {
      this.roundClock -= dt;
      if (this.roundClock <= 0) { this.roundState = 'live'; this.roundClock = TUNE.roundTime; }
    } else if (this.roundState === 'live') {
      this.roundClock -= dt;
      if (this.roundClock <= 0) {
        // time out: CT win unless the bomb is already down
        this.endRound(this.bomb.planted ? 'T' : 'CT', '时间耗尽 · Time expired');
      }
    } else {
      this.roundClock -= dt;
      if (this.roundClock <= 0) {
        this.pistolRound = false;
        this.startRound(this.round + 1);
        const alive = this.actors.filter(a => a.alive);
        const human = this.actors.find(a => a.isHuman)!;
        for (const a of this.actors) a.controlled = false;
        human.alive = true;
        human.controlled = true;
        void alive;
      }
    }

    for (const a of this.actors) {
      if (!a.alive) continue;
      if (a.controlled) this.stepHuman(a, dt);
      else this.stepBot(a, dt);
      this.commonStep(a, dt);
    }
    this.updateBomb(dt);
    this.updateViewmodel(dt);
  }

  private commonStep(a: Actor, dt: number) {
    // gravity + ground
    a.vy -= TUNE.gravity * dt;
    a.y += a.vy * dt;
    if (a.y <= 0) { a.y = 0; a.vy = 0; a.onGround = true; } else a.onGround = false;

    // spread heat decay
    a.spreadHeat = Math.max(0, a.spreadHeat - dt * 0.055);
    if (a.reloadingUntil > 0 && performance.now() >= a.reloadingUntil) {
      a.reloadingUntil = 0;
      this.finishReload(a);
    }

    // planting / defusing progress
    if (a.plantingUntil > 0 && performance.now() >= a.plantingUntil) {
      const site = (this as any).plantingSite ?? 'A';
      this.bomb.planted = true;
      this.bomb.site = site;
      this.bomb.x = a.x; this.bomb.z = a.z;
      this.bomb.plantedAt = performance.now();
      a.hasBomb = false;
      a.plantingUntil = 0;
      this.bomb.carrier = null;
      this.audio.play('plant', 0.9);
      this.banner = 'C4 已安放 · Bomb planted';
      this.bannerUntil = performance.now() + 2200;
    }
    if (a.defusingUntil > 0 && performance.now() >= a.defusingUntil) {
      this.bomb.planted = false;
      a.defusingUntil = 0;
      (this as any).bombGroup.visible = false;
      this.audio.play('defuse', 0.9);
      this.endRound('CT', 'C4 被拆除 · Bomb defused');
    }

    // rig
    a.root.position.set(a.x, a.y, a.z);
    a.root.rotation.y = a.yaw + Math.PI;
    this.animateRig(a, dt);
  }

  private stepHuman(a: Actor, dt: number) {
    if (this.roundState === 'over' || (this.roundState === 'freeze' && false)) {
      return;
    }
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k['KeyW']) { fx -= Math.sin(a.yaw); fz -= Math.cos(a.yaw); }
    if (k['KeyS']) { fx += Math.sin(a.yaw); fz += Math.cos(a.yaw); }
    if (k['KeyA']) { fx -= Math.cos(a.yaw); fz += Math.sin(a.yaw); }
    if (k['KeyD']) { fx += Math.cos(a.yaw); fz -= Math.sin(a.yaw); }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }

    const walking = !!k['ShiftLeft'] || !!k['ShiftRight'];
    const speed = walking ? TUNE.crouchSpeed : (this.currentWeaponId(a) === 'awp' ? TUNE.walkSpeed : TUNE.runSpeed);
    const target = { x: fx * speed, z: fz * speed };
    const acc = a.onGround ? TUNE.accel : TUNE.airAccel;
    (a as any).vx = ((a as any).vx ?? 0) + (target.x - ((a as any).vx ?? 0)) * Math.min(1, acc * dt);
    (a as any).vz = ((a as any).vz ?? 0) + (target.z - ((a as any).vz ?? 0)) * Math.min(1, acc * dt);
    if (len === 0 && a.onGround) {
      const f = Math.max(0, 1 - TUNE.friction * dt);
      (a as any).vx *= f; (a as any).vz *= f;
    }
    moveWithCollision(a, (a as any).vx * dt, (a as any).vz * dt, TUNE.radius);

    // footsteps
    if (a.onGround && len > 0) {
      a.footTimer -= dt * (walking ? 1.6 : 2.4);
      if (a.footTimer <= 0) { a.footTimer = 1; this.audio.play('step', walking ? 0.35 : 0.7); }
    }

    if (k['Space'] && a.onGround) { a.vy = TUNE.jumpVel; a.onGround = false; }
    if (k.fire && this.roundState === 'live') {
      const w = this.currentWeapon(a);
      if (w.rpm > 200 || a.scoped) this.fire(a);
    }
    // single taps for semi-auto feel
    if (this.roundState === 'live' && k.fire === false && (a as any).lastFire) { (a as any).lastFire = false; }
  }

  private stepBot(a: Actor, dt: number) {
    const now = performance.now();
    if (this.roundState !== 'live') { a.root.position.set(a.x, a.y, a.z); return; }

    // ---- perception ----
    if (now > a.thinkAt) {
      a.thinkAt = now + 140 + Math.random() * 120;
      let best: Actor | null = null;
      let bestD = Infinity;
      for (const v of this.actors) {
        if (!v.alive || v.team === a.team || v === a) continue;
        const dx = v.x - a.x, dz = v.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 62) continue;
        const want = Math.atan2(-dx, -dz);
        let diff = Math.abs(((want - a.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
        if (diff > 1.0) continue;                     // ~115 deg field of view
        if (!losClear(a.x, a.y + 1.5, a.z, v.x, v.y + 1.3, v.z)) continue;
        if (d < bestD) { bestD = d; best = v; }
      }
      if (best) { a.target = best; a.lastSeenAt = now; }
      else if (a.lastSeenAt && now - a.lastSeenAt > 2600) { a.target = null; a.lastSeenAt = 0; }
    }

    const target = a.target;
    // ---- goal selection ----
    if (!a.goal || now > a.repathAt) {
      a.repathAt = now + 2600 + Math.random() * 1800;
      let goalName: string | null = null;
      if (a.team === 'T') {
        if (a.hasBomb) {
          const site = Math.random() < 0.5 ? SITES.A : SITES.B;
          goalName = site.name === 'A' ? 'aSite' : 'bSite';
        } else if (this.bomb.planted) goalName = this.bomb.site === 'A' ? 'aSite' : 'bSite';
        else if (target) goalName = null;
        else goalName = pick(['longATop', 'midTop', 'midDoors', 'bTunnel', 'catwalk', 'bottomCorr']);
      } else {
        if (this.bomb.planted) goalName = this.bomb.site === 'A' ? 'aSite' : 'bSite';
        else goalName = pick(['aSite', 'bSite', 'midDoors', 'catwalk', 'longATop', 'ctRamp']);
      }
      a.goalName = goalName;
      const wp = goalName ? WAYPOINTS[goalName] : null;
      a.goal = wp ? { x: wp.x + 0.5 + (Math.random() - .5) * 4, z: wp.z + 0.5 + (Math.random() - .5) * 4 } : null;
      if (a.goal) {
        a.path = findPath(a.x, a.z, a.goal.x, a.goal.z);
        a.pathIdx = 0;
      }
    }

    let moveX = 0, moveZ = 0;
    let wantYaw = a.yaw;

    if (target && target.alive) {
      // ---- engage ----
      a.state = 'engage';
      const dx = target.x - a.x, dz = target.z - a.z;
      wantYaw = Math.atan2(-dx, -dz);
      const d = Math.hypot(dx, dz);
      const w = this.currentWeapon(a);

      if (d > 26) {
        moveX = dx / d; moveZ = dz / d;
      } else if (d < 6) {
        moveX = -dx / d; moveZ = -dz / d;
      } else {
        a.strafe = (now % 2200 < 1100) ? 1 : -1;
        moveX = (-dz / d) * a.strafe * 0.8;
        moveZ = (dx / d) * a.strafe * 0.8;
      }
      // aim: converge yaw/pitch toward the target, then shoot
      a.yaw += angleDelta(a.yaw, wantYaw) * Math.min(1, dt * 9);
      const dy = (target.y + 1.2) - (a.y + TUNE.eyeHeight);
      const wantPitch = Math.atan2(dy, Math.max(0.3, d));
      a.pitch += (wantPitch - a.pitch) * Math.min(1, dt * 9);

      const aimErr = Math.abs(angleDelta(a.yaw, wantYaw));
      const los = losClear(a.x, a.y + 1.5, a.z, target.x, target.y + 1.3, target.z);
      if (los && aimErr < 0.10 && d < w.range * 0.92) {
        if (a.mags[this.currentWeaponId(a)] <= 0) this.startReload(a);
        else this.fire(a);
      }
    } else {
      a.state = 'advance';
      if (a.path.length && a.pathIdx < a.path.length) {
        const p = a.path[a.pathIdx];
        const dx = p.x - a.x, dz = p.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7) a.pathIdx++;
        else {
          moveX = dx / d; moveZ = dz / d;
          wantYaw = Math.atan2(-dx, -dz);
        }
      } else if (a.goal) {
        a.repathAt = 0;
      } else {
        // idle patrol: look around a bit
        wantYaw = a.yaw + Math.sin(now / 900) * 0.6;
      }
      a.yaw += angleDelta(a.yaw, wantYaw) * Math.min(1, dt * 6);
      a.pitch *= 0.9;

      // plant / defuse
      if (a.team === 'T' && a.hasBomb && !this.bomb.planted) {
        const site = inSite('A', a.x, a.z) ? 'A' : inSite('B', a.x, a.z) ? 'B' : null;
        if (site && !a.target) {
          a.state = 'plant';
          if (a.plantingUntil === 0) {
            a.plantingUntil = now + TUNE.plantTime * 1000;
            (this as any).plantingSite = site;
            this.audio.play('plant', 0.45);
          }
          moveX = 0; moveZ = 0;
        }
      }
      if (a.team === 'CT' && this.bomb.planted) {
        const d = Math.hypot(a.x - this.bomb.x, a.z - this.bomb.z);
        if (d < 1.4) {
          a.state = 'defuse';
          if (a.defusingUntil === 0) { a.defusingUntil = now + TUNE.defuseTime * 1000; this.audio.play('defuse', 0.5); }
          moveX = 0; moveZ = 0;
        } else if (d < 30) {
          const dx = this.bomb.x - a.x, dz = this.bomb.z - a.z;
          moveX = dx / d; moveZ = dz / d;
          wantYaw = Math.atan2(-dx, -dz);
          a.yaw += angleDelta(a.yaw, wantYaw) * Math.min(1, dt * 8);
        }
      }
    }

    // ---- integrate ----
    const speed = TUNE.walkSpeed * (a.state === 'engage' ? 1.0 : 1.12);
    const tvx = moveX * speed, tvz = moveZ * speed;
    (a as any).vx = ((a as any).vx ?? 0) + (tvx - ((a as any).vx ?? 0)) * Math.min(1, TUNE.accel * dt * 0.35);
    (a as any).vz = ((a as any).vz ?? 0) + (tvz - ((a as any).vz ?? 0)) * Math.min(1, TUNE.accel * dt * 0.35);

    const before = { x: a.x, z: a.z };
    moveWithCollision(a, (a as any).vx * dt, (a as any).vz * dt, TUNE.radius);
    const moved = Math.hypot(a.x - before.x, a.z - before.z);

    // unstuck: if we hardly moved but wanted to, force a repath
    if (moved < dt * 0.4 && (Math.abs(tvx) + Math.abs(tvz)) > 0.5 && now > a.repathAt - 1200) {
      a.repathAt = 0;
      a.strafe = -a.strafe;
    }
    if (a.onGround && moved > dt * 1.2) {
      a.footTimer -= dt * 2.2;
      if (a.footTimer <= 0) { a.footTimer = 1; this.audio.play('step', 0.35); }
    }
  }

  private animateRig(a: Actor, dt: number) {
    const r = a.rig as Rig;
    const speed = Math.hypot((a as any).vx ?? 0, (a as any).vz ?? 0);
    const t = performance.now() / 1000;
    const walk = Math.min(1, speed / TUNE.runSpeed);
    const swing = Math.sin(t * (6 + walk * 6)) * walk;

    r.legL.rotation.x = swing * 0.7;
    r.legR.rotation.x = -swing * 0.7;
    r.armL.rotation.x = -swing * 0.5;
    r.armR.rotation.x = swing * 0.5;
    r.torso.rotation.y = swing * 0.06;
    r.head.position.y = 0.62 + Math.sin(t * 1.6) * 0.006;

    // aim pose: arms forward when holding a weapon
    const id = this.currentWeaponId(a);
    if (id !== 'knife') {
      r.armR.rotation.x = -1.25 + swing * 0.3;
      r.armL.rotation.x = -1.05 - swing * 0.2;
      r.armL.rotation.z = 0.35;
      r.foreR.rotation.x = -0.35;
      r.foreL.rotation.x = -0.55;
    } else {
      r.armR.rotation.x = -1.0;
      r.armL.rotation.x = -0.7;
      r.armL.rotation.z = 0.2;
    }
    r.head.rotation.x = -a.pitch * 0.7;

    // swap the held weapon mesh when it changes
    if ((r as any).weaponId !== id) {
      (r as any).weaponId = id;
      r.weaponGroup.clear();
      r.weaponGroup.add(buildWeaponMesh(WEAPONS[id]));
    }
    r.weaponGroup.rotation.x = -a.pitch * 0.5;
    void dt;
  }

  /* ---------------- viewmodel ---------------- */
  private updateViewmodel(dt: number) {
    const me = this.me;
    if (!me) return;
    const id = this.currentWeaponId(me);
    if (id !== this.viewWeaponId) {
      this.viewWeaponId = id;
      this.viewGroup.clear();
      this.viewWeapon = buildWeaponMesh(WEAPONS[id]);
      this.viewGroup.add(this.viewWeapon);
    }
    const w = WEAPONS[id];
    const now = performance.now();
    const bob = Math.min(1, Math.hypot((me as any).vx ?? 0, (me as any).vz ?? 0) / TUNE.runSpeed);
    const b = Math.sin(now / 210) * 0.012 * bob;
    const reloading = me.reloadingUntil > 0;

    let px = 0.26, py = -0.24, pz = -0.52;
    if (me.scoped) { px = 0.0; py = -0.135; pz = -0.34; }
    this.viewGroup.position.set(px + b, py + b * 0.6 + (reloading ? -0.12 : 0), pz);
    this.viewGroup.rotation.set(
      (reloading ? 0.5 : 0) + this.camShake * 0.5,
      me.scoped ? 0 : -0.06,
      reloading ? 0.4 : 0
    );

    // recoil kick
    if (this.camShake > 0) this.camShake = Math.max(0, this.camShake - dt * 2.4);

    // camera
    const eye = me.y + TUNE.eyeHeight;
    this.camera.position.set(me.x, eye, me.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(me.yaw);
    this.camera.rotateX(me.pitch + this.camShake * 0.02);
    const wantFov = me.scoped && w.scoped ? w.scoped.fov : this.baseFov;
    if (Math.abs(this.camera.fov - wantFov) > 0.2) {
      this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 12);
      this.camera.updateProjectionMatrix();
    }

    // hide our own body from the first-person camera
    me.root.visible = false;
  }

  /* ---------------- loop ---------------- */
  start() {
    this.clock.getDelta();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.step(dt);
      this.render();
      this.publish();
    };
    loop();
  }
  stop() { cancelAnimationFrame(this.raf); }

  private render() {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewScene, this.viewCamera);
  }

  private publish() {
    if (!this.onSnapshot) return;
    const me = this.me;
    const now = performance.now();
    const id = me ? this.currentWeaponId(me) : 'knife';
    const w = WEAPONS[id];
    const bombLeft = this.bomb.planted
      ? Math.max(0, (this.bomb.plantedAt + TUNE.bombTimer * 1000 - now) / 1000) : 0;
    this.onSnapshot({
      round: this.round,
      state: this.roundState,
      timeLeft: Math.max(0, this.roundClock),
      freezeLeft: this.roundState === 'freeze' ? Math.max(0, this.roundClock) : 0,
      scoreT: this.scoreT, scoreCT: this.scoreCT,
      hp: me?.hp ?? 0, armor: me?.armor ?? 0, helmet: me?.helmet ?? false,
      weapon: id, weaponName: w.name,
      mag: me?.mags[id] ?? 0, reserve: me?.reserves[id] ?? 0,
      slot: me?.slot ?? 'secondary',
      reloading: (me?.reloadingUntil ?? 0) > 0,
      scoped: me?.scoped ?? false,
      bomb: {
        planted: this.bomb.planted, site: this.bomb.site, left: bombLeft,
        carrying: me?.hasBomb ?? false,
        planting: me?.plantingUntil ?? 0,
        defusing: me?.defusingUntil ?? 0
      },
      killfeed: this.killfeed.slice(0, 5),
      actors: this.actors.map(a => ({
        name: a.name, team: a.team, alive: a.alive, hp: a.hp,
        kills: a.kills, deaths: a.deaths, controlled: a.controlled
      })),
      banner: this.banner,
      pistolRound: this.pistolRound,
      spectating: me && !me.alive ? me.name : null,
      crosshairSpread: w.melee ? 0 : (w.spread + (me?.spreadHeat ?? 0)) * 900,
      hitFlash: now < this.hitFlashUntil ? 1 : 0,
      deadCount: {
        T: this.actors.filter(a => a.team === 'T' && !a.alive).length,
        CT: this.actors.filter(a => a.team === 'CT' && !a.alive).length
      }
    });
  }

  /** Expose positions for the minimap. */
  radar() {
    return {
      self: this.me ? { x: this.me.x, z: this.me.z, yaw: this.me.yaw, team: this.me.team } : null,
      mates: this.actors.filter(a => a.alive && a !== this.me && a.team === (this.me?.team ?? 'T'))
        .map(a => ({ x: a.x, z: a.z, name: a.name })),
      enemies: this.actors.filter(a => a.alive && this.me && a.team !== this.me.team)
        .filter(a => this.me && losClear(this.me.x, this.me.y + 1.5, this.me.z, a.x, a.y + 1.3, a.z))
        .map(a => ({ x: a.x, z: a.z })),
      bomb: this.bomb.planted ? { x: this.bomb.x, z: this.bomb.z } : null
    };
  }

  dispose() { this.stop(); }
}

/* ---------------- helpers ---------------- */
function angleDelta(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export { GRID, PRIMARY_ORDER, SECONDARY_ORDER, TEAM_COLOR, clearLine };
