/**
 * Dust2 核心区域布局（纯数据与几何查询，不依赖 three.js，便于单独做连通性自检）。
 *
 * 地图由「矩形房间 / 走廊」雕刻而成：先铺满实心格，再把房间挖成地面。
 * 这样既能保证 8 个关键区域全部存在，也能用洪水填充客观验证它们彼此连通。
 *
 * 坐标系：网格 (gx, gy)，gx 向右、gy 向下；世界坐标 x 向右、z 向前（向下）。
 */

export const CELL = 4;
export const GRID_W = 64;
export const GRID_H = 64;
export const WALL_H = 7;
export const CRATE_H = 2.4;

export const Cell = {
  Floor: 0,
  Wall: 1,
  Crate: 2
} as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });

/** 8 个必须存在且彼此连通的区域。 */
export const AREAS: Record<string, Rect> = {
  tSpawn: rect(26, 46, 41, 59),
  aLong: rect(5, 20, 14, 48),
  aLongCorner: rect(5, 46, 15, 55),
  aSite: rect(4, 4, 22, 22),
  aShort: rect(13, 13, 19, 20),
  catwalk: rect(18, 13, 32, 20),
  mid: rect(30, 20, 39, 48),
  midTop: rect(30, 12, 41, 22),
  ctSpawn: rect(22, 3, 42, 13),
  ctToA: rect(10, 4, 24, 11),
  ctToB: rect(39, 4, 51, 14),
  bSite: rect(42, 12, 61, 28),
  bTunnels: rect(48, 26, 57, 49),
  bTunnelsLow: rect(39, 46, 55, 57),
  midToB: rect(37, 30, 50, 37),
  tToALong: rect(13, 48, 29, 57)
};

/** 掩体箱：命中判定按实际高度遮挡视线。 */
export const CRATES: Rect[] = [
  rect(7, 8, 10, 11),
  rect(12, 6, 15, 9),
  rect(17, 9, 19, 12),
  rect(16, 16, 19, 19),
  rect(6, 26, 9, 29),
  rect(8, 34, 11, 37),
  rect(9, 42, 12, 45),
  rect(20, 50, 23, 53),
  rect(32, 24, 35, 27),
  rect(34, 38, 37, 41),
  rect(41, 52, 44, 55),
  rect(50, 40, 53, 43),
  rect(52, 30, 55, 34),
  rect(45, 16, 48, 19),
  rect(55, 18, 58, 21),
  rect(46, 22, 49, 25),
  rect(25, 5, 28, 8),
  rect(36, 6, 39, 9),
  rect(29, 14, 32, 17)
];

export interface DoorDef {
  id: string;
  /** 门洞所在的两格走廊（门叶关闭时占据这两格）。 */
  cells: Rect;
  /** 进门方向（用于绘制与动画）。 */
  axis: 'x' | 'z';
}

export const DOORS: DoorDef[] = [
  { id: 'midDoors', cells: rect(33, 33, 38, 35), axis: 'x' }
];

export const BOMB_SITE_A = rect(6, 6, 20, 20);
export const BOMB_SITE_B = rect(44, 14, 59, 26);

export function bombSiteAt(gx: number, gy: number): 'A' | 'B' | null {
  const inA = gx >= BOMB_SITE_A.x0 && gx < BOMB_SITE_A.x1 && gy >= BOMB_SITE_A.y0 && gy < BOMB_SITE_A.y1;
  if (inA) return 'A';
  const inB = gx >= BOMB_SITE_B.x0 && gx < BOMB_SITE_B.x1 && gy >= BOMB_SITE_B.y0 && gy < BOMB_SITE_B.y1;
  return inB ? 'B' : null;
}

