import { CELL, GRID_H, GRID_W, Cell, cellAt, worldToGx, worldToGy, gxToWorld, gyToWorld } from './layout';

/**
 * 网格 A* 寻路。代价上对贴墙格加罚，使路径更接近中路，AI 不易蹭墙。
 */
const COST = new Float32Array(GRID_W * GRID_H);
let costReady = false;

function buildCost(): void {
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const i = gx + gy * GRID_W;
      if (cellAt(gx, gy) !== Cell.Floor) {
        COST[i] = Infinity;
        continue;
      }
      let adjacent = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (cellAt(gx + dx, gy + dy) !== Cell.Floor) adjacent++;
        }
      }
      COST[i] = 1 + adjacent * 0.45;
    }
  }
  costReady = true;
}

export function invalidateNav(): void {
  costReady = false;
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2]
];

export interface PathPoint {
  x: number;
  z: number;
}

function nearestFree(gx: number, gy: number, maxR = 8): { gx: number; gy: number } | null {
  if (cellAt(gx, gy) === Cell.Floor) return { gx, gy };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (cellAt(gx + dx, gy + dy) === Cell.Floor) return { gx: gx + dx, gy: gy + dy };
      }
    }
  }
  return null;
}

/** 返回世界坐标路点（不含起点）。无可达路径时返回空数组。 */
export function findPath(fromX: number, fromZ: number, toX: number, toZ: number): PathPoint[] {
  if (!costReady) buildCost();
  const s = nearestFree(worldToGx(fromX), worldToGy(fromZ));
  const t = nearestFree(worldToGx(toX), worldToGy(toZ));
  if (!s || !t) return [];

  const start = s.gx + s.gy * GRID_W;
  const goal = t.gx + t.gy * GRID_W;
  if (start === goal) return [{ x: gxToWorld(t.gx + 0.5), z: gyToWorld(t.gy + 0.5) }];

  const open: number[] = [start];
  const gScore = new Float32Array(GRID_W * GRID_H).fill(Infinity);
  const fScore = new Float32Array(GRID_W * GRID_H).fill(Infinity);
  const cameFrom = new Int32Array(GRID_W * GRID_H).fill(-1);
  const closed = new Uint8Array(GRID_W * GRID_H);

  const h = (i: number): number => {
    const gx = i % GRID_W;
    const gy = (i - gx) / GRID_W;
    const dx = Math.abs(gx - t.gx);
    const dy = Math.abs(gy - t.gy);
    const min = Math.min(dx, dy);
    return (dx + dy - 2 * min) + min * Math.SQRT2;
  };

  gScore[start] = 0;
  fScore[start] = h(start);

  let guard = 0;
  while (open.length && guard++ < 20000) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
    const cur = open.splice(bestIdx, 1)[0];
    if (cur === goal) {
      const path: PathPoint[] = [];
      let node = cur;
      while (node !== -1 && node !== start) {
        const gx = node % GRID_W;
        const gy = (node - gx) / GRID_W;
        path.push({ x: gxToWorld(gx + 0.5), z: gyToWorld(gy + 0.5) });
        node = cameFrom[node];
      }
      path.reverse();
      return simplify(path);
    }
    closed[cur] = 1;
    const cx = cur % GRID_W;
    const cy = (cur - cx) / GRID_W;

    for (const [dx, dy, base] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const ni = nx + ny * GRID_W;
      if (closed[ni] || COST[ni] === Infinity) continue;
      if (dx && dy) {
        if (cellAt(nx, cy) !== Cell.Floor || cellAt(cx, ny) !== Cell.Floor) continue;
      }
      const tentative = gScore[cur] + base * COST[ni];
      if (tentative < gScore[ni]) {
        cameFrom[ni] = cur;
        gScore[ni] = tentative;
        fScore[ni] = tentative + h(ni);
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }
  return [];
}

/**
 * 路径平滑：string-pulling。只有「与锚点之间的直线全程可通行」的路点才允许被合并，
 * 否则保留原始网格路点。仅按共线判据合并会在绕行拐角处抄近道、拉出穿墙的直线段。
 *
 * 通行判定按实体半径留出余量：以采样点为心检查 CLEARANCE 半径覆盖的格子，
 * 只采样点本身会让直线贴角擦墙而过。
 */
const CLEARANCE = 0.5;

function clearLine(ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / (CELL * 0.25)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const gx0 = Math.floor((x - CLEARANCE) / CELL);
    const gx1 = Math.floor((x + CLEARANCE) / CELL);
    const gz0 = Math.floor((z - CLEARANCE) / CELL);
    const gz1 = Math.floor((z + CLEARANCE) / CELL);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (cellAt(gx, gz) !== Cell.Floor) return false;
      }
    }
  }
  return true;
}

function simplify(path: PathPoint[]): PathPoint[] {
  if (path.length < 3) return path;
  const out: PathPoint[] = [path[0]];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = anchor + 1;
    for (let j = path.length - 1; j > anchor + 1; j--) {
      if (clearLine(path[anchor].x, path[anchor].z, path[j].x, path[j].z)) {
        next = j;
        break;
      }
    }
    out.push(path[next]);
    anchor = next;
  }
  return out;
}

/** 受击或超时后强制重算路径的节流工具。 */
export class PathFollower {
  private path: PathPoint[] = [];
  private index = 0;
  private cooldown = 0;

  get done(): boolean {
    return this.index >= this.path.length;
  }

  get current(): PathPoint | null {
    return this.path[this.index] ?? null;
  }

  set(path: PathPoint[]): void {
    this.path = path;
    this.index = 0;
  }

  clear(): void {
    this.path = [];
    this.index = 0;
  }

  tick(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  canRepath(): boolean {
    return this.cooldown <= 0;
  }

  repath(x: number, z: number, tx: number, tz: number, delay = 0.6): void {
    this.set(findPath(x, z, tx, tz));
    this.cooldown = delay;
  }

  advance(): void {
    this.index++;
  }
}
