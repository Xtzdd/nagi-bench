import * as THREE from 'three';
import {
  AREAS,
  CELL,
  CRATE_H,
  DOORS,
  GRID_H,
  GRID_W,
  WALL_H,
  Cell,
  GRID,
  areaCenterWorld,
  cellAt,
  doorClosed
} from './layout';

/** 程序化沙地贴图（无外部资产）。 */
function sandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#c9ab74';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 150 + Math.random() * 90;
    g.fillStyle = `rgba(${v | 0},${(v * 0.9) | 0},${(v * 0.66) | 0},0.5)`;
    g.fillRect(x, y, 1.5, 1.5);
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.strokeStyle = 'rgba(150,124,84,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 18, y + 4, x + 36, y - 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function concreteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#b39a72';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 9000; i++) {
    const v = 130 + Math.random() * 80;
    g.fillStyle = `rgba(${v | 0},${(v * 0.9) | 0},${(v * 0.72) | 0},0.55)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6);
  }
  g.strokeStyle = 'rgba(120,100,68,0.28)';
  for (let i = 0; i < 8; i++) {
    const y = i * 16 + 2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function siteDecal(label: string): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(226,88,58,0.85)';
  g.lineWidth = 14;
  g.strokeRect(18, 18, 220, 220);
  g.fillStyle = 'rgba(226,88,58,0.9)';
  g.font = 'bold 150px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL * 9, CELL * 9),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  return m;
}

export interface MapScene {
  group: THREE.Group;
  updateDoors: (dt: number, probes: { x: number; z: number }[]) => void;
  doorOpen: Record<string, boolean>;
}

export function buildMapScene(): MapScene {
  const group = new THREE.Group();
  const sand = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 0.92, metalness: 0 });
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.88, metalness: 0 });
  const crateMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0x9a7a4e, roughness: 0.8, metalness: 0.05 });

  // 地面
  const floorCells: number[] = [];
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      if (GRID[gx + gy * GRID_W] !== Cell.Wall) floorCells.push(gx + gy * GRID_W);
    }
  }
  const floorGeo = new THREE.PlaneGeometry(CELL, CELL);
  const floor = new THREE.InstancedMesh(floorGeo, sand, floorCells.length);
  floor.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const s1 = new THREE.Vector3(1, 1, 1);
  floorCells.forEach((idx, i) => {
    const gx = idx % GRID_W;
    const gy = (idx - gx) / GRID_W;
    m4.compose(new THREE.Vector3(gx * CELL + CELL / 2, 0, gy * CELL + CELL / 2), q, s1);
    floor.setMatrixAt(i, m4);
  });
  floor.instanceMatrix.needsUpdate = true;
  group.add(floor);

  // 墙体：只为暴露在地面旁的实心格建箱体
  const wallCells: number[] = [];
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      if (GRID[gx + gy * GRID_W] !== Cell.Wall) continue;
      let exposed = false;
      for (let dy = -1; dy <= 1 && !exposed; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
          if (GRID[nx + ny * GRID_W] !== Cell.Wall) {
            exposed = true;
            break;
          }
        }
      }
      if (exposed) wallCells.push(gx + gy * GRID_W);
    }
  }
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const walls = new THREE.InstancedMesh(wallGeo, concrete, wallCells.length);
  walls.castShadow = true;
  walls.receiveShadow = true;
  const wallColor = new THREE.Color();
  wallCells.forEach((idx, i) => {
    const gx = idx % GRID_W;
    const gy = (idx - gx) / GRID_W;
    m4.compose(
      new THREE.Vector3(gx * CELL + CELL / 2, WALL_H / 2, gy * CELL + CELL / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(CELL, WALL_H, CELL)
    );
    walls.setMatrixAt(i, m4);
    const v = 0.82 + ((gx * 7 + gy * 13) % 11) * 0.022;
    wallColor.setRGB(v, v * 0.97, v * 0.9);
    walls.setColorAt(i, wallColor);
  });
  walls.instanceMatrix.needsUpdate = true;
  if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
  group.add(walls);

  // 掩体箱
  const crateCells: number[] = [];
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      if (GRID[gx + gy * GRID_W] === Cell.Crate) crateCells.push(gx + gy * GRID_W);
    }
  }
  const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), crateMat, crateCells.length);
  crates.castShadow = true;
  crates.receiveShadow = true;
  crateCells.forEach((idx, i) => {
    const gx = idx % GRID_W;
    const gy = (idx - gx) / GRID_W;
    m4.compose(
      new THREE.Vector3(gx * CELL + CELL / 2, CRATE_H / 2, gy * CELL + CELL / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(CELL, CRATE_H, CELL)
    );
    crates.setMatrixAt(i, m4);
  });
  crates.instanceMatrix.needsUpdate = true;
  group.add(crates);

  // 中门门叶（可推开、可穿过）
  const doorMeshes: { mesh: THREE.Mesh; baseX: number; dir: number }[] = [];
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x6f5a3c, roughness: 0.7, metalness: 0.15 });
  for (const d of DOORS) {
    const r = d.cells;
    const span = (r.x1 - r.x0) / 2;
    for (let k = 0; k < 2; k++) {
      const w = span * CELL;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 0.5), doorMat);
      const cx = r.x0 + span * (k + 0.5);
      const cz = (r.y0 + r.y1) / 2;
      mesh.position.set(cx * CELL, 2.9, cz * CELL);
      mesh.castShadow = true;
      group.add(mesh);
      doorMeshes.push({ mesh, baseX: cx * CELL, dir: k === 0 ? -1 : 1 });
    }
  }

  // 包点标记
  const a = areaCenterWorld(AREAS.aSite);
  const b = areaCenterWorld(AREAS.bSite);
  const decalA = siteDecal('A');
  decalA.position.x = a.x;
  decalA.position.z = a.z;
  const decalB = siteDecal('B');
  decalB.position.x = b.x;
  decalB.position.z = b.z;
  group.add(decalA, decalB);

  // 天空与光照（沙漠正午偏后）
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f7fd0) },
      horizon: { value: new THREE.Color(0xe8d6a8) },
      sunDir: { value: new THREE.Vector3(0.42, 0.72, 0.55).normalize() }
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vD;',
      'void main(){',
      '  float h = clamp(vD.y, 0.0, 1.0);',
      '  vec3 c = mix(horizon, top, pow(h, 0.55));',
      '  float s = pow(max(dot(normalize(vD), normalize(sunDir)), 0.0), 220.0);',
      '  c += vec3(1.0,0.94,0.8) * s * 1.6;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), skyMat);
  group.add(sky);

  const sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
  sun.position.set(90, 150, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 420;
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.bias = -0.0012;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0xbfd6f2, 0x8a7550, 1.05));
  group.add(new THREE.AmbientLight(0xffffff, 0.32));

  const doorOpen: Record<string, boolean> = { midDoors: false };
  let doorAnim = 0;

  const updateDoors = (dt: number, probes: { x: number; z: number }[]): void => {
    const d = DOORS[0];
    const r = d.cells;
    const cxc = ((r.x0 + r.x1) / 2) * CELL;
    const czc = ((r.y0 + r.y1) / 2) * CELL;
    const near = probes.some((p) => Math.hypot(p.x - cxc, p.z - czc) < 11);
    doorOpen[d.id] = near;
    doorClosed[d.id] = !near;
    doorAnim += ((near ? 1 : 0) - doorAnim) * Math.min(1, dt * 4.5);
    const slide = doorAnim * (CELL * ((r.x1 - r.x0) / 2));
    for (const dm of doorMeshes) dm.mesh.position.x = dm.baseX + dm.dir * slide;
  };

  return { group, updateDoors, doorOpen };
}

export function isWalkableWorld(x: number, z: number): boolean {
  return cellAt(Math.floor(x / CELL), Math.floor(z / CELL)) !== Cell.Wall;
}
