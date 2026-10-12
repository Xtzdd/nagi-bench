// Voxel / block-geometry construction helpers.
//
// The whole film uses one visual language: everything is built from cubes,
// boxes and lathes of blocky primitives. No external assets, no textures on
// disk — every surface is either a flat material or a procedural canvas.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PALETTE = {
  hullLight: 0xb9c3ce,
  hullMid: 0x8b97a6,
  hullDark: 0x5a6674,
  hullDeep: 0x39424e,
  panelLine: 0x2c333c,
  warn: 0xd9903a,
  danger: 0xc4462f,
  glass: 0x6fa8c9,
  glow: 0xffe2a8,
  cyan: 0x7fd6e8,
  green: 0x6fae72,
  soil: 0x6b5334,
  leaf: 0x4f8a45,
  water: 0x3f7fa8,
  earthBlue: 0x3f7fc4,
  earthGreen: 0x4a7a3c,
  earthCloud: 0xe9f2f8,
  rock: 0x77706a,
  rockDark: 0x4c4844,
  suitA: 0xe6ebf0,
  suitB: 0x2f3944,
  skin: 0xd8a97a,
  hair: 0x241d18,
  blood: 0x8e2f22,
  shadow: 0x11151b
};

export function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.14,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide
  });
}

export const M = {
  hullLight: () => mat(PALETTE.hullLight, { roughness: 0.52, metalness: 0.55 }),
  hullMid: () => mat(PALETTE.hullMid, { roughness: 0.62, metalness: 0.45 }),
  hullDark: () => mat(PALETTE.hullDark, { roughness: 0.72, metalness: 0.35 }),
  hullDeep: () => mat(PALETTE.hullDeep, { roughness: 0.8, metalness: 0.28 }),
  panel: () => mat(PALETTE.panelLine, { roughness: 0.9, metalness: 0.2 }),
  warn: () => mat(PALETTE.warn, { roughness: 0.6, metalness: 0.3 }),
  danger: () => mat(PALETTE.danger, { roughness: 0.6, metalness: 0.25 }),
  glass: () => mat(PALETTE.glass, { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.42 }),
  glow: () => mat(PALETTE.glow, { emissive: PALETTE.glow, emissiveIntensity: 1.4, roughness: 0.4 }),
  cyan: () => mat(PALETTE.cyan, { emissive: PALETTE.cyan, emissiveIntensity: 0.9, roughness: 0.35 }),
  green: () => mat(PALETTE.green, { roughness: 0.85 }),
  soil: () => mat(PALETTE.soil, { roughness: 0.95 }),
  rock: () => mat(PALETTE.rock, { roughness: 0.95, metalness: 0.05 }),
  rockDark: () => mat(PALETTE.rockDark, { roughness: 0.98, metalness: 0.03 }),
  suitA: () => mat(PALETTE.suitA, { roughness: 0.58, metalness: 0.16 }),
  suitB: () => mat(PALETTE.suitB, { roughness: 0.8, metalness: 0.14 }),
  star: () => new THREE.MeshBasicMaterial({ color: 0xffffff }),
  sun: () => new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
  earth: () => mat(PALETTE.earthBlue, { roughness: 0.9, emissive: 0x0a1c30, emissiveIntensity: 0.6 }),
  earthLand: () => mat(PALETTE.earthGreen, { roughness: 0.92 }),
  cloud: () => mat(PALETTE.earthCloud, { roughness: 1, transparent: true, opacity: 0.72 })
};

/** A single axis-aligned block. */
export function block(
  w: number, h: number, d: number,
  m: THREE.Material,
  x = 0, y = 0, z = 0
): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Flatten a group of boxes into one merged geometry, collapsing materials by
 * color so a whole set draws in a handful of calls. Returns a Group holding one
 * mesh per distinct material.
 */
export function bake(group: THREE.Group): THREE.Group {
  const byMat = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.Material;
    const key = (m as any).uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: m, geos: [] });
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    byMat.get(key)!.geos.push(g);
  });
  const out = new THREE.Group();
  for (const { mat: m, geos } of byMat.values()) {
    if (!geos.length) continue;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    out.add(mesh);
    geos.forEach(g => { if (g !== merged) g.dispose(); });
  }
  return out;
}

/** Deterministic hash-based pseudo random so every run looks identical. */
export function rng(seed: number) {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

/** Sprinkle panel-line detail blocks over a hull face. */
export function panelLines(
  target: THREE.Group, m: THREE.Material,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  step: number, thickness = 0.06
) {
  for (let y = y0; y <= y1; y += step) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0) + thickness, thickness, thickness);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((x0 + x1) / 2, y, z0);
    target.add(mesh);
  }
  for (let x = x0; x <= x1; x += step) {
    const g = new THREE.BoxGeometry(thickness, Math.abs(y1 - y0), thickness);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, (y0 + y1) / 2, z0);
    target.add(mesh);
  }
}

/** A blocky cylinder made of stacked ring segments (keeps the voxel feel). */
export function blockyCylinder(
  target: THREE.Group, m: THREE.Material,
  radius: number, height: number, segments: number,
  y = 0, jitter = 0
) {
  const r = rng(Math.round(radius * 100 + height * 10 + segments));
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const j = jitter ? (r() - 0.5) * jitter : 0;
    const w = (Math.PI * 2 * radius) / segments * 1.08;
    const g = new THREE.BoxGeometry(w + j, height, radius * 0.5 + j);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(Math.cos(a) * radius * 0.86, y, Math.sin(a) * radius * 0.86);
    mesh.rotation.y = -a;
    target.add(mesh);
  }
}

/** A blocky sphere (used for planets, asteroids, the meteorite). */
export function blockySphere(
  m: THREE.Material, radius: number, roughness = 6, seed = 7
): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const layers = Math.max(3, Math.round(radius / (radius / roughness)));
  for (let la = 0; la < layers; la++) {
    const t = (la + 0.5) / layers;
    const phi = Math.acos(1 - 2 * t);
    const ring = Math.max(4, Math.round(2 * layers * Math.sin(phi)) + 4);
    const rr = radius * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const h = (Math.PI * radius) / layers * 1.15;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      const s = rr * 1.1;
      const jr = 1 + (r() - 0.5) * 0.28;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s / ring * 1.3 * jr, h * jr, s / ring * 1.3 * jr), m);
      mesh.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      mesh.rotation.y = -a;
      mesh.rotation.z = (r() - 0.5) * 0.2;
      g.add(mesh);
    }
  }
  return g;
}

/** Starfield of blocky points. */
export function starfield(count: number, radius: number, seed = 11): THREE.Points {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const d = radius * (0.75 + r() * 0.25);
    pos[i * 3] = Math.cos(a) * s * d;
    pos[i * 3 + 1] = u * d;
    pos[i * 3 + 2] = Math.sin(a) * s * d;
    const w = 0.6 + r() * 0.4;
    const warm = r();
    col[i * 3] = w * (warm > 0.8 ? 1 : 0.85);
    col[i * 3 + 1] = w * 0.94;
    col[i * 3 + 2] = w * (warm > 0.8 ? 0.8 : 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.1, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95, fog: false
  }));
}

/** Volumetric-ish drifting dust/debris field. */
export function debrisField(count: number, spread: number, seed = 23): THREE.Points {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * spread;
    pos[i * 3 + 1] = (r() - 0.5) * spread * 0.5;
    pos[i * 3 + 2] = (r() - 0.5) * spread;
    const w = 0.35 + r() * 0.5;
    col[i * 3] = w; col[i * 3 + 1] = w * 0.96; col[i * 3 + 2] = w * 0.88;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.16, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.7, fog: false
  }));
}
