import * as THREE from 'three';
import type { HitZone, Team } from '../engine/types';
import { buildGunMesh } from '../render/gun';

/**
 * 程序化类人角色：头、躯干、双臂（上臂 + 前臂）、双腿（大腿 + 小腿）各自独立，
 * 不使用胶囊体或圆柱体敷衍。默认持枪姿态，武器挂在胸前挂点上随朝向移动。
 *
 * 命中判定按分区给出世界坐标 AABB（头 / 胸 / 腹 / 手臂 / 腿）。
 */

interface Rig {
  skin: number;
  cloth: number;
  vest: number;
  head: number;
  boots: number;
}

const RIGS: Record<Team, Rig> = {
  CT: { skin: 0xc79a72, cloth: 0x2f3d55, vest: 0x51678a, head: 0x3a4a63, boots: 0x1d2128 },
  T: { skin: 0xc08d63, cloth: 0x6f5c3a, vest: 0x4a3d26, head: 0x22252a, boots: 0x2a2419 }
};

function mat(color: number, roughness = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

interface Joint {
  thigh: THREE.Mesh;
  shin: THREE.Mesh;
  hip: THREE.Group;
  knee: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private readonly team: Team;
  private readonly armR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly legs: Joint[] = [];
  private readonly weaponHolder = new THREE.Group();
  private weaponId = 'glock';
  private walkPhase = 0;
  private aimBlend = 1;
  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  constructor(team: Team) {
    this.team = team;
    const rig = RIGS[team];

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, pos: [number, number, number], rot?: [number, number, number]) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true;
      parent.add(m);
      this.disposables.push(geo, m.material);
      return m;
    };

    this.root.add(this.body);

    // ── 腿：髋 → 大腿 → 膝 → 小腿 → 靴 ──
    for (let side = 0; side < 2; side++) {
      const hip = new THREE.Group();
      hip.position.set(side === 0 ? -0.17 : 0.17, 0.94, 0);
      this.body.add(hip);
      const thigh = add(hip, new THREE.BoxGeometry(0.2, 0.46, 0.22), rig.cloth, [0, -0.23, 0]);
      const knee = new THREE.Group();
      knee.position.set(0, -0.46, 0);
      hip.add(knee);
      const shin = add(knee, new THREE.BoxGeometry(0.18, 0.44, 0.2), rig.cloth, [0, -0.22, 0]);
      add(knee, new THREE.BoxGeometry(0.22, 0.12, 0.3), rig.boots, [0, -0.48, -0.04]);
      this.legs.push({ thigh, shin, hip, knee });
    }

    // ── 躯干 ──
    add(this.body, new THREE.BoxGeometry(0.62, 0.52, 0.34), rig.cloth, [0, 1.2, 0]);
    add(this.body, new THREE.BoxGeometry(0.48, 0.34, 0.3), rig.cloth, [0, 1.56, 0]);
    add(this.body, new THREE.BoxGeometry(0.56, 0.36, 0.16), rig.vest, [0, 1.2, 0.2]);
    if (team === 'CT') {
      add(this.body, new THREE.BoxGeometry(0.5, 0.16, 0.12), rig.vest, [0, 1.36, 0.2]);
    } else {
      add(this.body, new THREE.BoxGeometry(0.44, 0.1, 0.1), 0x8a6b3a, [0, 1.34, 0.2]);
      add(this.body, new THREE.BoxGeometry(0.08, 0.3, 0.08), 0x3f3628, [-0.24, 1.28, 0.16]);
    }

    // ── 手臂：肩 → 上臂 → 肘 → 前臂 → 手 ──
    const buildArm = (g: THREE.Group, sign: number) => {
      g.position.set(sign * 0.37, 1.46, 0);
      this.body.add(g);
      add(g, new THREE.BoxGeometry(0.17, 0.3, 0.17), rig.cloth, [0, -0.15, 0]);
      const fore = add(g, new THREE.BoxGeometry(0.15, 0.3, 0.15), rig.cloth, [0, -0.44, -0.02]);
      fore.rotation.x = -1.0;
      add(g, new THREE.BoxGeometry(0.13, 0.14, 0.16), 0x23262b, [0, -0.6, -0.2]);
    };
    buildArm(this.armR, 1);
    buildArm(this.armL, -1);

    // ── 头 ──
    const head = add(this.body, new THREE.BoxGeometry(0.26, 0.28, 0.26), rig.skin, [0, 1.85, 0]);
    if (team === 'CT') {
      add(this.body, new THREE.BoxGeometry(0.32, 0.16, 0.32), rig.head, [0, 1.97, 0]);
      add(this.body, new THREE.BoxGeometry(0.3, 0.1, 0.1), 0x9fb0c4, [0, 1.87, -0.16]);
    } else {
      add(this.body, new THREE.BoxGeometry(0.3, 0.12, 0.3), rig.head, [0, 1.96, 0]);
      add(this.body, new THREE.BoxGeometry(0.28, 0.22, 0.1), rig.head, [0, 1.84, -0.13]);
    }
    head.name = 'head';

    // ── 武器挂点（胸前右前方） ──
    this.weaponHolder.position.set(0.2, 1.22, -0.3);
    this.body.add(this.weaponHolder);
    this.setWeapon('glock');

    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.receiveShadow = true;
    });
  }

  setWeapon(id: string): void {
    if (this.weaponId === id && this.weaponHolder.children.length) return;
    this.weaponId = id;
    const old = this.weaponHolder.children.slice();
    for (const c of old) this.weaponHolder.remove(c);
    const gun = buildGunMesh(id, false);
    this.weaponHolder.add(gun);
  }

  setAiming(aiming: boolean): void {
    this.aimTarget = aiming ? 1 : 0;
  }
  private aimTarget = 1;

  /** 行走动画：按速度推进摆动相位。 */
  update(dt: number, speed: number): void {
    const move = Math.min(1, speed / 6);
    this.walkPhase += dt * (2.6 + move * 7);
    const amp = move * 0.62;
    this.legs.forEach((leg, i) => {
      const p = this.walkPhase + (i === 0 ? 0 : Math.PI);
      leg.hip.rotation.x = Math.sin(p) * amp;
      leg.knee.rotation.x = Math.max(0, -Math.sin(p - 0.5)) * amp * 1.15;
    });
    this.aimBlend += (this.aimTarget - this.aimBlend) * Math.min(1, dt * 8);
    const bob = Math.sin(this.walkPhase * 2) * move * 0.03;
    this.armR.rotation.x = -0.95 - this.aimBlend * 0.25 + Math.sin(this.walkPhase) * amp * 0.12;
    this.armL.rotation.x = -1.18 - this.aimBlend * 0.2 + Math.sin(this.walkPhase + Math.PI) * amp * 0.12;
    this.body.position.y = bob;
  }

  /** 世界坐标命中分区。 */
  hitboxes(): { zone: HitZone; box: THREE.Box3 }[] {
    this.root.updateMatrixWorld(true);
    const local: { zone: HitZone; min: THREE.Vector3; max: THREE.Vector3 }[] = [
      { zone: 'head', min: new THREE.Vector3(-0.15, 1.7, -0.16), max: new THREE.Vector3(0.15, 2.04, 0.16) },
      { zone: 'chest', min: new THREE.Vector3(-0.33, 1.3, -0.19), max: new THREE.Vector3(0.33, 1.7, 0.19) },
      { zone: 'stomach', min: new THREE.Vector3(-0.31, 0.94, -0.18), max: new THREE.Vector3(0.31, 1.3, 0.18) },
      { zone: 'arm', min: new THREE.Vector3(0.28, 1.04, -0.2), max: new THREE.Vector3(0.5, 1.5, 0.2) },
      { zone: 'arm', min: new THREE.Vector3(-0.5, 1.04, -0.2), max: new THREE.Vector3(-0.28, 1.5, 0.2) },
      { zone: 'leg', min: new THREE.Vector3(-0.3, 0.0, -0.16), max: new THREE.Vector3(-0.04, 0.96, 0.16) },
      { zone: 'leg', min: new THREE.Vector3(0.04, 0.0, -0.16), max: new THREE.Vector3(0.3, 0.96, 0.16) }
    ];
    const out: { zone: HitZone; box: THREE.Box3 }[] = [];
    const v = new THREE.Vector3();
    for (const hb of local) {
      const box = new THREE.Box3();
      for (let i = 0; i < 8; i++) {
        v.set(
          i & 1 ? hb.max.x : hb.min.x,
          i & 2 ? hb.max.y : hb.min.y,
          i & 4 ? hb.max.z : hb.min.z
        );
        v.applyMatrix4(this.root.matrixWorld);
        box.expandByPoint(v);
      }
      out.push({ zone: hb.zone, box });
    }
    return out;
  }

  /** 枪口世界坐标（用于曳光弹与枪口火焰）。 */
  muzzleWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    const p = new THREE.Vector3(0, 1.28, -0.78);
    if (this.weaponId === 'awp') p.set(0, 1.3, -1.05);
    return p.applyMatrix4(this.root.matrixWorld);
  }

  get teamOf(): Team {
    return this.team;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const d of this.disposables) d.dispose();
    this.weaponHolder.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
