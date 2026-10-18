import * as THREE from 'three';
import { Input } from '../engine/input';
import { publish } from '../engine/store';
import {
  DEFAULT_LOADOUT,
  PISTOL_ROUND_LOADOUT,
  WEAPONS,
  ZONE_MULTIPLIER
} from '../engine/types';
import type { HitZone, HudState, KillFeedEntry, MinimapBlip, Slot, Team } from '../engine/types';
import { BotBrain } from './ai';
import { Character } from './character';
import type { AiWorld, Entity, SightTarget } from './entity';
import { weaponOf } from './entity';
import {
  AREAS,
  CELL,
  CRATE_H,
  SPAWN_CT,
  SPAWN_T,
  WALL_H,
  areaCenterWorld,
  bombSiteAt,
  blockedLine,
  cellHeight,
  worldToGx,
  worldToGy
} from './layout';
import { buildMapScene } from './mapMesh';
import { invalidateNav } from './nav';
import { BOMB_TIME, RoundSystem } from './round';
import { buildGunMesh } from '../render/gun';
import * as SFX from '../audio/audio';

const EYE = 1.62;
const RADIUS = 0.42;
const GRAVITY = 22;
const JUMP_V = 6.2;
const MAX_STEP = 0.62;
const WALK_SPEED = 5.6;

interface Tracer {
  line: THREE.Line;
  life: number;
}

/** 引擎总装：物理、命中判定、AI、回合、相机、HUD 同步。 */
export class Game implements AiWorld {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(90, 1, 0.05, 520);
  private readonly input = new Input();
  private readonly map = buildMapScene();
  private readonly viewGroup = new THREE.Group();
  private readonly entities: Entity[] = [];
  private readonly brains = new Map<number, BotBrain>();
  private readonly tracers: Tracer[] = [];
  private readonly round: RoundSystem;
  private readonly clock = new THREE.Clock();
  private readonly muzzleLight: THREE.PointLight;

  private controlled: Entity;
  private attackSite: 'A' | 'B' = 'A';
  private running = false;
  private frameId = 0;
  private time = 0;
  private hudAcc = 0;
  private spectateIndex = 0;
  private killFeedId = 0;
  private killFeed: KillFeedEntry[] = [];
  private message = '回合 1 · 手枪局';
  private roundOverTimer = 0;
  private nextEntityId = 1;
  private stepTimer = 0;
  private shotFlash = 0;
  private viewGun: THREE.Group | null = null;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.add(this.map.group);
    this.camera.add(this.viewGroup);
    this.scene.add(this.camera);

    this.muzzleLight = new THREE.PointLight(0xffd08a, 0, 14, 2);
    this.camera.add(this.muzzleLight);

    this.round = new RoundSystem({
      onPlant: (x, z) => {
        this.message = 'C4 已安放';
        SFX.playPlant();
        for (const e of this.entities) {
          if (e.team === 'CT') e.hasC4 = false;
        }
        void x;
        void z;
      },
      onDefused: () => {
        this.message = '拆除成功';
      },
      onExploded: () => {
        this.message = 'C4 爆炸';
        SFX.playExplode();
        for (const e of this.entities) {
          const d = Math.hypot(e.pos.x - this.round.c4X, e.pos.z - this.round.c4Z);
          if (d < 26 && e.alive) this.damage(e, null, 500 * (1 - d / 26), 'chest', 'C4');
        }
      },
      onRoundEnd: (winner, reason) => {
        this.message = `${winner === 'CT' ? '反恐精英' : '恐怖分子'}获胜 · ${reason}`;
        SFX.playBeep(winner === this.controlled.team ? 'win' : 'lose');
        this.roundOverTimer = 4.5;
      },
      onPhase: () => {
        this.publish(true);
      },
      onTick: () => {
        /* 计时在 tick 内读取，无需额外处理 */
      }
    });

