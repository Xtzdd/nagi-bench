// A* over the walkable cell grid, plus string-pulling so bots walk diagonals
// instead of stair-stepping along cell centres.

import { GRID, blockedCell, idx } from './map';

const NEIGH = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]
];

const gScore = new Float32Array(GRID * GRID);
const fScore = new Float32Array(GRID * GRID);
const cameFrom = new Int32Array(GRID * GRID);
const stamp = new Int32Array(GRID * GRID);
const closed = new Int32Array(GRID * GRID);
let epoch = 0;

// Simple binary heap keyed by fScore.
class Heap {
  a: number[] = [];
  clear() { this.a.length = 0; }
  push(n: number) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[a[p]] <= fScore[a[i]]) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  }
  pop(): number {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < a.length && fScore[a[l]] < fScore[a[s]]) s = l;
        if (r < a.length && fScore[a[r]] < fScore[a[s]]) s = r;
        if (s === i) break;
        const t = a[s]; a[s] = a[i]; a[i] = t; i = s;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}
const heap = new Heap();

const h = (ax: number, az: number, bx: number, bz: number) => {
  const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
  return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz);
};

/** Find a path from one world point to another. Returns cell-centre points. */
export function findPath(fromX: number, fromZ: number, toX: number, toZ: number, maxNodes = 6000)
  : Array<{ x: number; z: number }> {
  let sx = Math.floor(fromX), sz = Math.floor(fromZ);
  let gx = Math.floor(toX), gz = Math.floor(toZ);
  if (blockedCell(sx, sz)) {
    let ok = false;
    for (let dz = -2; dz <= 2 && !ok; dz++) for (let dx = -2; dx <= 2 && !ok; dx++) {
      if (!blockedCell(sx + dx, sz + dz)) { sx += dx; sz += dz; ok = true; }
    }
    if (!ok) return [];
  }
  if (blockedCell(gx, gz)) {
    let ok = false;
    for (let dz = -3; dz <= 3 && !ok; dz++) for (let dx = -3; dx <= 3 && !ok; dx++) {
      if (!blockedCell(gx + dx, gz + dz)) { gx += dx; gz += dz; ok = true; }
    }
    if (!ok) return [];
  }

  epoch++;
  heap.clear();
  const s = idx(sx, sz), goal = idx(gx, gz);
  stamp[s] = epoch; gScore[s] = 0; fScore[s] = h(sx, sz, gx, gz); cameFrom[s] = -1;
  heap.push(s);
  let expanded = 0;

  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur] === epoch) continue;
    closed[cur] = epoch;
    if (cur === goal) break;
    if (++expanded > maxNodes) break;

    const cx = cur % GRID, cz = (cur / GRID) | 0;
    for (const [dx, dz, cost] of NEIGH) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      if (blockedCell(nx, nz)) continue;
      // no corner cutting
      if (dx !== 0 && dz !== 0 && (blockedCell(cx + dx, cz) || blockedCell(cx, cz + dz))) continue;
      const n = idx(nx, nz);
      if (closed[n] === epoch) continue;
      const tentative = gScore[cur] + cost;
      if (stamp[n] !== epoch || tentative < gScore[n]) {
        stamp[n] = epoch;
        gScore[n] = tentative;
        cameFrom[n] = cur;
        fScore[n] = tentative + h(nx, nz, gx, gz);
        heap.push(n);
      }
    }
  }

  if (stamp[goal] !== epoch) return [];
  const out: Array<{ x: number; z: number }> = [];
  let n = goal;
  while (n !== -1) {
    out.push({ x: (n % GRID) + 0.5, z: ((n / GRID) | 0) + 0.5 });
    n = cameFrom[n];
  }
  out.reverse();
  return smooth(fromX, fromZ, toX, toZ, out);
}

/** String-pull: drop waypoints we can walk straight past. */
function smooth(fromX: number, fromZ: number, toX: number, toZ: number, pts: Array<{ x: number; z: number }>)
  : Array<{ x: number; z: number }> {
  if (pts.length <= 2) return [{ x: toX, z: toZ }];
  const all = [{ x: fromX, z: fromZ }, ...pts, { x: toX, z: toZ }];
  const out: Array<{ x: number; z: number }> = [];
  let i = 0;
  while (i < all.length - 1) {
    let j = all.length - 1;
    for (; j > i + 1; j--) {
      if (clearLine(all[i].x, all[i].z, all[j].x, all[j].z)) break;
    }
    out.push(all[j]);
    i = j;
    if (j === all.length - 1) break;
  }
  return out.length ? out : [{ x: toX, z: toZ }];
}

/** Walk a line and make sure no blocking cell (and no diagonal clip) is hit. */
export function clearLine(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / 0.34);
  if (steps === 0) return true;
  const r = 0.42;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = ax + dx * t, z = az + dz * t;
    // sample the bot's radius on both perpendicular sides
    const nx = -dz / dist * r, nz = dx / dist * r;
    for (const [ox, oz] of [[0, 0], [nx, nz], [-nx, -nz]]) {
      if (blockedCell(Math.floor(x + ox), Math.floor(z + oz))) return false;
    }
  }
  return true;
}