/** 造出整张网格：实心 → 挖房间 → 放箱子。 */
export function buildGrid(): Uint8Array {
  const g = new Uint8Array(GRID_W * GRID_H).fill(Cell.Wall);
  const carve = (r: Rect) => {
    for (let y = r.y0; y < r.y1; y++) {
      for (let x = r.x0; x < r.x1; x++) {
        if (x <= 0 || y <= 0 || x >= GRID_W - 1 || y >= GRID_H - 1) continue;
        g[x + y * GRID_W] = Cell.Floor;
      }
    }
  };
  Object.values(AREAS).forEach(carve);
  for (const c of CRATES) {
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        if (x <= 0 || y <= 0 || x >= GRID_W - 1 || y >= GRID_H - 1) continue;
        if (g[x + y * GRID_W] === Cell.Floor) g[x + y * GRID_W] = Cell.Crate;
      }
    }
  }
  return g;
}

export const GRID = buildGrid();

/** 门叶是否关闭（由引擎每帧写入；关闭时把门洞两格视为实心）。 */
export const doorClosed: Record<string, boolean> = { midDoors: true };

export function cellAt(gx: number, gy: number): Cell {
  if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return Cell.Wall;
  for (const d of DOORS) {
    if (doorClosed[d.id]) {
      const r = d.cells;
      if (gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1) return Cell.Wall;
    }
  }
  return GRID[gx + gy * GRID_W] as Cell;
}

export function cellHeight(gx: number, gy: number): number {
  const c = cellAt(gx, gy);
  if (c === Cell.Wall) return WALL_H;
  if (c === Cell.Crate) return CRATE_H;
  return 0;
}

export const gxToWorld = (gx: number): number => gx * CELL;
export const worldToGx = (x: number): number => Math.floor(x / CELL);
export const gyToWorld = (gy: number): number => gy * CELL;
export const worldToGy = (z: number): number => Math.floor(z / CELL);

export function areaCenterWorld(r: Rect): { x: number; z: number } {
  return { x: gxToWorld((r.x0 + r.x1) / 2), z: gyToWorld((r.y0 + r.y1) / 2) };
}

export const SPAWN_T = { x: gxToWorld(33.5), z: gyToWorld(53.5) };
export const SPAWN_CT = { x: gxToWorld(31.5), z: gyToWorld(7.5) };

export interface AABB {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

/** 把网格范围内的格子累计成碰撞盒查询：返回与给定 AABB 相交的最高阻挡高度。 */
export function highestBlocker(aabb: AABB): number {
  const x0 = worldToGx(aabb.minX);
  const x1 = worldToGx(aabb.maxX - 1e-4);
  const y0 = worldToGy(aabb.minZ);
  const y1 = worldToGy(aabb.maxZ - 1e-4);
  let h = 0;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      let ch = cellHeight(gx, gy);
      if (ch === 0) continue;
      // 门叶按门洞实际高度处理
      if (ch === WALL_H) {
        for (const d of DOORS) {
          if (!doorClosed[d.id]) continue;
          const r = d.cells;
          if (gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1) ch = 4.2;
        }
      }
      if (ch > h) h = ch;
    }
  }
  return h;
}

export function isFree(gx: number, gy: number): boolean {
  return cellAt(gx, gy) === Cell.Floor;
}

/** 视线与掩体：沿线段采样，任一采样点高度超过射线高度即被遮挡。 */
export function blockedLine(
  ax: number,
  az: number,
  ay: number,
  bx: number,
  bz: number,
  by: number
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (CELL * 0.4)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + dx * t;
    const pz = az + dz * t;
    const py = ay + (by - ay) * t;
    const h = cellHeight(worldToGx(px), worldToGy(pz));
    if (h > py) return true;
  }
  return false;
}

/** 洪水填充：从起点可达的地面格子集合（用于连通性自检与 AI 巡逻点采样）。 */
export function reachable(fromGx: number, fromGy: number): Uint8Array {
  const seen = new Uint8Array(GRID_W * GRID_H);
  const q: number[] = [fromGx + fromGy * GRID_W];
  seen[q[0]] = 1;
  while (q.length) {
    const cur = q.pop() as number;
    const cx = cur % GRID_W;
    const cy = (cur - cx) / GRID_W;
    const nb = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const idx = nx + ny * GRID_W;
      if (seen[idx]) continue;
      if (GRID[idx] === Cell.Wall) continue;
      seen[idx] = 1;
      q.push(idx);
    }
  }
  return seen;
}
