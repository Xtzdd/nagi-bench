import * as THREE from 'three';
import type { Team, WeaponId, WeaponSpec } from './types';

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  rifle: { id:'rifle', name:'AK-47', damage:33, magazine:30, fireRate:.11, range:72, spread:.07 },
  pistol: { id:'pistol', name:'USP-S', damage:28, magazine:12, fireRate:.28, range:42, spread:.04 },
  knife: { id:'knife', name:'Knife', damage:55, magazine:Infinity, fireRate:.45, range:2.2, spread:0 }
};

export class Soldier {
  id: number;
  name: string;
  team: Team;
  isPlayer: boolean;
  group = new THREE.Group();
  hp = 100;
  alive = true;
  weapon: WeaponId = 'rifle';
  ammo = WEAPONS.rifle.magazine;
  reserve = 90;
  cooldown = 0;
  waypoint = new THREE.Vector3();
  speed = 0;
  private legL!: THREE.Mesh;
  private legR!: THREE.Mesh;
  private armL!: THREE.Mesh;
  private armR!: THREE.Mesh;
  private gun!: THREE.Mesh;

  constructor(id: number, name: string, team: Team, x: number, z: number, isPlayer = false) {
    this.id = id; this.name = name; this.team = team; this.isPlayer = isPlayer;
    const cloth = new THREE.MeshStandardMaterial({ color: team === 'T' ? 0xb9905d : 0x31506f, roughness:.75 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc99b75, roughness:.65 });
    const dark = new THREE.MeshStandardMaterial({ color: team === 'T' ? 0x5c4936 : 0x1d2a38, roughness:.8 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.72,.9,.42), cloth);
    torso.position.y = 1.25; torso.castShadow = true; this.group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.48), skin);
    head.position.y = 2.0; head.castShadow = true; this.group.add(head);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(.54,.22,.52), dark);
    helmet.position.y = 2.18; this.group.add(helmet);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(.18,.78,.18), cloth);
    this.armL.position.set(-.48,1.28,0); this.group.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(.18,.78,.18), cloth);
    this.armR.position.set(.48,1.28,0); this.group.add(this.armR);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(.24,.78,.24), dark);
    this.legL.position.set(-.2,.45,0); this.group.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(.24,.78,.24), dark);
    this.legR.position.set(.2,.45,0); this.group.add(this.legR);
    this.gun = new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.82), new THREE.MeshStandardMaterial({color:0x17191b,roughness:.45,metalness:.7}));
    this.gun.position.set(.48,1.25,-.45); this.group.add(this.gun);
    this.group.position.set(x,0,z);
    this.waypoint.set(x,0,z);
  }

  get position() { return this.group.position; }

  setWeapon(id: WeaponId) {
    this.weapon = id;
    this.ammo = WEAPONS[id].magazine;
    this.reserve = id === 'knife' ? Infinity : id === 'rifle' ? 90 : 36;
    this.gun.visible = id !== 'knife';
    this.gun.scale.z = id === 'pistol' ? .55 : 1;
  }

  reload() {
    const spec = WEAPONS[this.weapon];
    if (this.weapon === 'knife' || this.ammo === spec.magazine || this.reserve <= 0) return false;
    const need = spec.magazine - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    if (this.reserve !== Infinity) this.reserve -= take;
    return true;
  }

  face(point: THREE.Vector3) {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    if (Math.hypot(dx,dz) > .01) this.group.rotation.y = Math.atan2(dx, dz);
  }

  damage(amount: number) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.alive = false;
      this.group.rotation.z = Math.PI / 2;
      this.group.position.y = .25;
    }
    return true;
  }

  animate(dt: number, moving: boolean) {
    if (!this.alive) return;
    this.speed += dt * (moving ? 9 : 7);
    const swing = moving ? Math.sin(this.speed) * .55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * .35;
    this.armR.rotation.x = swing * .25;
  }
}
