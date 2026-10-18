import * as THREE from 'three';
import { PlayerLike } from './player';
import { MapData, nearestNode, bfsPath } from './map';
import { Team, WeaponId } from './types';
import { currentWeapon } from './player';

export type AIState = 'patrol' | 'seek' | 'combat' | 'plant' | 'defuse';

export interface AI {
  playerId: number;
  state: AIState;
  targetNodeId: number | null;
  path: { x: number; z: number }[];
  pathIdx: number;
  patrolTarget: { x: number; z: number } | null;
  reactionDelay: number;
  lastSeenEnemyTime: number;
  seenEnemyPos: { x: number; y: number; z: number } | null;
  nextDecisionTime: number;
  fireCooldown: number;
  aimError: number;
}

export function createAI(playerId: number): AI {
  return {
    playerId,
    state: 'patrol',
    targetNodeId: null,
    path: [],
    pathIdx: 0,
    patrolTarget: null,
    reactionDelay: 0.2 + Math.random() * 0.3,
    lastSeenEnemyTime: -100,
    seenEnemyPos: null,
    nextDecisionTime: 0,
    fireCooldown: 0,
    aimError: 0.05 + Math.random() * 0.08,
  };
}

// Line-of-sight check: returns true if there's no solid box blocking from eye of a to body of b
function hasLOS(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  boxes: { x: number; y: number; z: number; w: number; h: number; d: number; type: string }[]
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const steps = Math.ceil(dist / 0.3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    const pz = from.z + dz * t;
    for (const b of boxes) {
      if (b.type === 'door' || b.type === 'ground') continue;
      if (
        px > b.x - b.w / 2 && px < b.x + b.w / 2 &&
        py > b.y - b.h / 2 && py < b.y + b.h / 2 &&
        pz > b.z - b.d / 2 && pz < b.z + b.d / 2
      ) {
        return false;
      }
    }
  }
  return true;
}

function choosePatrolTarget(
  ai: AI,
  p: PlayerLike,
  map: MapData
): { x: number; z: number } {
  // T heads toward bomb site A or B randomly; CT heads toward chokepoints/bomb sites
  if (p.team === 'T') {
    const goA = Math.random() < 0.5;
    return goA ? map.aSiteCenter : map.bSiteCenter;
  } else {
    const r = Math.random();
    if (r < 0.35) return map.aSiteCenter;
    if (r < 0.7) return map.bSiteCenter;
    return { x: 30, z: 20 }; // mid
  }
}

function moveAlongPath(
  ai: AI,
  p: PlayerLike,
  map: MapData,
  dt: number,
  players: PlayerLike[]
) {
  if (ai.path.length === 0 || ai.pathIdx >= ai.path.length) {
    // replan
    if (!ai.patrolTarget) ai.patrolTarget = choosePatrolTarget(ai, p, map);
    const from = nearestNode(map, p.pos.x, p.pos.z);
    const to = nearestNode(map, ai.patrolTarget.x, ai.patrolTarget.z);
    if (from && to) {
      const nodes = bfsPath(map, from.id, to.id);
      if (nodes) {
        ai.path = nodes.map((n) => ({ x: n.x, z: n.z }));
        ai.pathIdx = 0;
      }
    }
    return;
  }

  const tgt = ai.path[ai.pathIdx];
  const dx = tgt.x - p.pos.x;
  const dz = tgt.z - p.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.8) {
    ai.pathIdx++;
    return;
  }
  // walk toward target
  const speed = 4.0;
  const nx = dx / d;
  const nz = dz / d;
  p.vel.x = nx * speed;
  p.vel.z = nz * speed;
  // face movement direction (approx)
  p.yaw = Math.atan2(nx, nz);
}

function lookAt(p: PlayerLike, tx: number, ty: number, tz: number) {
  const dx = tx - p.pos.x;
  const dy = ty - (p.pos.y + 1.5);
  const dz = tz - p.pos.z;
  const horiz = Math.sqrt(dx * dx + dz * dz);
  p.yaw = Math.atan2(dx, dz);
  p.pitch = Math.atan2(-dy, horiz);
}

