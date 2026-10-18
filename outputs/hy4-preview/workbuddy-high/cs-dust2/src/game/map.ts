// Dust2, described as a walkable cell grid.
//
// Authoring the map as a grid (instead of free-floating AABBs) buys three
// things at once: collision can never let anyone clip a wall, bot pathfinding
// is guaranteed to find real routes, and line-of-sight tests are an exact grid
// walk — which is exactly what "被墙挡住看不见" needs to mean.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const GRID = 80;
export const CELL = 1.0;
export const WALL_H = 4.0;
export const CRATE_H = 1.7;

export interface Rect { x0: number; z0: number; x1: number; z1: number; name: string; }

// Open areas. Every one of the required Dust2 zones is present and they are
// connected along the real routes: T spawn -> bottom corridor -> Long A -> A
// site / -> Mid -> Mid Doors -> Catwalk -> A site, and T spawn -> B tunnels ->
// B site, with CT spawn feeding A site.
export const REGIONS: Rect[] = [
  { name: 'T spawn',        x0: 3,  z0: 57, x1: 19, z1: 69 },
  { name: 'Bottom corridor',x0: 3,  z0: 64, x1: 47, z1: 69 },
  { name: 'Long A',         x0: 38, z0: 30, x1: 47, z1: 69 },
  { name: 'A site',         x0: 38, z0: 15, x1: 56, z1: 33 },
  { name: 'CT spawn',       x0: 57, z0: 3,  x1: 72, z1: 19 },
  { name: 'CT ramp',        x0: 51, z0: 13, x1: 63, z1: 23 },
  { name: 'Catwalk',        x0: 30, z0: 23, x1: 41, z1: 30 },
  { name: 'Upper mid',      x0: 24, z0: 22, x1: 32, z1: 32 },
  { name: 'Mid',            x0: 24, z0: 34, x1: 32, z1: 67 },
  { name: 'Mid doors',      x0: 26, z0: 31, x1: 30, z1: 35 },
  { name: 'B tunnel entry', x0: 3,  z0: 43, x1: 15, z1: 58 },
  { name: 'B tunnel',       x0: 3,  z0: 31, x1: 15, z1: 45 },
  { name: 'B site',         x0: 3,  z0: 15, x1: 21, z1: 32 }
];

// Solid cover. Blocks movement and sight, but is low enough to read as boxes.
export const CRATES: Array<{ x: number; z: number; w: number; d: number; h: number }> = [
  { x: 43, z: 24, w: 2, d: 3, h: CRATE_H },   // A site default-plant cover
  { x: 49, z: 20, w: 3, d: 2, h: CRATE_H },
  { x: 52, z: 29, w: 2, d: 2, h: CRATE_H },
  { x: 41, z: 40, w: 2, d: 4, h: CRATE_H },   // long A boxes
  { x: 39, z: 52, w: 3, d: 2, h: CRATE_H },
  { x: 42, z: 60, w: 2, d: 2, h: CRATE_H },
  { x: 9,  z: 24, w: 3, d: 3, h: CRATE_H },   // B site cover
  { x: 15, z: 19, w: 2, d: 2, h: CRATE_H },
  { x: 6,  z: 29, w: 2, d: 2, h: CRATE_H },
  { x: 28, z: 44, w: 1, d: 3, h: CRATE_H },   // mid
  { x: 31, z: 56, w: 1, d: 2, h: CRATE_H },
  { x: 12, z: 62, w: 3, d: 2, h: CRATE_H },   // T spawn
  { x: 62, z: 12, w: 3, d: 2, h: CRATE_H }    // CT spawn
];

// Bomb sites (cell rects) — planting is only legal inside these.
export const SITES = {
  A: { name: 'A', x0: 42, z0: 18, x1: 54, z1: 31, cx: 48, cz: 25 },
  B: { name: 'B', x0: 5,  z0: 18, x1: 19, z1: 30, cx: 12, cz: 24 }
};

export const SPAWNS = {
  T:  [{ x: 8, z: 65 }, { x: 11, z: 66 }, { x: 14, z: 65 }, { x: 9, z: 61 }, { x: 13, z: 61 }],
  CT: [{ x: 62, z: 8 }, { x: 65, z: 10 }, { x: 68, z: 8 }, { x: 62, z: 14 }, { x: 66, z: 15 }]
};

