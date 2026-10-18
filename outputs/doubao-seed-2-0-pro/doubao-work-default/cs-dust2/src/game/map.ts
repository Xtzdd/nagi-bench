import * as THREE from 'three';
import type { SiteId } from './types';

export interface Region { id: string; x: number; z: number; radius: number; site?: SiteId }
export interface Obstacle { minX: number; maxX: number; minZ: number; maxZ: number }

const sand = new THREE.MeshStandardMaterial({ color: 0xc7a778, roughness: .92 });
const road = new THREE.MeshStandardMaterial({ color: 0xb99262, roughness: .95 });
const stone = new THREE.MeshStandardMaterial({ color: 0x9c8364, roughness: .88 });
const dark = new THREE.MeshStandardMaterial({ color: 0x6e5a45, roughness: .9 });

function label(text: string, x: number, y: number, z: number, color = '#f6e7c9') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(42,31,20,.72)';
  ctx.fillRect(20, 28, 472, 72);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(20, 28, 472, 72);
  ctx.fillStyle = color; ctx.font = 'bold 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(x, y, z); sprite.scale.set(8, 2, 1);
  return sprite;
}

function box(scene: THREE.Scene, x: number, z: number, w: number, h: number, d: number, mat = stone): Obstacle {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return { minX:x-w/2, maxX:x+w/2, minZ:z-d/2, maxZ:z+d/2 };
}

function path(scene: THREE.Scene, x: number, z: number, w: number, d: number, rot = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), road);
  mesh.rotation.set(-Math.PI / 2, 0, rot);
  mesh.position.set(x, .025, z);
  scene.add(mesh);
}

export function createMap(scene: THREE.Scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(92, 82), sand);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  path(scene, -8, -25, 58, 7, -.12);
  path(scene, 0, 2, 8, 46, 0);
  path(scene, 22, -10, 24, 16, .1);
  path(scene, -28, 14, 20, 20, -.25);
  path(scene, 18, 18, 30, 10, .1);
  path(scene, -18, -4, 18, 8, .7);

  const obstacles: Obstacle[] = [];
  obstacles.push(box(scene, -2, 0, 2, 4, 1, dark));
  obstacles.push(box(scene, 2, 0, 2, 4, 1, dark));
  obstacles.push(box(scene, -24, -22, 2, 5, 2));
  obstacles.push(box(scene, 27, -13, 3, 3, 3));
  obstacles.push(box(scene, 36, -7, 4, 2.5, 3));
  obstacles.push(box(scene, 31, -14, 3, 2.5, 2));
  obstacles.push(box(scene, -37, 18, 4, 3, 4));
  obstacles.push(box(scene, -31, 24, 3, 2.5, 3));
  obstacles.push(box(scene, -25, 12, 3, 3, 3));
  obstacles.push(box(scene, 12, -18, 3, 3, 2));
  obstacles.push(box(scene, 8, -20, 2, 2.5, 2));
  obstacles.push(box(scene, 30, 18, 4, 3, 3));
  obstacles.push(box(scene, 38, 15, 3, 2.5, 3));

  scene.add(label('T 出生点', -38, 5, -34));
  scene.add(label('A 大道 / LONG A', -5, 4, -27));
  scene.add(label('A 包点', 32, 5, -10));
  scene.add(label('中路 / MID', 0, 5, 4));
  scene.add(label('中门', 0, 5, -1));
  scene.add(label('B 隧道', -28, 5, 7));
  scene.add(label('B 包点', -34, 5, 21));
  scene.add(label('CT 出生点', 36, 5, 20));
  scene.add(label('斜坡 CATWALK', 13, 5, -19));

  const regions: Region[] = [
    { id:'T Spawn', x:-38, z:-34, radius:8 },
    { id:'A Site', x:32, z:-10, radius:9, site:'A' },
    { id:'B Site', x:-34, z:21, radius:9, site:'B' },
    { id:'CT Spawn', x:36, z:20, radius:8 },
    { id:'B Tunnels', x:-28, z:8, radius:8 },
    { id:'Mid', x:0, z:2, radius:7 }
  ];
  return { regions, obstacles };
}