// Main AI update
export function updateAI(
  ai: AI,
  p: PlayerLike,
  map: MapData,
  players: PlayerLike[],
  boxes: any[],
  dt: number,
  c4: any,
  gameTime: number
) {
  if (!p.alive) {
    p.vel.x = 0;
    p.vel.z = 0;
    return;
  }

  // Find visible enemies
  let closestEnemy: PlayerLike | null = null;
  let closestDist = Infinity;
  const myEye = { x: p.pos.x, y: p.pos.y + 1.5, z: p.pos.z };
  for (const other of players) {
    if (!other.alive) continue;
    if (other.team === p.team) continue;
    const theirBody = { x: other.pos.x, y: other.pos.y + 1, z: other.pos.z };
    const dx = theirBody.x - myEye.x;
    const dz = theirBody.z - myEye.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 60) continue;
    if (hasLOS(myEye, theirBody, boxes)) {
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = other;
      }
    }
  }

  // State transitions
  if (c4 && c4.state === 'active' && p.team === 'CT') {
    ai.state = 'defuse';
  } else if (c4 && c4.state === 'carried' && c4.carrierId === p.id && p.team === 'T') {
    // go plant
    const atSite =
      (Math.abs(p.pos.x - map.aSiteCenter.x) < 4 && Math.abs(p.pos.z - map.aSiteCenter.z) < 4) ||
      (Math.abs(p.pos.x - map.bSiteCenter.x) < 4 && Math.abs(p.pos.z - map.bSiteCenter.z) < 4);
    ai.state = atSite ? 'plant' : 'seek';
    ai.patrolTarget = p.pos.x < 30 ? map.bSiteCenter : map.aSiteCenter;
  } else if (closestEnemy) {
    ai.state = 'combat';
    ai.lastSeenEnemyTime = gameTime;
    ai.seenEnemyPos = { x: closestEnemy.pos.x, y: closestEnemy.pos.y, z: closestEnemy.pos.z };
  } else if (ai.state === 'combat' && gameTime - ai.lastSeenEnemyTime < 3) {
    // seek last known position
    ai.state = 'seek';
  } else {
    ai.state = 'patrol';
  }

  p.vel.x = 0;
  p.vel.z = 0;

  // React according to state
  if (ai.state === 'combat' && closestEnemy) {
    // Face enemy with aim error
    const errX = (Math.random() - 0.5) * ai.aimError;
    const errY = (Math.random() - 0.5) * ai.aimError;
    lookAt(
      p,
      closestEnemy.pos.x + errX * 3,
      closestEnemy.pos.y + 1.3 + errY * 2,
      closestEnemy.pos.z + errX * 3
    );
    // Strafe slightly
    const strafe = Math.sin(gameTime * 2 + p.id) * 1.5;
    const forward = Math.cos(gameTime * 1.5 + p.id) * 1.5;
    const cosY = Math.cos(p.yaw);
    const sinY = Math.sin(p.yaw);
    p.vel.x = sinY * forward + cosY * strafe;
    p.vel.z = cosY * forward - sinY * strafe;
    // Shoot if ready and roughly aimed
    const w = currentWeapon(p);
    const minTimeBetweenShots = 60 / w.config.fireRate;
    if (gameTime - w.lastShotTime > minTimeBetweenShots + 0.05 && closestDist < w.config.range) {
      // only shoot when aim roughly on target
      const targetYaw = Math.atan2(closestEnemy.pos.x - p.pos.x, closestEnemy.pos.z - p.pos.z);
      let yawDiff = targetYaw - p.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      if (Math.abs(yawDiff) < 0.2) {
        p.shootInput = true;
      }
    } else {
      p.shootInput = false;
    }
    // reload if empty
    if (w.ammoInMag === 0 && !w.reloading) {
      p.reloadInput = true;
    }
  } else if (ai.state === 'seek' && ai.seenEnemyPos) {
    ai.patrolTarget = { x: ai.seenEnemyPos.x, z: ai.seenEnemyPos.z };
    moveAlongPath(ai, p, map, dt, players);
    lookAt(p, ai.seenEnemyPos.x, ai.seenEnemyPos.y + 1, ai.seenEnemyPos.z);
  } else if (ai.state === 'plant') {
    // face bomb site and plant
    const site = p.pos.x < 30 ? map.bSiteCenter : map.aSiteCenter;
    lookAt(p, site.x, 1, site.z);
    p.vel.x = 0;
    p.vel.z = 0;
    // Signal to plant (handled in game.ts when near site and pressing E)
    (p as any).wantPlant = true;
  } else if (ai.state === 'defuse') {
    if (c4.state === 'active' && c4.pos) {
      const dx = c4.pos.x - p.pos.x;
      const dz = c4.pos.z - p.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 2) {
        p.vel.x = 0;
        p.vel.z = 0;
        (p as any).wantDefuse = true;
      } else {
        ai.patrolTarget = { x: c4.pos.x, z: c4.pos.z };
        moveAlongPath(ai, p, map, dt, players);
      }
    }
  } else {
    // patrol
    if (!ai.patrolTarget || (Math.abs(p.pos.x - ai.patrolTarget.x) < 2 && Math.abs(p.pos.z - ai.patrolTarget.z) < 2)) {
      ai.patrolTarget = choosePatrolTarget(ai, p, map);
      ai.path = [];
    }
    moveAlongPath(ai, p, map, dt, players);
  }
}
