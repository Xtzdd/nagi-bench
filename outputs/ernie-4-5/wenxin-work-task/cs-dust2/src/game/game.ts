import * as THREE from 'three';
import { buildMap, MapData } from './map';
import { initRenderer, buildGunModel, SceneAssets } from './render';
import {
  PlayerLike,
  createPlayer,
  resetPlayerForRound,
  collideAndMove,
  currentWeapon,
  switchWeapon,
  applyDamage,
  PLAYER_EYE_HEIGHT,
  RUN_SPEED,
  WALK_SPEED,
  JUMP_SPEED,
} from './player';
import { AI, createAI, updateAI } from './ai';
import {
  Bullet,
  KillEvent,
  C4,
  WeaponId,
  Box,
  HUDSnapshot,
  Team,
  HitZone,
} from './types';
import { WEAPONS, HIT_MULTIPLIERS, createWeaponState } from './weapons';
import {
  createC4,
  assignBombToRandomT,
  updateC4,
  startPlant,
  startDefuse,
} from './c4';
import {
  initAudio,
  resumeAudio,
  fireAK47,
  fireM4A4,
  fireAWP,
  firePistol,
  fireDeagle,
  reloadSound,
  footstepSound,
  scopeSound,
  hitSound,
  startC4Beep,
  stopC4Beep,
  explosionSound,
  killSound,
} from './audio';
import { drawMinimap } from './minimap';

export interface GameCallbacks {
  onHudUpdate: (snap: HUDSnapshot) => void;
  onRoundEnd: (winner: Team, reason: string) => void;
}

interface Input {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  walk: boolean;
  shoot: boolean;
  reload: boolean;
  use: boolean;
  weapon1: boolean;
  weapon2: boolean;
  weapon3: boolean;
  scope: boolean;
}

interface GameRound {
  number: number;
  state: 'buy' | 'live' | 'ended' | 'freeze';
  timer: number;
  freezeTime: number;
  buyTime: number;
  tScore: number;
  ctScore: number;
  endReason: string;
  winner: Team | null;
}

export class Game {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  minimapCanvas: HTMLCanvasElement;
  callbacks: GameCallbacks;

  assets!: SceneAssets;
  map!: MapData;
  clock = new THREE.Clock();

  players: PlayerLike[] = [];
  ais: Map<number, AI> = new Map();
  bullets: Bullet[] = [];
  c4: C4 = createC4();

  localPlayer!: PlayerLike;
  cameraHolder = new THREE.Object3D();
  gunGroup = new THREE.Group();
  gunMesh: THREE.Object3D | null = null;
  muzzleFlash: THREE.Mesh | null = null;

  round: GameRound = {
    number: 0,
    state: 'ended',
    timer: 0,
    freezeTime: 0,
    buyTime: 0,
    tScore: 0,
    ctScore: 0,
    endReason: '',
    winner: null,
  };

  input: Input = {
    forward: false, back: false, left: false, right: false,
    jump: false, walk: false, shoot: false, reload: false, use: false,
    weapon1: false, weapon2: false, weapon3: false, scope: false,
  };

  killfeed: KillEvent[] = [];
  gameTime = 0;
  running = false;
  animationId = 0;

  // Spectator
  spectatorTargetId: number | null = null;

  // Recoil
  recoilOffsetX = 0;
  recoilOffsetY = 0;
  recoilVisualKick = 0;

  // Footstep timer
  footstepTimer = 0;

  // Event handlers
  private _onMouseMove = (e: MouseEvent) => {};
  private _onMouseDown = (e: MouseEvent) => {};
  private _onMouseUp = (e: MouseEvent) => {};
  private _onKeyDown = (e: KeyboardEvent) => {};
  private _onKeyUp = (e: KeyboardEvent) => {};
  private _onResize = () => {};
  private _onPointerLockChange = () => {};

  constructor(container: HTMLElement, minimapCanvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.container = container;
    this.canvas = container as any;
    this.minimapCanvas = minimapCanvas;
    this.callbacks = cb;
    this.init();
  }