// Named waypoints the bots route between (cell coordinates).
export const WAYPOINTS: Record<string, { x: number; z: number }> = {
  tSpawn:      { x: 11, z: 65 },
  bottomCorr:  { x: 30, z: 66 },
  longAEntry:  { x: 42, z: 62 },
  longAMid:    { x: 42, z: 48 },
  longATop:    { x: 42, z: 34 },
  aSite:       { x: 48, z: 25 },
  aSiteCorner: { x: 41, z: 21 },
  ctRamp:      { x: 57, z: 18 },
  ctSpawn:     { x: 64, z: 11 },
  catwalk:     { x: 36, z: 26 },
  midDoors:    { x: 28, z: 33 },
  midTop:      { x: 28, z: 38 },
  midMid:      { x: 28, z: 50 },
  midBottom:   { x: 28, z: 63 },
  bTunnelIn:   { x: 9,  z: 50 },
  bTunnel:     { x: 9,  z: 38 },
  bSite:       { x: 12, z: 24 },
  bSiteBack:   { x: 7,  z: 20 }
};

/* ---------------- grid construction ---------------- */

const walkable = new Uint8Array(GRID * GRID);
const crateAt = new Uint8Array(GRID * GRID);

export const idx = (cx: number, cz: number) => cz * GRID + cx;
export const inBounds = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < GRID && cz < GRID;

(function build() {
  for (const r of REGIONS) {
    for (let cz = r.z0; cz <= r.z1; cz++)
      for (let cx = r.x0; cx <= r.x1; cx++)
        if (inBounds(cx, cz)) walkable[idx(cx, cz)] = 1;
  }
  for (const c of CRATES) {
    for (let cz = c.z; cz < c.z + c.d; cz++)
      for (let cx = c.x; cx < c.x + c.w; cx++) {
        if (inBounds(cx, cz) && walkable[idx(cx, cz)]) crateAt[idx(cx, cz)] = 1;
      }
  }
})();

/** A cell stops you if it is outside the map, not part of a region, or a crate. */
export function blockedCell(cx: number, cz: number): boolean {
  if (!inBounds(cx, cz)) return true;
  return walkable[idx(cx, cz)] === 0 || crateAt[idx(cx, cz)] === 1;
}
export function blockedWorld(x: number, z: number): boolean {
  return blockedCell(Math.floor(x), Math.floor(z));
}
export function isCrateCell(cx: number, cz: number): boolean {
  return inBounds(cx, cz) && crateAt[idx(cx, cz)] === 1;
}

/** Circle-vs-grid overlap test. */
export function collides(x: number, z: number, r: number): boolean {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const z0 = Math.floor(z - r), z1 = Math.floor(z + r);
  for (let cz = z0; cz <= z1; cz++)
    for (let cx = x0; cx <= x1; cx++)
      if (blockedCell(cx, cz)) return true;
  return false;
}

/** Axis-separated sweep so nobody can ever clip through a wall. */
export function moveWithCollision(pos: { x: number; z: number }, dx: number, dz: number, r: number) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.25));
  let sx = dx / steps, sz = dz / steps;
  let hitX = false, hitZ = false;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      pos.x += sx;
      if (collides(pos.x, pos.z, r)) { pos.x -= sx; hitX = true; sx = 0; }
    }
    if (sz !== 0) {
      pos.z += sz;
      if (collides(pos.x, pos.z, r)) { pos.z -= sz; hitZ = true; sz = 0; }
    }
    if (hitX && hitZ) break;
  }
  return { hitX, hitZ };
}

/**
 * Line of sight: exact grid walk (Amanatides & Woo). Returns false as soon as a
 * blocking cell is crossed, so walls always break vision and crates do too.
 */
export function losClear(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  let cx = Math.floor(ax), cz = Math.floor(az);
  const ex = Math.floor(bx), ez = Math.floor(bz);
  const dx = bx - ax, dz = bz - az;
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tdZ = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tmX = dx === 0 ? Infinity : ((dx > 0 ? (cx + 1 - ax) : (ax - cx)) || 1e-9) * tdX;
  let tmZ = dz === 0 ? Infinity : ((dz > 0 ? (cz + 1 - az) : (az - cz)) || 1e-9) * tdZ;
  void ay; void by;
  for (let guard = 0; guard < 512; guard++) {
    if (cx === ex && cz === ez) return true;
    if (tmX < tmZ) { cx += stepX; tmX += tdX; } else { cz += stepZ; tmZ += tdZ; }
    if (blockedCell(cx, cz)) return false;
  }
  return false;
}

/** Symmetric room test used for "is this point inside a bomb site". */
export function inSite(site: 'A' | 'B', x: number, z: number): boolean {
  const s = SITES[site];
  const cx = Math.floor(x), cz = Math.floor(z);
  return cx >= s.x0 && cx <= s.x1 && cz >= s.z0 && cz <= s.z1;
}

export function randomWalkableNear(cx: number, cz: number, radius = 4): { x: number; z: number } {
  for (let i = 0; i < 200; i++) {
    const px = cx + Math.round((Math.random() * 2 - 1) * radius);
    const pz = cz + Math.round((Math.random() * 2 - 1) * radius);
    if (!blockedCell(px, pz)) return { x: px + 0.5, z: pz + 0.5 };
  }
  return { x: cx + 0.5, z: cz + 0.5 };
}