    this.buildEntities();
    this.controlled = this.entities.find((e) => e.isPlayer) as Entity;
    this.round.startRound(this.pickC4Carrier());
    this.rebuildViewGun();
    SFX.playBeep('roundStart');
  }

  // ────────────────────────── 生命周期 ──────────────────────────

  attach(): void {
    this.detachInput = this.input.attach(this.canvas);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }
  private detachInput: (() => void) | null = null;

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.frameId = requestAnimationFrame(loop);
      this.tick();
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.detachInput?.();
    window.removeEventListener('resize', this.onResize);
    for (const e of this.entities) e.char.dispose();
    for (const t of this.tracers) {
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
  }

  requestLock(): void {
    this.input.requestLock(this.canvas);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ────────────────────────── 实体装配 ──────────────────────────

  private buildEntities(): void {
    const layout: { team: Team; name: string; player: boolean }[] = [
      { team: 'CT', name: '你', player: true },
      { team: 'CT', name: '队友 A', player: false },
      { team: 'CT', name: '队友 B', player: false },
      { team: 'CT', name: '队友 C', player: false },
      { team: 'CT', name: '队友 D', player: false },
      { team: 'T', name: '敌手 1', player: false },
      { team: 'T', name: '敌手 2', player: false },
      { team: 'T', name: '敌手 3', player: false },
      { team: 'T', name: '敌手 4', player: false },
      { team: 'T', name: '敌手 5', player: false }
    ];

    let ctIdx = 0;
    let tIdx = 0;
    for (const l of layout) {
      const char = new Character(l.team);
      const spawn = l.team === 'CT' ? SPAWN_CT : SPAWN_T;
      const offset = l.team === 'CT' ? ctIdx++ : tIdx++;
      const pos = new THREE.Vector3(
        spawn.x + (offset % 3) * 2.2 - 2.2,
        0,
        spawn.z + Math.floor(offset / 3) * 2.6
      );
      const e: Entity = {
        id: this.nextEntityId++,
        name: l.name,
        team: l.team,
        isPlayer: l.player,
        alive: true,
        pos,
        vel: new THREE.Vector3(),
        yaw: l.team === 'CT' ? Math.PI : 0,
        pitch: 0,
        health: 100,
        armor: 0,
        helmet: false,
        char,
        weapons: { primary: null, secondary: null, melee: 'knife' },
        activeSlot: 'secondary',
        ammo: {},
        scoped: false,
        reloadLeft: 0,
        deployLeft: 0,
        nextFireAt: 0,
        recoilPitch: 0,
        recoilSpread: 0,
        hasC4: false,
        kills: 0,
        deaths: 0,
        firedThisTick: false
      };
      this.entities.push(e);
      this.scene.add(char.root);
      if (!l.player) {
        this.brains.set(e.id, new BotBrain(l.team, this.nextEntityId * 37));
      }
    }
    this.applyLoadout();
    this.respawnAll();
  }

  private applyLoadout(): void {
    const pistol = this.round.round === 1;
    for (const e of this.entities) {
      const base = pistol ? PISTOL_ROUND_LOADOUT[e.team] : DEFAULT_LOADOUT[e.team];
      e.weapons = {
        primary: base.primary,
        secondary: base.secondary,
        melee: 'knife'
      };
      // 手枪局无主武器、只配手枪 + 护甲按手枪局配置
      e.armor = pistol ? 0 : 100;
      e.helmet = pistol ? false : true;
      e.ammo = {};
      for (const id of [base.primary, base.secondary, 'knife']) {
        if (!id) continue;
        const def = WEAPONS[id];
        e.ammo[id] = { mag: def.mag, reserve: def.reserve };
      }
      e.activeSlot = base.primary ? 'primary' : 'secondary';
      e.char.setWeapon((e.weapons[e.activeSlot] as string) ?? 'knife');
      e.scoped = false;
      e.reloadLeft = 0;
      e.deployLeft = 0;
    }
  }

  private respawnAll(): void {
    let ct = 0;
    let t = 0;
    for (const e of this.entities) {
      const spawn = e.team === 'CT' ? SPAWN_CT : SPAWN_T;
      const i = e.team === 'CT' ? ct++ : t++;
      e.pos.set(spawn.x + (i % 3) * 2.2 - 2.2, 0, spawn.z + Math.floor(i / 3) * 2.6);
      e.vel.set(0, 0, 0);
      e.health = 100;
      e.alive = true;
      e.hasC4 = false;
      e.pitch = 0;
      e.yaw = e.team === 'CT' ? Math.PI : 0;
      e.char.root.visible = true;
      const brain = this.brains.get(e.id);
      brain?.reset();
    }
    invalidateNav();
  }

  private pickC4Carrier(): number | null {
    const ts = this.entities.filter((e) => e.team === 'T');
    if (!ts.length) return null;
    const pick = ts[Math.floor(Math.random() * ts.length)];
    pick.hasC4 = true;
    return pick.id;
  }

  // ────────────────────────── 主循环 ──────────────────────────

  private tick(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.roundOverTimer > 0) {
      this.roundOverTimer -= dt;
      if (this.roundOverTimer <= 0) this.beginNextRound();
    }

    this.updatePlayer(dt);
    this.updateBots(dt);
    this.updatePhysics(dt);
    this.updateProbes(dt);

    const aliveCT = this.entities.filter((e) => e.team === 'CT' && e.alive).length;
    const aliveT = this.entities.filter((e) => e.team === 'T' && e.alive).length;
    this.round.tick(dt, aliveCT, aliveT);

    this.updateTracers(dt);
    this.updateCamera(dt);
    this.updateHud(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** 门与拾包等世界级交互。 */
  private updateProbes(dt: number): void {
    const alive = this.entities.filter((e) => e.alive);
    this.map.updateDoors(dt, alive.map((e) => ({ x: e.pos.x, z: e.pos.z })));

    // 掉包拾取
    if (this.round.c4State === 'dropped') {
      for (const e of alive) {
        if (e.team !== 'T') continue;
        if (Math.hypot(e.pos.x - this.round.c4X, e.pos.z - this.round.c4Z) < 2.2) {
          this.round.pickUpC4(e.id);
          e.hasC4 = true;
          if (e.isPlayer || this.controlled === e) this.message = '已拾取 C4';
          break;
        }
      }
    }
  }

  // ────────────────────────── 玩家控制 ──────────────────────────

  private updatePlayer(dt: number): void {
    const c = this.controlled;
    if (!c.alive) {
      this.updateSpectate(dt);
      return;
    }

    const { dx, dy } = this.input.takeMouse();
    c.yaw -= dx * 0.0022;
    c.pitch = clamp(c.pitch - dy * 0.0022, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);

    for (const key of this.input.consumePressed()) {
      if (key === 'r') this.tryReload(c);
      if (key === '1') this.switchSlot(c, 'primary');
      if (key === '2') this.switchSlot(c, 'secondary');
      if (key === '3') this.switchSlot(c, 'melee');
      if (key === 'f' && !c.alive) this.takeOver();
    }
    const wheel = this.input.takeWheel();
    if (wheel !== 0) this.cycleSlot(c, wheel);

    const wish = new THREE.Vector3();
    if (this.input.isDown('w')) wish.z -= 1;
    if (this.input.isDown('s')) wish.z += 1;
    if (this.input.isDown('a')) wish.x -= 1;
    if (this.input.isDown('d')) wish.x += 1;
    if (wish.lengthSq() > 0) wish.normalize();

    const speed = this.input.isDown('shift') ? WALK_SPEED * 0.52 : WALK_SPEED;
    const sin = Math.sin(c.yaw);
    const cos = Math.cos(c.yaw);
    const fwd = new THREE.Vector3(-sin, 0, -cos);
    const right = new THREE.Vector3(cos, 0, -sin);
    const move = fwd.multiplyScalar(-wish.z).add(right.multiplyScalar(wish.x));
    c.vel.x = move.x * speed;
    c.vel.z = move.z * speed;

    if (this.input.isDown('space') && c.pos.y <= this.groundAt(c) + 0.02) {
      c.vel.y = JUMP_V;
    }

    // 开火 / 开镜
    const w = weaponOf(c);
    if (w && w.canScope) {
      if (this.input.secondaryHeld !== c.scoped) {
        c.scoped = this.input.secondaryHeld;
        SFX.playZoom();
      }
    }
    if (this.input.primaryHeld) this.tryFire(c);

    // 脚步音
    const planar = Math.hypot(c.vel.x, c.vel.z);
    if (planar > 0.6 && c.pos.y <= this.groundAt(c) + 0.02) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.input.isDown('shift') ? 0.62 : 0.4;
        SFX.playFootstep(0);
      }
    }

    // 安放 / 拆包
    const holding = this.input.isDown('e');
    if (c.team === 'T' && c.hasC4 && this.inPlantZone(c)) {
      const done = this.round.tickPlant(dt, holding);
      if (holding) {
        this.message = '正在安放 C4';
        if (done) c.hasC4 = false;
      } else {
        this.message = `按住 E 安放 C4（${(this.round.plantProgress).toFixed(1)}s）`;
      }
    } else if (c.team === 'CT' && this.round.c4State === 'planted') {
      const near = Math.hypot(c.pos.x - this.round.c4X, c.pos.z - this.round.c4Z) < 2.4;
      if (near) {
        this.round.tickDefuse(dt, holding, c.helmet);
        this.message = holding ? '正在拆除 C4' : '按住 E 拆除 C4';
      } else {
        this.round.tickDefuse(dt, false, c.helmet);
      }
    }
  }

  /** 玩家阵亡：观察存活队友，可切换视角并接管操控。 */
  private updateSpectate(dt: number): void {
    void dt;
    const mates = this.entities.filter((e) => e.alive && e.team === this.controlled.team);
    if (!mates.length) return;
    const keys = this.input.consumePressed();
    for (const key of keys) {
      if (key === 'q' && mates.length > 1) {
        this.spectateIndex = (this.spectateIndex + 1) % mates.length;
      }
      if (key === 'f') this.takeOver();
    }
    const target = mates[this.spectateIndex % mates.length];
    const { dx, dy } = this.input.takeMouse();
    target.yaw -= dx * 0.0022;
    target.pitch = clamp(target.pitch - dy * 0.0022, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }

  /** 接管：把被观察的 bot 交给玩家操作，其 AI 停止。 */
  private takeOver(): void {
    const mates = this.entities.filter((e) => e.alive && e.team === this.controlled.team && !e.isPlayer);
    if (!mates.length) return;
    const target = mates[this.spectateIndex % mates.length];
    this.brains.delete(target.id);
    target.isPlayer = true;
    this.controlled.isPlayer = false;
    this.controlled = target;
    this.message = `已接管 ${target.name}`;
    this.rebuildViewGun();
  }

  private groundAt(e: Entity): number {
    const x0 = worldToGx(e.pos.x - RADIUS);
    const x1 = worldToGx(e.pos.x + RADIUS);
    const y0 = worldToGy(e.pos.z - RADIUS);
    const y1 = worldToGy(e.pos.z + RADIUS);
    let h = 0;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const ch = cellHeight(gx, gy);
        if (ch === WALL_H) continue;
        if (ch > h) h = ch;
      }
    }
    return h;
  }

  private blockedAt(x: number, z: number, y: number): boolean {
    const x0 = worldToGx(x - RADIUS);
    const x1 = worldToGx(x + RADIUS);
    const y0 = worldToGy(z - RADIUS);
    const y1 = worldToGy(z + RADIUS);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const ch = cellHeight(gx, gy);
        if (ch === 0) continue;
        if (ch >= WALL_H) return true;
        if (y < ch - 0.06) return true;
      }
    }
    return false;
  }

  // ────────────────────────── 物理 ──────────────────────────

  private updatePhysics(dt: number): void {
    for (const e of this.entities) {
      if (!e.alive) continue;
      e.vel.y -= GRAVITY * dt;
      const ground = this.groundAt(e);
      if (e.pos.y <= ground + 1e-3 && e.vel.y <= 0) {
        e.pos.y = ground;
        e.vel.y = 0;
      }

      this.slideX(e, e.vel.x * dt);
      this.slideZ(e, e.vel.z * dt);

      e.pos.y += e.vel.y * dt;
      if (e.pos.y < 0) e.pos.y = 0;
      if (e.pos.y > WALL_H + 6) e.pos.y = WALL_H + 6;

      e.char.root.position.set(e.pos.x, e.pos.y, e.pos.z);
      e.char.body.rotation.y = e.yaw;
      e.char.update(dt, Math.hypot(e.vel.x, e.vel.z));
    }
    this.pruneDead();
  }

  private slideX(e: Entity, dx: number): void {
    if (!dx) return;
    const nx = e.pos.x + dx;
    if (!this.blockedAt(nx, e.pos.z, e.pos.y)) {
      e.pos.x = nx;
      return;
    }
    for (let s = 0.25; s <= MAX_STEP; s += 0.22) {
      if (!this.blockedAt(nx, e.pos.z, e.pos.y + s) && this.groundAt(e) <= e.pos.y + s) {
        e.pos.x = nx;
        e.pos.y += s;
        return;
      }
    }
    e.vel.x = 0;
  }

  private slideZ(e: Entity, dz: number): void {
    if (!dz) return;
    const nz = e.pos.z + dz;
    if (!this.blockedAt(e.pos.x, nz, e.pos.y)) {
      e.pos.z = nz;
      return;
    }
    for (let s = 0.25; s <= MAX_STEP; s += 0.22) {
      if (!this.blockedAt(e.pos.x, nz, e.pos.y + s) && this.groundAt(e) <= e.pos.y + s) {
        e.pos.z = nz;
        e.pos.y += s;
        return;
      }
    }
    e.vel.z = 0;
  }

  // ────────────────────────── AI ──────────────────────────

  private updateBots(dt: number): void {
    for (const e of this.entities) {
      const brain = this.brains.get(e.id);
      if (!brain) continue;
      if (!e.alive) continue;
      brain.tick(e, dt, this);
      const w = weaponOf(e);
      const isMelee = !w || w.slot === 'melee';
      if (isMelee && e.weapons.secondary) e.activeSlot = 'secondary';
      e.char.setWeapon((e.weapons[e.activeSlot] as string) ?? 'knife');
      if (e.reloadLeft > 0) {
        e.reloadLeft -= dt;
        if (e.reloadLeft <= 0) this.finishReload(e);
      }
      if (e.deployLeft > 0) e.deployLeft -= dt;
      // AI 自动在空弹匣时换弹
      const id = e.weapons[e.activeSlot];
      const ammo = id ? e.ammo[id] : null;
      if (w && w.mag > 0 && ammo && ammo.mag <= 0 && ammo.reserve > 0 && e.reloadLeft <= 0) {
        this.tryReload(e);
      }
    }
  }

  // ────────────────────────── 开火与命中 ──────────────────────────

  private tryReload(e: Entity): void {
    const def = weaponOf(e);
    if (!def || def.mag === 0) return;
    const id = e.weapons[e.activeSlot];
    if (!id) return;
    const ammo = e.ammo[id];
    if (!ammo || ammo.mag >= def.mag || ammo.reserve <= 0 || e.reloadLeft > 0) return;
    e.reloadLeft = def.reloadTime;
    if (e.isPlayer) {
      SFX.playReload();
      this.message = '换弹中';
    }
  }

  private finishReload(e: Entity): void {
    const def = weaponOf(e);
    const id = e.weapons[e.activeSlot];
    if (!def || !id) return;
    const ammo = e.ammo[id];
    if (!ammo) return;
    const need = def.mag - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
    if (e.isPlayer) this.message = '';
  }

  private switchSlot(e: Entity, slot: Slot): void {
    if (!e.weapons[slot]) return;
    if (e.activeSlot === slot) return;
    e.activeSlot = slot;
    e.scoped = false;
    const def = WEAPONS[e.weapons[slot] as string];
    e.deployLeft = def ? def.deployTime : 0.4;
    e.char.setWeapon(e.weapons[slot] as string);
    if (e.isPlayer) {
      this.message = def.name;
      this.rebuildViewGun();
    }
  }

  private cycleSlot(e: Entity, dir: number): void {
    const order: Slot[] = ['primary', 'secondary', 'melee'];
    const avail = order.filter((s) => e.weapons[s]);
    if (avail.length < 2) return;
    const i = Math.max(0, avail.indexOf(e.activeSlot));
    const next = avail[(i + dir + avail.length) % avail.length];
    this.switchSlot(e, next);
  }

  private tryFire(e: Entity): void {
    if (e.reloadLeft > 0 || e.deployLeft > 0) return;
    if (this.time < e.nextFireAt) return;
    const def = weaponOf(e);
    const id = e.weapons[e.activeSlot];
    if (!def || !id) return;
    const ammo = e.ammo[id];
    if (!ammo || ammo.mag <= 0) {
      if (ammo && ammo.reserve > 0) this.tryReload(e);
      return;
    }
    const interval = 60 / def.rpm;
    if (!def.auto && !this.input.primaryHeld && e.isPlayer) return;
    e.nextFireAt = this.time + interval;
    ammo.mag -= 1;
    e.firedThisTick = true;

    for (let p = 0; p < def.pellets; p++) this.hitscan(e, def.spread + e.recoilSpread, def);

    e.recoilPitch += def.recoilKick;
    e.recoilSpread = Math.min(0.09, e.recoilSpread + def.recoilSpread);
    this.shotFlash = 0.055;
    SFX.playShoot(id);
  }

  /** 沿朝向的射线：先求墙体距离，再对每个敌人 AABB 求交，取最近的分区命中。 */
  private hitscan(e: Entity, spread: number, def: (typeof WEAPONS)[string]): void {
    const dir = new THREE.Vector3(
      -Math.sin(e.yaw) * Math.cos(e.pitch),
      Math.sin(e.pitch),
      -Math.cos(e.yaw) * Math.cos(e.pitch)
    ).normalize();
    if (spread > 0) {
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread * 0.65;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
    }
    const origin = new THREE.Vector3(e.pos.x, e.pos.y + EYE, e.pos.z);
    const wallDist = this.wallDistance(origin, dir, def.rangeFalloff[1] + 40);

    let bestDist = Infinity;
    let bestTarget: Entity | null = null;
    let bestZone: HitZone = 'chest';
    const ray = new THREE.Ray(origin, dir);
    const hitPoint = new THREE.Vector3();

    for (const other of this.entities) {
      if (!other.alive || other.team === e.team) continue;
      for (const hb of other.char.hitboxes()) {
        const p = ray.intersectBox(hb.box, hitPoint);
        if (!p) continue;
        const d = p.distanceTo(origin);
        if (d > def.rangeFalloff[1] + 40) continue;
        if (d < bestDist && d <= wallDist) {
          bestDist = d;
          bestTarget = other;
          bestZone = hb.zone;
        }
      }
    }

    const end = origin.clone().add(dir.clone().multiplyScalar(Math.min(wallDist, bestDist === Infinity ? wallDist : bestDist)));
    this.spawnTracer(origin, end);
    if (bestTarget) this.damage(bestTarget, e, def.damage, bestZone, def.id, bestDist);
  }

  /** 射线到最近墙体的距离（步进采样，单元尺寸内足够精确）。 */
  private wallDistance(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
    const step = 0.35;
    for (let d = 0; d <= maxDist; d += step) {
      const x = origin.x + dir.x * d;
      const y = origin.y + dir.y * d;
      const z = origin.z + dir.z * d;
      if (y < 0) return d;
      const h = cellHeight(worldToGx(x), worldToGy(z));
      if (h > y) return Math.max(0.1, d - step * 0.5);
    }
    return maxDist;
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.75 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
    if (this.tracers.length > 90) {
      const old = this.tracers.shift();
      if (old) {
        this.scene.remove(old.line);
        old.line.geometry.dispose();
        (old.line.material as THREE.Material).dispose();
      }
    }
  }

  private updateTracers(dt: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.07) * 0.75;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  /** 伤害结算：分区倍率、距离衰减、护甲与头盔。 */
  private damage(
    target: Entity,
    attacker: Entity | null,
    base: number,
    zone: HitZone,
    weaponId: string,
    distance = 0
  ): void {
    if (!target.alive) return;
    let dmg = base * ZONE_MULTIPLIER[zone];
    const def = WEAPONS[weaponId];
    if (def && def.rangeFalloff[1] > def.rangeFalloff[0]) {
      const [r0, r1] = def.rangeFalloff;
      if (distance > r1) dmg *= def.minDamageRatio;
      else if (distance > r0) {
        const t = (distance - r0) / (r1 - r0);
        dmg *= 1 - t * (1 - def.minDamageRatio);
      }
    }
    const headUnprotected = zone === 'head' && !target.helmet;
    if (target.armor > 0 && !headUnprotected) {
      const before = target.armor;
      target.armor = Math.max(0, target.armor - dmg * 0.5);
      const absorbed = before - target.armor;
      dmg -= absorbed * 0.5;
      const pen = def ? def.armorPenetration : 0.75;
      dmg *= 0.5 + pen * 0.5;
    }
    target.health -= dmg;

    if (target === this.controlled) SFX.playHurt();
    if (attacker === this.controlled) SFX.playHitMarker(zone === 'head');

    if (target.health <= 0) this.kill(target, attacker, weaponId, zone === 'head');
  }

  private kill(victim: Entity, killer: Entity | null, weaponId: string, headshot: boolean): void {
    victim.alive = false;
    victim.health = 0;
    victim.deaths += 1;
    victim.char.root.visible = false;
    if (killer) killer.kills += 1;
    const def = WEAPONS[weaponId];

    this.killFeed.unshift({
      id: this.killFeedId++,
      killer: killer ? killer.name : 'C4',
      victim: victim.name,
      killerTeam: killer ? killer.team : victim.team,
      victimTeam: victim.team,
      weapon: def ? def.name : weaponId,
      headshot
    });
    this.killFeed = this.killFeed.slice(0, 6);
    if (killer === this.controlled) SFX.playKill();

    if (victim.hasC4) this.round.dropC4(victim.pos.x, victim.pos.z);

    // 玩家阵亡 → 自动转入观察模式
    if (victim.isPlayer) {
      victim.isPlayer = false;
      const mates = this.entities.filter((e) => e.alive && e.team === victim.team);
      this.spectateIndex = 0;
      this.message = mates.length ? '你已阵亡 · Q 切换视角 · F 接管操控' : '你已阵亡';
      this.rebuildViewGun();
    }
  }

  private pruneDead(): void {
    for (const e of this.entities) {
      if (!e.alive && e.char.root.visible) e.char.root.visible = false;
    }
  }

  private beginNextRound(): void {
    this.round.round += 1;
    this.attackSite = Math.random() < 0.5 ? 'A' : 'B';
    this.respawnAll();
    this.applyLoadout();
    this.killFeed = [];
    this.round.startRound(this.pickC4Carrier());
    // 玩家重新控制「你」
    const me = this.entities[0];
    for (const e of this.entities) e.isPlayer = false;
    me.isPlayer = true;
    this.controlled = me;
    this.message = this.round.round === 1 ? '回合 1 · 手枪局' : `回合 ${this.round.round}`;
    SFX.playBeep('roundStart');
    this.rebuildViewGun();
  }

  // ────────────────────────── 相机与视图模型 ──────────────────────────

  private rebuildViewGun(): void {
    if (this.viewGun) {
      this.viewGroup.remove(this.viewGun);
      this.viewGun.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    const id = (this.controlled.weapons[this.controlled.activeSlot] as string) ?? 'knife';
    this.viewGun = buildGunMesh(id, true);
    // 视图模型按第一人称比例缩小并下移，避免遮挡画面中心
    this.viewGun.scale.setScalar(0.6);
    this.viewGun.position.set(0.3, -0.28, -0.62);
    this.viewGun.rotation.set(0, 0.08, 0);
    this.viewGroup.add(this.viewGun);
  }

  private updateCamera(dt: number): void {
    const c = this.controlled;
    if (this.viewGun && !c.isPlayer) {
      this.viewGun.visible = false;
    } else if (this.viewGun) {
      this.viewGun.visible = true;
      const bob = Math.sin(this.time * 8) * 0.006 * Math.min(1, Math.hypot(c.vel.x, c.vel.z) / 5);
      this.viewGun.position.y = -0.24 + bob;
    }

    c.recoilPitch *= Math.max(0, 1 - dt * 7);
    const def = weaponOf(c);
    c.recoilSpread = Math.max(0, c.recoilSpread - dt * (def ? def.recoilRecover : 1) * 0.06);

    const eyeY = c.pos.y + EYE - Math.min(0.16, this.shotFlash > 0 ? 0.01 : 0);
    this.camera.position.set(c.pos.x, eyeY, c.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(c.yaw);
    this.camera.rotateX(clamp(c.pitch + c.recoilPitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02));
    this.camera.fov = c.scoped ? 28 : 90;
    this.camera.updateProjectionMatrix();

    this.shotFlash = Math.max(0, this.shotFlash - dt);
    this.muzzleLight.intensity = this.shotFlash > 0 ? 9 : 0;
    this.muzzleLight.position.set(0.2, -0.1, -0.6);
  }

  // ────────────────────────── HUD ──────────────────────────

  private updateHud(dt: number): void {
    this.hudAcc += dt;
    if (this.hudAcc < 1 / 15) return;
    this.hudAcc = 0;
    this.publish();
  }

  private publish(force = false): void {
    void force;
    const c = this.controlled;
    const w = weaponOf(c);
    const blips: MinimapBlip[] = [];
    const eye = new THREE.Vector3(c.pos.x, c.pos.y + EYE, c.pos.z);
    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e === c) {
        blips.push({ x: e.pos.x, z: e.pos.z, kind: 'self' });
      } else if (e.team === c.team) {
        blips.push({ x: e.pos.x, z: e.pos.z, kind: 'mate' });
      } else {
        // 只有被看见的敌人才上小地图
        const to = { x: e.pos.x, y: e.pos.y + 1.4, z: e.pos.z };
        const visible = !blockedLine(eye.x, eye.z, eye.y, to.x, to.z, to.y);
        if (visible) blips.push({ x: e.pos.x, z: e.pos.z, kind: 'enemy' });
      }
    }
    if (this.round.c4State === 'planted') {
      blips.push({ x: this.round.c4X, z: this.round.c4Z, kind: 'c4' });
    } else if (this.round.c4State === 'dropped') {
      blips.push({ x: this.round.c4X, z: this.round.c4Z, kind: 'c4' });
    } else if (this.round.c4State === 'carried') {
      const carrier = this.entities.find((e) => e.hasC4);
      if (carrier && carrier.team === c.team) blips.push({ x: carrier.pos.x, z: carrier.pos.z, kind: 'c4' });
      else if (carrier && !blockedLine(eye.x, eye.z, eye.y, carrier.pos.x, carrier.pos.z, carrier.pos.y + 1.4)) {
        blips.push({ x: carrier.pos.x, z: carrier.pos.z, kind: 'c4' });
      }
    }

    const weapons = (['primary', 'secondary', 'melee'] as Slot[])
      .filter((s) => c.weapons[s])
      .map((s) => {
        const id = c.weapons[s] as string;
        const a = c.ammo[id] ?? { mag: 0, reserve: 0 };
        return { id, name: WEAPONS[id].name, mag: a.mag, reserve: a.reserve, slot: s };
      });

    const state: HudState = {
      phase: this.round.phase,
      round: this.round.round,
      timeLeft: Math.max(0, this.round.timer),
      score: { CT: this.round.score.CT, T: this.round.score.T },
      aliveCT: this.entities.filter((e) => e.team === 'CT' && e.alive).length,
      aliveT: this.entities.filter((e) => e.team === 'T' && e.alive).length,
      health: Math.max(0, Math.round(c.health)),
      armor: Math.max(0, Math.round(c.armor)),
      hasHelmet: c.helmet,
      isPistolRound: this.round.isPistolRound,
      weapons,
      activeSlot: c.activeSlot,
      scoped: c.scoped && (w?.canScope ?? false),
      reloading: c.reloadLeft > 0,
      killFeed: this.killFeed,
      message: this.message,
      playerAlive: c.alive,
      spectating: !c.isPlayer,
      blips,
      c4: {
        state: this.round.c4State,
        x: this.round.c4X,
        z: this.round.c4Z,
        timer: this.round.bombTimer
      },
      bombSite: bombSiteAt(worldToGx(c.pos.x), worldToGy(c.pos.z)),
      plantProgress: this.round.plantProgress / 3.2,
      defuseProgress: this.round.defuseProgress / 10
    };
    publish(state);
  }

  private inPlantZone(e: Entity): boolean {
    const site = bombSiteAt(worldToGx(e.pos.x), worldToGy(e.pos.z));
    if (!site) return false;
    this.round.c4X = e.pos.x;
    this.round.c4Z = e.pos.z;
    return true;
  }

  getEntityByName(name: string): Entity | null {
    return this.entities.find((e) => e.name === name) ?? null;
  }

  // ────────────────────────── AiWorld 实现 ──────────────────────────

  now(): number {
    return this.time;
  }

  byId(id: number): Entity | null {
    return this.entities.find((e) => e.id === id) ?? null;
  }

  private sight(e: Entity): SightTarget {
    return {
      id: e.id,
      x: e.pos.x,
      y: e.pos.y,
      z: e.pos.z,
      headY: e.pos.y + 1.72,
      alive: e.alive,
      team: e.team
    };
  }

  enemiesOf(team: Team): SightTarget[] {
    return this.entities.filter((e) => e.team !== team).map((e) => this.sight(e));
  }

  alliesOf(team: Team): SightTarget[] {
    return this.entities.filter((e) => e.team === team).map((e) => this.sight(e));
  }

  hasLineOfSight(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
  ): boolean {
    // 额外对掩体高度做采样，掩体后的目标看不见
    if (blockedLine(from.x, from.z, from.y, to.x, to.z, to.y)) return false;
    return true;
  }

  objectiveFor(team: Team): { x: number; z: number } {
    if (team === 'CT' && this.round.c4State === 'planted') {
      return { x: this.round.c4X, z: this.round.c4Z };
    }
    const area = this.attackSite === 'A' ? AREAS.aSite : AREAS.bSite;
    return areaCenterWorld(area);
  }

  spawnOf(team: Team): { x: number; z: number } {
    return team === 'CT' ? { ...SPAWN_CT } : { ...SPAWN_T };
  }

  walkable(x: number, z: number): boolean {
    return cellHeight(worldToGx(x), worldToGy(z)) < WALL_H;
  }

  fire(bot: Entity): void {
    this.tryFire(bot);
  }

  meleeAttack(bot: Entity): void {
    this.tryFire(bot);
  }

  patrolPoints(): { x: number; z: number }[] {
    return [
      areaCenterWorld(AREAS.tSpawn),
      areaCenterWorld(AREAS.aLong),
      areaCenterWorld(AREAS.aSite),
      areaCenterWorld(AREAS.catwalk),
      areaCenterWorld(AREAS.mid),
      areaCenterWorld(AREAS.midTop),
      areaCenterWorld(AREAS.ctSpawn),
      areaCenterWorld(AREAS.bTunnels),
      areaCenterWorld(AREAS.bSite),
      areaCenterWorld(AREAS.tToALong)
    ];
  }

  c4Target(): { x: number; z: number } | null {
    if (this.round.c4State === 'planted') return { x: this.round.c4X, z: this.round.c4Z };
    return null;
  }

  get bombTimerTotal(): number {
    return BOMB_TIME;
  }

  /** 供外部（调试/自检）读取的世界快照。 */
  snapshot(): { alive: { team: Team; x: number; z: number }[]; phase: string; score: { CT: number; T: number } } {
    return {
      alive: this.entities.filter((e) => e.alive).map((e) => ({ team: e.team, x: e.pos.x, z: e.pos.z })),
      phase: this.round.phase,
      score: { ...this.round.score }
    };
  }

  /** 无头自检：直接推进 n 秒的模拟（不开渲染循环）。 */
  simulate(seconds: number, step = 1 / 30): void {
    const n = Math.floor(seconds / step);
    for (let i = 0; i < n; i++) {
      this.time += step;
      if (this.roundOverTimer > 0) {
        this.roundOverTimer -= step;
        if (this.roundOverTimer <= 0) this.beginNextRound();
      }
      this.updateBots(step);
      this.updatePhysics(step);
      this.updateProbes(step);
      const aliveCT = this.entities.filter((e) => e.team === 'CT' && e.alive).length;
      const aliveT = this.entities.filter((e) => e.team === 'T' && e.alive).length;
      this.round.tick(step, aliveCT, aliveT);
    }
  }

  get crates(): number {
    return CRATE_H;
  }
  get cellSize(): number {
    return CELL;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
