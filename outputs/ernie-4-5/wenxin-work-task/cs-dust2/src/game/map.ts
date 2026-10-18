import { Box, NavNode } from './types';

export const MAP_WIDTH = 60;
export const MAP_DEPTH = 40;

export interface MapData {
  boxes: Box[];
  walls: Box[];
  grounds: Box[];
  crates: Box[];
  aSiteCenter: { x: number; z: number };
  bSiteCenter: { x: number; z: number };
  tSpawn: { x: number; y: number; z: number };
  ctSpawn: { x: number; y: number; z: number };
  navNodes: NavNode[];
}

// Coordinate system: x right, z depth (forward for CT spawn), y up.
// Map layout (top-down, approx Dust2-inspired):
// CT spawn near (0,20), T spawn near (60,20).
// Mid at x=30. A site at upper-right (45,8), B site at lower-left (15,32).
// A long goes from T spawn area to A site, mid doors at x=30,z=20,
// B tunnels lower-left leading to B site.

function b(x: number, y: number, z: number, w: number, h: number, d: number, type: Box['type']): Box {
  return { x, y, z, w, h, d, type };
}

export function buildMap(): MapData {
  const boxes: Box[] = [];
  const walls: Box[] = [];
  const grounds: Box[] = [];
  const crates: Box[] = [];

  // Ground
  const ground = b(MAP_WIDTH / 2, -0.05, MAP_DEPTH / 2, MAP_WIDTH, 0.1, MAP_DEPTH, 'ground');
  boxes.push(ground);
  grounds.push(ground);

  // Helper to add a wall
  function addWall(x: number, y: number, z: number, w: number, h: number, d: number) {
    const wall = b(x, y, z, w, h, d, 'wall');
    boxes.push(wall);
    walls.push(wall);
  }
  function addCrate(x: number, y: number, z: number, w: number, h: number, d: number, type: 'crate_metal' | 'crate_wood') {
    const c = b(x, y, z, w, h, d, type);
    boxes.push(c);
    crates.push(c);
  }

  // Outer boundary walls (height 4m)
  const H = 4;
  // South wall (z=0)
  addWall(MAP_WIDTH / 2, H / 2, 0, MAP_WIDTH, H, 0.5);
  // North wall (z=MAP_DEPTH)
  addWall(MAP_WIDTH / 2, H / 2, MAP_DEPTH, MAP_WIDTH, H, 0.5);
  // West wall (x=0)
  addWall(0, H / 2, MAP_DEPTH / 2, 0.5, H, MAP_DEPTH);
  // East wall (x=MAP_WIDTH)
  addWall(MAP_WIDTH, H / 2, MAP_DEPTH / 2, 0.5, H, MAP_DEPTH);

  // CT spawn walls (west side): enclose a small area
  addWall(6, H / 2, 12, 12, H, 0.5);
  addWall(6, H / 2, 28, 12, H, 0.5);
  // CT spawn opens eastward, also a back wall partially
  addWall(0.5, H / 2, 20, 1, H, 16); // extra west thick near CT

  // T spawn walls (east side)
  addWall(54, H / 2, 12, 12, H, 0.5);
  addWall(54, H / 2, 28, 12, H, 0.5);

  // Mid area divider: a vertical wall at x ~30 with a door gap around z=20
  // Upper section
  addWall(30, H / 2, 8, 0.5, H, 14);
  // Lower section
  addWall(30, H / 2, 32, 0.5, H, 14);
  // Mid doors (passable double doors - modeled as door type thin, but we keep them as non-solid? We'll mark as door and treat as non-blocking for collision optionally)
  const doorL = b(29.3, H / 2, 18.5, 0.3, H, 1.4, 'door');
  const doorR = b(30.7, H / 2, 21.5, 0.3, H, 1.4, 'door');
  boxes.push(doorL, doorR);

  // Catwalk wall (mid to A long upper)
  addWall(40, H / 2, 14, 20, H, 0.5);

  // A long walls (corridor from T side toward A site)
  addWall(48, H / 2, 6, 24, H, 0.5);
  addWall(48, H / 2, 14, 6, H, 0.5); // break to A site

  // A site enclosure (north-east)
  addWall(50, H / 2, 4, 20, H, 0.5); // north wall extends east
  addWall(40, H / 2, 4, 0.5, H, 8);

  // A site crates
  addCrate(46, 0.6, 6, 1.2, 1.2, 1.2, 'crate_metal');
  addCrate(44, 0.6, 8, 1.2, 1.2, 1.2, 'crate_wood');
  addCrate(48, 0.6, 8.5, 1.2, 1.2, 1.2, 'crate_metal');
  addCrate(47, 1.8, 7, 1.2, 1.2, 1.2, 'crate_wood');

  // B tunnels (south-west): entry from mid to B
  addWall(18, H / 2, 32, 24, H, 0.5);
  addWall(18, H / 2, 28, 0.5, H, 8);
  addWall(12, H / 2, 28, 12, H, 0.5);
  addWall(12, H / 2, 36, 0.5, H, 8);

  // B site walls (south-west corner)
  addWall(10, H / 2, 36, 4, H, 0.5);
  addWall(8, H / 2, 34, 0.5, H, 4);

  // B site crates
  addCrate(13, 0.6, 34, 1.2, 1.2, 1.2, 'crate_metal');
  addCrate(15, 0.6, 35.5, 1.2, 1.2, 1.2, 'crate_wood');
  addCrate(11, 1.8, 34, 1.2, 1.2, 1.2, 'crate_wood');
  addCrate(14, 0.6, 32.5, 1.0, 2.0, 1.0, 'crate_metal');

  // Some additional cover/blocks near mid
  addCrate(34, 0.6, 20, 1.2, 1.2, 1.2, 'crate_metal');
  addCrate(26, 0.6, 20, 1.2, 1.2, 1.2, 'crate_wood');

  // Key points
  const tSpawn = { x: 56, y: 0, z: 20 };
  const ctSpawn = { x: 4, y: 0, z: 20 };
  const aSiteCenter = { x: 46, z: 7 };
  const bSiteCenter = { x: 13, z: 34 };

  // Build nav nodes: grid of walkable points every ~4m, skipping inside walls.
  const navNodes: NavNode[] = [];
  const STEP = 4;
  const idAt: Record<string, number> = {};
  let nid = 0;
  for (let x = STEP; x < MAP_WIDTH; x += STEP) {
    for (let z = STEP; z < MAP_DEPTH; z += STEP) {
      // skip if inside a wall/crate
      let blocked = false;
      for (const wl of walls.concat(crates)) {
        if (
          x > wl.x - wl.w / 2 - 0.3 &&
          x < wl.x + wl.w / 2 + 0.3 &&
          z > wl.z - wl.d / 2 - 0.3 &&
          z < wl.z + wl.d / 2 + 0.3
        ) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        navNodes.push({ id: nid, x, z, connections: [] });
        idAt[`${x},${z}`] = nid;
        nid++;
      }
    }
  }
  // connect neighbors (4-dir and diagonals)
  for (const n of navNodes) {
    const dirs = [
      [STEP, 0],
      [-STEP, 0],
      [0, STEP],
      [0, -STEP],
      [STEP, STEP],
      [STEP, -STEP],
      [-STEP, STEP],
      [-STEP, -STEP],
    ];
    for (const [dx, dz] of dirs) {
      const key = `${n.x + dx},${n.z + dz}`;
      if (idAt[key] !== undefined) {
        n.connections.push(idAt[key]);
      }
    }
  }

  return {
    boxes,
    walls,
    grounds,
    crates,
    aSiteCenter,
    bSiteCenter,
    tSpawn,
    ctSpawn,
    navNodes,
  };
}

// Find nearest nav node to a position
export function nearestNode(map: MapData, x: number, z: number): NavNode | null {
  let best: NavNode | null = null;
  let bestD = Infinity;
  for (const n of map.navNodes) {
    const dx = n.x - x;
    const dz = n.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

// BFS pathfinding between two nav nodes returning list of nodes from start to end.
export function bfsPath(
  map: MapData,
  fromId: number,
  toId: number
): NavNode[] | null {
  if (fromId === toId) return [map.navNodes[fromId]];
  const prev: Record<number, number> = {};
  const visited = new Set<number>([fromId]);
  const queue: number[] = [fromId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === toId) {
      const path: NavNode[] = [];
      let c: number | undefined = cur;
      while (c !== undefined) {
        path.unshift(map.navNodes[c]);
        c = prev[c];
      }
      return path;
    }
    for (const nb of map.navNodes[cur].connections) {
      if (!visited.has(nb)) {
        visited.add(nb);
        prev[nb] = cur;
        queue.push(nb);
      }
    }
  }
  return null;
}