  init() {
    initAudio();
    this.assets = initRenderer(this.container);
    this.map = buildMap();
    this.buildMapMeshes();
    this.buildPlayers();

    // Gun model attached to camera
    this.gunGroup.position.set(0.25, -0.22, -0.5);
    this.assets.camera.add(this.gunGroup);
    this.assets.scene.add(this.assets.camera);
    this.attachGun('usp');

    // Muzzle flash
    const flashGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd77, transparent: true, opacity: 0 });
    this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlash.position.set(0, -0.02, -0.8);
    this.gunGroup.add(this.muzzleFlash);

    this.setupInput();
    this.startNewRound(true);
  }

  buildMapMeshes() {
    const scene = this.assets.scene;
    for (const b of this.map.boxes) {
      let mat: THREE.Material;
      if (b.type === 'ground') mat = this.assets.groundMaterial;
      else if (b.type === 'crate_metal') mat = this.assets.metalCrateMaterial;
      else if (b.type === 'crate_wood') mat = this.assets.woodCrateMaterial;
      else if (b.type === 'door') mat = this.assets.doorMaterial;
      else mat = this.assets.wallMaterial;
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.x, b.y, b.z);
      scene.add(mesh);
    }
    // Bomb site markers (semi-transparent colored pads)
    const padA = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.2 })
    );
    padA.rotation.x = -Math.PI / 2;
    padA.position.set(this.map.aSiteCenter.x, 0.01, this.map.aSiteCenter.z);
    scene.add(padA);
    const padB = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0x4070ff, transparent: true, opacity: 0.2 })
    );
    padB.rotation.x = -Math.PI / 2;
    padB.position.set(this.map.bSiteCenter.x, 0.01, this.map.bSiteCenter.z);
    scene.add(padB);
  }

  buildPlayers() {
    // Names
    const tNames = ['Phoenix', 'Guerilla', 'Separatist', 'Militia', 'Bandit'];
    const ctNames = ['Seal', 'GIGN', 'SAS', 'GSG9', 'IDF'];

    // Local player on CT for simplicity (id=0)
    this.localPlayer = createPlayer(
      { id: 0, name: 'You', team: 'CT', isLocal: true, isAI: false, spawn: this.map.ctSpawn },
      this.assets.scene
    );
    this.players.push(this.localPlayer);

    // Remaining 4 CT AI
    for (let i = 1; i <= 4; i++) {
      const sp = {
        x: this.map.ctSpawn.x + (i - 2) * 1.2,
        y: 0,
        z: this.map.ctSpawn.z + (i % 2 === 0 ? 2 : -2),
      };
      const pl = createPlayer(
        { id: i, name: ctNames[i - 1], team: 'CT', isLocal: false, isAI: true, spawn: sp },
        this.assets.scene
      );
      this.players.push(pl);
      this.ais.set(pl.id, createAI(pl.id));
    }
    // 5 T
    for (let i = 5; i <= 9; i++) {
      const sp = {
        x: this.map.tSpawn.x + (i - 7) * 1.2,
        y: 0,
        z: this.map.tSpawn.z + ((i - 5) % 2 === 0 ? 2 : -2),
      };
      const pl = createPlayer(
        { id: i, name: tNames[i - 5], team: 'T', isLocal: false, isAI: true, spawn: sp },
        this.assets.scene
      );
      this.players.push(pl);
      this.ais.set(pl.id, createAI(pl.id));
    }
  }

  attachGun(weaponId: WeaponId) {
    if (this.gunMesh) {
      this.gunGroup.remove(this.gunMesh);
    }
    this.gunMesh = buildGunModel(weaponId, this.assets.gunMaterials);
    this.gunGroup.add(this.gunMesh);
  }

  setupInput() {
    this._onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== this.assets.renderer.domElement) return;
      const sens = 0.0022;
      this.localPlayer.yaw -= e.movementX * sens;
      this.localPlayer.pitch -= e.movementY * sens;
      this.localPlayer.pitch = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, this.localPlayer.pitch)
      );
    };

    this._onMouseDown = (e: MouseEvent) => {
      resumeAudio();
      if (document.pointerLockElement !== this.assets.renderer.domElement) {
        this.assets.renderer.domElement.requestPointerLock();
        return;
      }
      if (e.button === 0) this.input.shoot = true;
      if (e.button === 2) this.input.scope = true;
    };
    this._onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.input.shoot = false;
      if (e.button === 2) this.input.scope = false;
    };

    this._onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this.input.forward = true; break;
        case 'KeyS': this.input.back = true; break;
        case 'KeyA': this.input.left = true; break;
        case 'KeyD': this.input.right = true; break;
        case 'Space': this.input.jump = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.input.walk = true; break;
        case 'KeyR': this.input.reload = true; break;
        case 'KeyE': this.input.use = true; break;
        case 'Digit1': this.input.weapon1 = true; break;
        case 'Digit2': this.input.weapon2 = true; break;
        case 'Digit3': this.input.weapon3 = true; break;
      }
      // Spectator switching after death
      if (!this.localPlayer.alive) {
        if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
          const idx = parseInt(e.code.charAt(5)) - 1;
          this.cycleSpectator(idx);
        }
      }
    };
    this._onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this.input.forward = false; break;
        case 'KeyS': this.input.back = false; break;
        case 'KeyA': this.input.left = false; break;
        case 'KeyD': this.input.right = false; break;
        case 'Space': this.input.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.input.walk = false; break;
        case 'KeyR': this.input.reload = false; break;
        case 'KeyE': this.input.use = false; break;
        case 'Digit1': this.input.weapon1 = false; break;
        case 'Digit2': this.input.weapon2 = false; break;
        case 'Digit3': this.input.weapon3 = false; break;
      }
    };

    this._onResize = () => {
      this.assets.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.assets.camera.updateProjectionMatrix();
      this.assets.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    };

    this._onPointerLockChange = () => {
      // nothing required
    };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  disposeInput() {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }

  startNewRound(first: boolean = false) {
    this.round.number++;
    this.round.state = 'freeze';
    this.round.freezeTime = first ? 1 : 3;
    this.round.timer = this.round.freezeTime;
    this.round.winner = null;
    this.round.endReason = '';

    const pistolRound = this.round.number === 1;

    // Reset players
    for (const p of this.players) {
      const spawn = p.team === 'T' ? this.map.tSpawn : this.map.ctSpawn;
      // scatter slightly
      const sc = {
        x: spawn.x + (p.id - (p.team === 'T' ? 7 : 2)) * 1.0,
        y: 0,
        z: spawn.z + (((p.id % 2) === 0 ? 1 : -1) * (1.5 + (p.id % 3))),
      };
      resetPlayerForRound(p, sc, pistolRound);
      if (p.isAI) {
        const ai = this.ais.get(p.id)!;
        ai.path = [];
        ai.pathIdx = 0;
        ai.state = 'patrol';
        ai.patrolTarget = null;
        ai.seenEnemyPos = null;
      }
    }
    // Give buy money baseline (simplified: $800 first round)
    if (pistolRound) {
      for (const p of this.players) p.money = 800;
    } else {
      for (const p of this.players) {
        if (p.money < 16000) p.money += 3400; // round end bonus approx
      }
    }

    // Assign C4 to random T
    this.c4 = createC4();
    assignBombToRandomT(this.players, this.c4);

    // Clear bullets
    for (const b of this.bullets) {
      if (b.tracer) this.assets.scene.remove(b.tracer);
    }
    this.bullets = [];

    // Reset spectator
    this.spectatorTargetId = null;

    stopC4Beep();
  }

  buyWeaponsForLocalPrimary() {
    // placeholder: in pistol round skip; otherwise, buy primary based on team
    if (this.round.number === 1) return;
    const p = this.localPlayer;
    // If player only has knife+pistol, give them a primary
    if (p.weapons.length < 3) {
      const primaryId: WeaponId = p.team === 'T' ? 'ak47' : 'm4a4';
      // Check money
      const primaryCost = p.team === 'T' ? 2700 : 3100;
      if (p.money >= primaryCost + 650) {
        p.weapons.splice(1, 0, createWeaponState(primaryId));
        p.money -= primaryCost;
        // buy armor + helmet
        p.armor = 100;
        p.hasHelmet = true;
        p.money -= 650;
      }
    }
  }

  start() {
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
    stopC4Beep();
    this.disposeInput();
  }

  cycleSpectator(idx: number) {
    const teammates = this.players.filter(
      (p) => p.team === this.localPlayer.team && p.alive && p.id !== this.localPlayer.id
    );
    if (teammates.length === 0) return;
    const target = teammates[idx % teammates.length];
    if (target) this.spectatorTargetId = target.id;
  }

  getCurrentViewPlayer(): PlayerLike {
    if (this.localPlayer.alive) return this.localPlayer;
    if (this.spectatorTargetId !== null) {
      const sp = this.players.find((p) => p.id === this.spectatorTargetId);
      if (sp && sp.alive) return sp;
    }
    // fallback: first alive teammate
    const live = this.players.find((p) => p.team === this.localPlayer.team && p.alive);
    if (live) {
      this.spectatorTargetId = live.id;
      return live;
    }
    return this.localPlayer;
  }

  fireWeapon(p: PlayerLike) {
    const w = currentWeapon(p);
    const now = this.gameTime;
    const minInterval = 60 / w.config.fireRate;
    if (w.reloading) return;
    if (w.config.melee) {
      // knife melee - raycast short range
      this.doRaycast(p, 1.8, w.config.damage, w.config.id, true);
      w.lastShotTime = now;
      return;
    }
    if (w.ammoInMag <= 0) {
      // auto reload
      if (w.reserveAmmo > 0 && !w.reloading) {
        this.beginReload(p);
      }
      return;
    }
    if (now - w.lastShotTime < minInterval) return;
    w.lastShotTime = now;
    w.ammoInMag--;
    w.recoilAccum = Math.min(w.recoilAccum + 1, 20);

    // apply recoil to local player (adds pitch up / horizontal sway)
    if (p.isLocal && p.alive) {
      this.recoilOffsetY += w.config.recoilVertical * 0.01;
      this.recoilOffsetX += (Math.random() - 0.5) * w.config.recoilHorizontal * 0.015;
      this.localPlayer.pitch -= w.config.recoilVertical * 0.008;
      this.localPlayer.yaw += (Math.random() - 0.5) * w.config.recoilHorizontal * 0.012;
      this.localPlayer.pitch = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, this.localPlayer.pitch)
      );
      this.recoilVisualKick = 0.05;
    }

    // play sound
    if (p.isLocal || this.distanceToLocal(p.pos) < 50) {
      const snd = this.gunSound(w.config.id);
      snd.start();
    }

    // visual muzzle flash
    if (p.isLocal && this.muzzleFlash) {
      (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1;
    }

    // bullet direction with spread
    this.doRaycast(
      p,
      w.config.range,
      w.config.damage,
      w.config.id,
      false,
      w.config.spread + w.recoilAccum * 0.001
    );

    // empty mag auto reload
    if (w.ammoInMag === 0 && w.reserveAmmo > 0) {
      this.beginReload(p);
    }
  }

  gunSound(id: WeaponId) {
    switch (id) {
      case 'ak47': return fireAK47();
      case 'm4a4': return fireM4A4();
      case 'awp': return fireAWP();
      case 'deagle': return fireDeagle();
      case 'glock':
      case 'usp':
        return firePistol();
      default: return firePistol();
    }
  }

  beginReload(p: PlayerLike) {
    const w = currentWeapon(p);
    if (w.reloading) return;
    if (w.ammoInMag === w.config.magSize) return;
    if (w.reserveAmmo <= 0) return;
    w.reloading = true;
    w.reloadTimer = 0;
    if (p.isLocal) reloadSound().start();
  }

  finishReload(p: PlayerLike) {
    const w = currentWeapon(p);
    const need = w.config.magSize - w.ammoInMag;
    const give = Math.min(need, w.reserveAmmo);
    w.ammoInMag += give;
    w.reserveAmmo -= give;
    w.reloading = false;
    w.recoilAccum = 0;
  }

  doRaycast(
    p: PlayerLike,
    range: number,
    baseDamage: number,
    weaponId: WeaponId,
    isMelee: boolean,
    spreadRad: number = 0
  ) {
    const eye = {
      x: p.pos.x,
      y: p.pos.y + PLAYER_EYE_HEIGHT,
      z: p.pos.z,
    };
    // direction based on yaw/pitch
    const cosP = Math.cos(p.pitch);
    const sinP = Math.sin(p.pitch);
    const cosY = Math.cos(p.yaw);
    const sinY = Math.sin(p.yaw);
    let dx = sinY * cosP;
    let dy = -sinP;
    let dz = cosY * cosP;
    if (!isMelee) {
      // apply random spread
      const ang1 = (Math.random() - 0.5) * spreadRad * 2;
      const ang2 = (Math.random() - 0.5) * spreadRad * 2;
      // perturb around forward
      dx += ang1;
      dz += ang2;
      const n = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= n; dy /= n; dz /= n;
    }

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(eye.x, eye.y, eye.z),
      new THREE.Vector3(dx, dy, dz),
      0,
      range
    );

    // Check intersections with players' hitbox meshes AND map boxes (using box approximation)
    let bestT = range;
    let hitPlayer: PlayerLike | null = null;
    let hitZone: HitZone = 'chest';

    for (const op of this.players) {
      if (!op.alive) continue;
      if (op.id === p.id) continue;
      if (isMelee && op.team === p.team) continue; // no melee team damage
      for (const hb of op.hitboxes) {
        const worldPos = new THREE.Vector3();
        hb.mesh.getWorldPosition(worldPos);
        // approximate hitbox as a box around worldPos using size
        const sz = hb.size!;
        const minP = new THREE.Vector3(worldPos.x - sz.w / 2, worldPos.y - sz.h / 2, worldPos.z - sz.d / 2);
        const maxP = new THREE.Vector3(worldPos.x + sz.w / 2, worldPos.y + sz.h / 2, worldPos.z + sz.d / 2);
        const box = new THREE.Box3(minP, maxP);
        const hit = raycaster.ray.intersectBox(box, new THREE.Vector3());
        if (hit) {
          const t = hit.distanceTo(new THREE.Vector3(eye.x, eye.y, eye.z));
          if (t < bestT) {
            bestT = t;
            hitPlayer = op;
            hitZone = hb.zone;
          }
        }
      }
    }

    // Check walls/crates: treat them as blocking
    let wallT = range;
    for (const b of this.map.boxes) {
      if (b.type === 'ground' || b.type === 'door') continue;
      const minP = new THREE.Vector3(b.x - b.w / 2, b.y - b.h / 2, b.z - b.d / 2);
      const maxP = new THREE.Vector3(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2);
      const box = new THREE.Box3(minP, maxP);
      const hit = raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (hit) {
        const t = hit.distanceTo(new THREE.Vector3(eye.x, eye.y, eye.z));
        if (t < wallT) wallT = t;
      }
    }

    if (hitPlayer && bestT < wallT) {
      // Apply damage
      const mult = HIT_MULTIPLIERS[hitZone];
      let dmg = baseDamage * mult;
      // Range falloff
      const distFactor = Math.max(0.5, 1 - bestT / 100);
      dmg *= distFactor;
      // Helmet protection: AWP still headshots kill, others reduced
      const helmetProtects = !(weaponId === 'awp' && hitZone === 'head');
      const res = applyDamage(hitPlayer, dmg, hitZone, helmetProtects);
      hitPlayer.lastDamageTime = this.gameTime;
      hitPlayer.lastAttackerId = p.id;
      hitSound().start();
      if (res.killed) {
        // register kill
        const ke: KillEvent = {
          killer: p.name,
          victim: hitPlayer.name,
          weapon: weaponId,
          killerTeam: p.team,
          victimTeam: hitPlayer.team,
          headshot: res.headshot,
          time: this.gameTime,
        };
        this.killfeed.unshift(ke);
        if (this.killfeed.length > 5) this.killfeed.length = 5;
        if (p.isLocal) killSound().start();
        // money award
        p.money = Math.min(16000, p.money + 300);
        // drop bomb if carrier died
        if (this.c4.state === 'carried' && this.c4.carrierId === hitPlayer.id) {
          this.c4.state = 'dropped';
          this.c4.carrierId = null;
          this.c4.pos = { x: hitPlayer.pos.x, y: 0.2, z: hitPlayer.pos.z };
        }
      }
    }

    // Add tracer line from muzzle to impact point
    const tracerEnd = bestT < wallT ? bestT : wallT;
    const endPoint = {
      x: eye.x + dx * tracerEnd,
      y: eye.y + dy * tracerEnd,
      z: eye.z + dz * tracerEnd,
    };
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(eye.x, eye.y - 0.1, eye.z).add(
        new THREE.Vector3(dx, dy, dz).multiplyScalar(0.5)
      ),
      new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z),
    ]);
    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xffdd77,
      transparent: true,
      opacity: 0.7,
    });
    const line = new THREE.Line(tracerGeo, tracerMat);
    this.assets.scene.add(line);
    setTimeout(() => this.assets.scene.remove(line), 60);
  }

  distanceToLocal(pos: { x: number; y: number; z: number }) {
    return Math.hypot(pos.x - this.localPlayer.pos.x, pos.z - this.localPlayer.pos.z);
  }

  updatePlayerMovement(p: PlayerLike, dt: number) {
    if (!p.alive) {
      p.vel.x = 0;
      p.vel.z = 0;
      collideAndMove(p, this.map.boxes, dt);
      return;
    }
    // AI moveDir set elsewhere; for local compute from input
    if (!p.isAI) {
      let mx = 0, mz = 0;
      if (this.input.forward) mz += 1;
      if (this.input.back) mz -= 1;
      if (this.input.right) mx += 1;
      if (this.input.left) mx -= 1;
      const len = Math.hypot(mx, mz);
      if (len > 0) { mx /= len; mz /= len; }
      const speed = this.input.walk ? WALK_SPEED : RUN_SPEED;
      // rotate by yaw
      const cosY = Math.cos(p.yaw);
      const sinY = Math.sin(p.yaw);
      p.vel.x = (sinY * mz + cosY * mx) * speed;
      p.vel.z = (cosY * mz - sinY * mx) * speed;

      if (this.input.jump && p.onGround) {
        p.vel.y = JUMP_SPEED;
        p.onGround = false;
      }
      // footstep sounds
      if (p.onGround && (Math.abs(p.vel.x) > 0.5 || Math.abs(p.vel.z) > 0.5)) {
        this.footstepTimer -= dt;
        const stepInterval = this.input.walk ? 0.6 : 0.4;
        if (this.footstepTimer <= 0) {
          footstepSound('sand').start();
          this.footstepTimer = stepInterval;
        }
      }
    }
    collideAndMove(p, this.map.boxes, dt);
  }

  updateWeapons(p: PlayerLike, dt: number) {
    if (!p.alive) return;
    const w = currentWeapon(p);
    if (w.reloading) {
      w.reloadTimer += dt;
      if (w.reloadTimer >= w.config.reloadTime) {
        this.finishReload(p);
      }
    }
    // recoil decay
    w.recoilAccum = Math.max(0, w.recoilAccum - dt * 8);
  }

  handleLocalInput(dt: number) {
    const p = this.localPlayer;
    if (!p.alive) return;
    // weapon switching
    if (this.input.weapon1 && p.weapons[0]) switchWeapon(p, 0);
    if (this.input.weapon2 && p.weapons[1]) switchWeapon(p, 1);
    if (this.input.weapon3 && p.weapons[2]) switchWeapon(p, 2);
    // reset single-shot inputs after processing
    this.input.weapon1 = this.input.weapon2 = this.input.weapon3 = false;

    if (this.input.reload) {
      const w = currentWeapon(p);
      if (!w.reloading && w.ammoInMag < w.config.magSize && w.reserveAmmo > 0 && !w.config.melee) {
        this.beginReload(p);
      }
      this.input.reload = false;
    }

    // AWP scope toggle
    const w = currentWeapon(p);
    if (this.input.scope && w.config.scope) {
      if (!w.scoped) {
        w.scoped = true;
        this.assets.camera.fov = 30;
        this.assets.camera.updateProjectionMatrix();
        scopeSound().start();
      } else {
        w.scoped = false;
        this.assets.camera.fov = 75;
        this.assets.camera.updateProjectionMatrix();
      }
      this.input.scope = false;
    } else if (this.input.scope && !w.config.scope) {
      // no-op
      this.input.scope = false;
    }

    // Firing
    if (w.config.automatic) {
      if (this.input.shoot) this.fireWeapon(p);
    } else {
      if (this.input.shoot && !p.shootInput) {
        this.fireWeapon(p);
      }
    }
    p.shootInput = this.input.shoot;

    // Use key (plant/defuse)
    if (this.input.use) {
      this.handleUseKey(p);
      this.input.use = false;
    }
  }

  handleUseKey(p: PlayerLike) {
    // Plant
    if (
      this.c4.state === 'carried' &&
      this.c4.carrierId === p.id &&
      p.team === 'T'
    ) {
      if (startPlant(this.c4, p, this.map)) {
        // started planting; handled in update
      }
    }
    // Defuse
    if (this.c4.state === 'active' && p.team === 'CT') {
      startDefuse(this.c4, p);
    }
  }

  updateCamera(dt: number) {
    const vp = this.getCurrentViewPlayer();
    const eyeY = vp.pos.y + PLAYER_EYE_HEIGHT;
    // First-person camera attached to viewed player
    this.assets.camera.position.set(vp.pos.x, eyeY, vp.pos.z);
    this.assets.camera.rotation.order = 'YXZ';
    if (vp.isLocal && vp.alive) {
      this.assets.camera.rotation.y = vp.yaw;
      this.assets.camera.rotation.x = vp.pitch;
    } else {
      // spectating: use viewed player's yaw/pitch
      this.assets.camera.rotation.y = vp.yaw;
      this.assets.camera.rotation.x = vp.pitch;
    }

    // Recoil recovery (camera)
    this.recoilOffsetX *= Math.pow(0.001, dt);
    this.recoilOffsetY *= Math.pow(0.001, dt);

    // Gun visual recoil
    if (this.recoilVisualKick > 0) {
      this.gunGroup.position.z = -0.5 - this.recoilVisualKick;
      this.gunGroup.position.y = -0.22 - this.recoilVisualKick * 0.5;
      this.recoilVisualKick -= dt * 0.5;
      if (this.recoilVisualKick < 0) this.recoilVisualKick = 0;
    } else {
      this.gunGroup.position.z = -0.5;
      this.gunGroup.position.y = -0.22;
    }

    // Hide local player body (first person)
    vp.group.visible = false;
    // Update gun model
    const w = vp.alive ? currentWeapon(vp) : null;
    if (w && (vp.isLocal || this.spectatorTargetId === null)) {
      if (this.gunMesh && this.gunMesh.name !== w.config.id) {
        this.attachGun(w.config.id);
      }
      // show gun only in own view
      this.gunGroup.visible = vp.isLocal && vp.alive;
    } else {
      this.gunGroup.visible = false;
    }

    // Muzzle flash fade
    if (this.muzzleFlash) {
      const mat = this.muzzleFlash.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 8);
    }
  }

  checkRoundEnd() {
    if (this.round.state === 'ended') return;
    const tAlive = this.players.filter((p) => p.team === 'T' && p.alive).length;
    const ctAlive = this.players.filter((p) => p.team === 'CT' && p.alive).length;
    if (this.c4.state === 'exploded') {
      this.endRound('T', 'Bomb exploded');
    } else if (this.c4.state === 'defused') {
      this.endRound('CT', 'Bomb defused');
    } else if (tAlive === 0) {
      this.endRound('CT', 'T eliminated');
    } else if (ctAlive === 0 && this.c4.state !== 'active') {
      this.endRound('T', 'CT eliminated');
    } else if (this.round.timer <= 0 && this.round.state === 'live') {
      // time out: CT wins if bomb not planted
      if (this.c4.state === 'active') return;
      this.endRound('CT', 'Time ran out');
    }
  }

  endRound(winner: Team, reason: string) {
    if (this.round.state === 'ended') return;
    this.round.state = 'ended';
    this.round.winner = winner;
    this.round.endReason = reason;
    if (winner === 'T') this.round.tScore++;
    else this.round.ctScore++;
    stopC4Beep();
    this.callbacks.onRoundEnd(winner, reason);
    // Schedule next round after 5 seconds
    setTimeout(() => {
      if (!this.running) return;
      this.startNewRound(false);
    }, 5000);
  }

  explodeBomb() {
    explosionSound().start();
    const bp = this.c4.pos;
    const RADIUS = 8;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.pos.x - bp.x, p.pos.z - bp.z);
      if (d < RADIUS) {
        const dmg = 200 * (1 - d / RADIUS);
        p.hp -= dmg;
        if (p.hp <= 0) {
          p.hp = 0;
          p.alive = false;
          p.group.visible = false;
          // record suicide by bomb
          this.killfeed.unshift({
            killer: 'C4',
            victim: p.name,
            weapon: 'c4',
            killerTeam: 'T',
            victimTeam: p.team,
            headshot: false,
            time: this.gameTime,
          });
          if (this.killfeed.length > 5) this.killfeed.length = 5;
          if (this.c4.state === 'carried' && this.c4.carrierId === p.id) {
            this.c4.carrierId = null;
          }
        }
      }
    }
    // Create visual explosion
    const exp = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.9 })
    );
    exp.position.set(bp.x, 1, bp.z);
    this.assets.scene.add(exp);
    let t = 0;
    const grow = () => {
      t += 0.05;
      exp.scale.setScalar(1 + t * 20);
      (exp.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - t * 2);
      if (t < 0.6) requestAnimationFrame(grow);
      else this.assets.scene.remove(exp);
    };
    grow();
  }

  getHUDSnapshot(): HUDSnapshot {
    const vp = this.getCurrentViewPlayer();
    const w = currentWeapon(vp);
    const bombCarrier = this.c4.carrierId !== null
      ? this.players.find((p) => p.id === this.c4.carrierId)?.name ?? null
      : null;

    return {
      hp: Math.max(0, Math.floor(vp.hp)),
      armor: Math.max(0, Math.floor(vp.armor)),
      hasHelmet: vp.hasHelmet,
      weaponName: w.config.name,
      ammoInMag: w.ammoInMag,
      reserveAmmo: w.reserveAmmo,
      reloading: w.reloading,
      scoped: w.scoped,
      money: Math.floor(vp.money),
      team: this.localPlayer.team,
      alive: this.localPlayer.alive,
      roundState: this.round.state,
      roundTimer: this.round.timer,
      tScore: this.round.tScore,
      ctScore: this.round.ctScore,
      bombState: this.c4.state,
      bombTimer: this.c4.state === 'active' ? this.c4.fuseTimer : this.c4.state === 'planting' ? this.c4.plantTimer : 0,
      bombCarrier,
      kills: this.killfeed.slice(0, 5),
      spectatorIndex: 0,
      spectatorList: this.players
        .filter((p) => p.team === this.localPlayer.team)
        .map((p) => ({ id: p.id, name: p.name, alive: p.alive })),
      playerPositions: this.players.map((p) => ({
        x: p.pos.x, z: p.pos.z, team: p.team, alive: p.alive,
        isLocal: p.id === this.localPlayer.id,
        isBombCarrier: this.c4.carrierId === p.id,
      })),
      bombPos: this.c4.state === 'dropped' || this.c4.state === 'active' || this.c4.state === 'defusing' || this.c4.state === 'planting'
        ? { x: this.c4.pos.x, z: this.c4.pos.z }
        : null,
      aSite: this.map.aSiteCenter,
      bSite: this.map.bSiteCenter,
      roundNumber: this.round.number,
    };
  }

  loop = () => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.gameTime += dt;

    // Round state
    if (this.round.state === 'freeze') {
      this.round.timer -= dt;
      if (this.round.timer <= 0) {
        this.round.state = 'live';
        this.round.timer = 115; // 1:55 round time
        this.buyWeaponsForLocalPrimary();
      }
      // During freeze, don't let players move
      for (const p of this.players) {
        p.vel.x = 0; p.vel.z = 0; p.vel.y = 0;
      }
    } else if (this.round.state === 'live') {
      this.round.timer -= dt;
      // C4 beeps when active
      if (this.c4.state === 'active' && !(window as any).__c4Beeping) {
        (window as any).__c4Beeping = true;
        startC4Beep(() => this.c4.fuseTimer);
      }
      if (this.c4.state !== 'active' && (window as any).__c4Beeping) {
        (window as any).__c4Beeping = false;
        stopC4Beep();
      }

      // Local input handling
      this.handleLocalInput(dt);

      // AI update
      for (const [pid, ai] of this.ais) {
        const pl = this.players.find((p) => p.id === pid)!;
        // reset per-frame want flags
        (pl as any).wantPlant = false;
        (pl as any).wantDefuse = false;
        updateAI(ai, pl, this.map, this.players, this.map.boxes, dt, this.c4, this.gameTime);
        // AI shooting
        if (pl.shootInput) {
          this.fireWeapon(pl);
          pl.shootInput = false;
        }
        if (pl.reloadInput) {
          if (!currentWeapon(pl).reloading) this.beginReload(pl);
          pl.reloadInput = false;
        }
        if ((pl as any).wantPlant) {
          startPlant(this.c4, pl, this.map);
        }
        if ((pl as any).wantDefuse) {
          startDefuse(this.c4, pl);
        }
      }

      // C4 update
      updateC4(this.c4, this.players, this.map, dt, () => this.explodeBomb());
    } else if (this.round.state === 'ended') {
      // freeze movement
      for (const p of this.players) {
        p.vel.x *= 0.9; p.vel.z *= 0.9; p.vel.y = 0;
      }
    }

    // Movement and collision for all players
    for (const p of this.players) {
      this.updatePlayerMovement(p, dt);
      this.updateWeapons(p, dt);
    }

    // Update camera
    this.updateCamera(dt);

    // Check round end
    this.checkRoundEnd();

    // Render
    this.assets.renderer.render(this.assets.scene, this.assets.camera);

    // HUD update (throttled roughly every frame is fine)
    this.callbacks.onHudUpdate(this.getHUDSnapshot());
    drawMinimap(this.minimapCanvas, this.map, this.getHUDSnapshot());
  };
}
