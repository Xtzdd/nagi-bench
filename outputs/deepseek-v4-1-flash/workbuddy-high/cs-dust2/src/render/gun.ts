import * as THREE from 'three';

/**
 * 程序化枪械模型：同一套几何既用于第一人称手持，也用于第三人称角色挂点。
 * 不同武器通过尺寸、配件与配色区分，不使用任何外部模型文件。
 */
interface Part {
  size: [number, number, number];
  pos: [number, number, number];
  color: number;
}

interface GunSpec {
  parts: Part[];
  length: number;
  muzzle: [number, number, number];
}

const SPECS: Record<string, GunSpec> = {
  ak47: {
    length: 0.86,
    muzzle: [0, 0.03, -0.62],
    parts: [
      { size: [0.075, 0.1, 0.5], pos: [0, 0, -0.06], color: 0x2f2a24 },
      { size: [0.05, 0.05, 0.4], pos: [0, 0.03, -0.5], color: 0x39332b },
      { size: [0.06, 0.16, 0.11], pos: [0, -0.13, -0.04], color: 0x6a4a24 },
      { size: [0.055, 0.12, 0.2], pos: [0, -0.09, 0.16], color: 0x7a5a2c },
      { size: [0.045, 0.05, 0.16], pos: [0, -0.01, 0.28], color: 0x3a332b },
      { size: [0.03, 0.055, 0.09], pos: [0, 0.08, -0.16], color: 0x4a423a }
    ]
  },
  m4a4: {
    length: 0.84,
    muzzle: [0, 0.03, -0.6],
    parts: [
      { size: [0.072, 0.1, 0.46], pos: [0, 0, -0.04], color: 0x3a3a3e },
      { size: [0.046, 0.046, 0.38], pos: [0, 0.03, -0.48], color: 0x45454a },
      { size: [0.055, 0.15, 0.1], pos: [0, -0.12, -0.02], color: 0x30302f },
      { size: [0.05, 0.11, 0.2], pos: [0, -0.085, 0.16], color: 0x3c3c40 },
      { size: [0.04, 0.045, 0.18], pos: [0, -0.005, 0.28], color: 0x2f2f33 },
      { size: [0.035, 0.05, 0.1], pos: [0, 0.075, -0.12], color: 0x55555a }
    ]
  },
  awp: {
    length: 1.24,
    muzzle: [0, 0.02, -0.9],
    parts: [
      { size: [0.07, 0.1, 0.66], pos: [0, 0, -0.16], color: 0x3a3a35 },
      { size: [0.04, 0.04, 0.5], pos: [0, 0.03, -0.7], color: 0x4a4a44 },
      { size: [0.055, 0.14, 0.1], pos: [0, -0.12, -0.06], color: 0x2e2e2a },
      { size: [0.05, 0.16, 0.26], pos: [0, -0.11, 0.2], color: 0x45453d },
      { size: [0.05, 0.05, 0.42], pos: [0, 0.1, -0.06], color: 0x1d1d1a },
      { size: [0.075, 0.075, 0.1], pos: [0, 0.11, -0.3], color: 0x2b2b2b },
      { size: [0.03, 0.04, 0.12], pos: [0, 0.14, 0.02], color: 0x151515 }
    ]
  },
  glock: {
    length: 0.3,
    muzzle: [0, 0.02, -0.2],
    parts: [
      { size: [0.05, 0.09, 0.24], pos: [0, 0.01, -0.05], color: 0x2b2b2e },
      { size: [0.045, 0.075, 0.09], pos: [0, 0.06, 0.0], color: 0x2b2b2e }
    ]
  },
  usp: {
    length: 0.32,
    muzzle: [0, 0.02, -0.22],
    parts: [
      { size: [0.05, 0.095, 0.26], pos: [0, 0.01, -0.06], color: 0x333338 },
      { size: [0.045, 0.08, 0.1], pos: [0, 0.065, 0.0], color: 0x333338 }
    ]
  },
  deagle: {
    length: 0.37,
    muzzle: [0, 0.025, -0.24],
    parts: [
      { size: [0.058, 0.105, 0.3], pos: [0, 0.015, -0.08], color: 0x8a7a45 },
      { size: [0.05, 0.09, 0.12], pos: [0, 0.075, 0.0], color: 0x8a7a45 }
    ]
  },
  knife: {
    length: 0.34,
    muzzle: [0, 0, -0.3],
    parts: [
      { size: [0.02, 0.06, 0.22], pos: [0, 0.02, -0.12], color: 0xd8dde3 },
      { size: [0.035, 0.045, 0.11], pos: [0, -0.01, 0.06], color: 0x1e1e20 }
    ]
  }
};

/** 第一人称视图模型需要把枪缩小并塞进画面右下，因此单独给一套缩放与偏移。 */
export function buildGunMesh(id: string, viewmodel = false): THREE.Group {
  const spec = SPECS[id] ?? SPECS.glock;
  const g = new THREE.Group();
  for (const p of spec.parts) {
    const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.55, metalness: 0.35 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]), mat);
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
    mesh.castShadow = !viewmodel;
    g.add(mesh);
  }
  if (id === 'awp') {
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.035, 16),
      new THREE.MeshStandardMaterial({ color: 0x7fdfff, emissive: 0x2a7f9f, emissiveIntensity: 0.6, roughness: 0.15 })
    );
    glass.position.set(0, 0.11, -0.36);
    glass.rotation.y = Math.PI;
    g.add(glass);
  }
  if (id === 'knife' && viewmodel) {
    g.position.set(0.24, -0.22, -0.45);
    g.rotation.set(-0.35, 0.5, -0.9);
  }
  return g;
}

export function gunSpec(id: string): GunSpec {
  return SPECS[id] ?? SPECS.glock;
}