/* ---------------- geometry ---------------- */

const FLOOR_TINT = 0xb59a72;
const WALL_TINT = 0xa89680;
const WALL_DARK = 0x6f6152;
const CRATE_TINT = 0xa98247;

/**
 * Build the world: floor, merged wall runs and crate boxes. Only cells that
 * touch the play space are emitted, so the geometry stays small.
 */
export function buildMapGeometry(): THREE.Group {
  const g = new THREE.Group();

  // floor over every walkable cell
  const floorGeos: THREE.BufferGeometry[] = [];
  for (let cz = 0; cz < GRID; cz++) {
    let run = -1;
    for (let cx = 0; cx <= GRID; cx++) {
      const ok = cx < GRID && walkable[idx(cx, cz)] === 1;
      if (ok && run < 0) run = cx;
      if (!ok && run >= 0) {
        const w = cx - run;
        const geo = new THREE.BoxGeometry(w, 0.2, 1);
        geo.translate(run + w / 2, -0.1, cz + 0.5);
        floorGeos.push(geo);
        run = -1;
      }
    }
  }
  const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_TINT, roughness: 0.95, metalness: 0.02 });
  if (floorGeos.length) {
    const merged = mergeGeometries(floorGeos, false)!;
    merged.computeVertexNormals();
    floorGeos.forEach(x => x.dispose());
    const m = new THREE.Mesh(merged, floorMat);
    m.receiveShadow = true;
    g.add(m);
  }

  // walls: blocked cells adjacent to the play space
  const wallGeos: THREE.BufferGeometry[] = [];
  const darkGeos: THREE.BufferGeometry[] = [];
  const seen = new Uint8Array(GRID * GRID);
  for (let cz = 0; cz < GRID; cz++) {
    for (let cx = 0; cx < GRID; cx++) {
      if (seen[idx(cx, cz)]) continue;
      if (!blockedCell(cx, cz)) continue;
      let exposed = false;
      for (let dz = -1; dz <= 1 && !exposed; dz++)
        for (let dx = -1; dx <= 1; dx++)
          if (!blockedCell(cx + dx, cz + dz)) { exposed = true; break; }
      if (!exposed) { seen[idx(cx, cz)] = 1; continue; }
      if (isCrateCell(cx, cz)) continue;               // crates are handled below
      let run = cx;
      while (run + 1 < GRID && blockedCell(run + 1, cz) && !isCrateCell(run + 1, cz) && !seen[idx(run + 1, cz)]) {
        run++;
        let exp = false;
        for (let dz = -1; dz <= 1 && !exp; dz++)
          for (let dx = -1; dx <= 1; dx++)
            if (!blockedCell(run + 1 + dx, cz + dz)) { exp = true; break; }
        if (!exp) break;
      }
      for (let k = cx; k <= run; k++) seen[idx(k, cz)] = 1;
      const w = run - cx + 1;
      const isEdge = (cz % 9 === 0);
      const geo = new THREE.BoxGeometry(w, WALL_H, 1);
      geo.translate(cx + w / 2, WALL_H / 2, cz + 0.5);
      (isEdge ? darkGeos : wallGeos).push(geo);
    }
  }
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL_TINT, roughness: 0.92, metalness: 0.03 });
  const darkMat = new THREE.MeshStandardMaterial({ color: WALL_DARK, roughness: 0.88, metalness: 0.05 });
  for (const [geos, mat2] of [[wallGeos, wallMat], [darkGeos, darkMat]] as [THREE.BufferGeometry[], THREE.Material][]) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false)!;
    merged.computeVertexNormals();
    geos.forEach(x => x.dispose());
    const m = new THREE.Mesh(merged, mat2);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }

  // crates
  const crateMat = new THREE.MeshStandardMaterial({ color: CRATE_TINT, roughness: 0.85, metalness: 0.04 });
  for (const c of CRATES) {
    const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
    geo.translate(c.x + c.w / 2, c.h / 2, c.z + c.d / 2);
    const m = new THREE.Mesh(geo, crateMat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    // a darker lip so boxes read as separate objects
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(c.w * 0.98, 0.12, c.d * 0.98),
      new THREE.MeshStandardMaterial({ color: 0x6d5330, roughness: 0.8 })
    );
    lip.position.set(c.x + c.w / 2, c.h + 0.06, c.z + c.d / 2);
    g.add(lip);
  }

  return g;
}

/** Minimap outline data: returns which cells are walkable, for the 2D canvas. */
export function walkableMap(): Uint8Array { return walkable; }
