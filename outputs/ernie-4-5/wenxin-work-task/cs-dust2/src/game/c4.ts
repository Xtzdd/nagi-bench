import { C4, Team } from './types';
import { PlayerLike } from './player';
import { MapData } from './map';
import * as THREE from 'three';

export function createC4(): C4 {
  return {
    state: 'carried',
    carrierId: null,
    pos: { x: 0, y: 0, z: 0 },
    plantTimer: 0,
    plantDuration: 3,
    fuseTimer: 40,
    defuseTimer: 0,
    defuseDuration: 5,
    defuserId: null,
    bombSite: null,
  };
}

export function assignBombToRandomT(players: PlayerLike[], c4: C4) {
  const ts = players.filter((p) => p.team === 'T' && p.alive);
  if (ts.length === 0) return;
  const carrier = ts[Math.floor(Math.random() * ts.length)];
  c4.state = 'carried';
  c4.carrierId = carrier.id;
  c4.pos = { x: carrier.pos.x, y: 0.2, z: carrier.pos.z };
  c4.plantTimer = 0;
  c4.fuseTimer = 40;
  c4.defuseTimer = 0;
  c4.defuserId = null;
  c4.bombSite = null;
}

export function inBombSite(pos: { x: number; z: number }, map: MapData): 'A' | 'B' | null {
  const da = Math.hypot(pos.x - map.aSiteCenter.x, pos.z - map.aSiteCenter.z);
  const db = Math.hypot(pos.x - map.bSiteCenter.x, pos.z - map.bSiteCenter.z);
  if (da < 5) return 'A';
  if (db < 5) return 'B';
  return null;
}

export function updateC4(
  c4: C4,
  players: PlayerLike[],
  map: MapData,
  dt: number,
  onExplode: () => void
) {
  if (c4.state === 'carried') {
    const carrier = players.find((p) => p.id === c4.carrierId);
    if (carrier && carrier.alive) {
      c4.pos = { x: carrier.pos.x, y: 0.2, z: carrier.pos.z };
    } else {
      // drop
      c4.state = 'dropped';
      c4.carrierId = null;
    }
  } else if (c4.state === 'dropped') {
    // look for a T nearby to pick up (auto pickup for simplicity when close)
    for (const p of players) {
      if (p.team !== 'T' || !p.alive) continue;
      const d = Math.hypot(p.pos.x - c4.pos.x, p.pos.z - c4.pos.z);
      if (d < 1.5) {
        c4.carrierId = p.id;
        c4.state = 'carried';
        break;
      }
    }
  } else if (c4.state === 'planting') {
    c4.plantTimer += dt;
    const planter = players.find((p) => p.id === c4.carrierId);
    if (!planter || !planter.alive) {
      c4.state = 'dropped';
      c4.carrierId = null;
      c4.plantTimer = 0;
    } else if (c4.plantTimer >= c4.plantDuration) {
      // planted successfully
      c4.state = 'active';
      c4.pos = { x: planter.pos.x, y: 0.1, z: planter.pos.z };
      c4.bombSite = inBombSite(c4.pos, map);
      c4.carrierId = null;
      c4.fuseTimer = 40;
    }
  } else if (c4.state === 'active') {
    c4.fuseTimer -= dt;
    if (c4.defuserId !== null) {
      const defuser = players.find((p) => p.id === c4.defuserId);
      if (!defuser || !defuser.alive || Math.hypot(defuser.pos.x - c4.pos.x, defuser.pos.z - c4.pos.z) > 2) {
        c4.defuserId = null;
        c4.defuseTimer = 0;
      } else {
        c4.defuseTimer += dt;
        if (c4.defuseTimer >= c4.defuseDuration) {
          c4.state = 'defused';
        }
      }
    }
    if (c4.fuseTimer <= 0) {
      c4.fuseTimer = 0;
      c4.state = 'exploded';
      onExplode();
    }
  }
}

export function startPlant(c4: C4, player: PlayerLike, map: MapData) {
  if (c4.state !== 'carried' || c4.carrierId !== player.id) return false;
  const site = inBombSite(player.pos, map);
  if (!site) return false;
  c4.state = 'planting';
  c4.plantTimer = 0;
  return true;
}

export function startDefuse(c4: C4, player: PlayerLike) {
  if (c4.state !== 'active') return false;
  if (player.team !== 'CT') return false;
  const d = Math.hypot(player.pos.x - c4.pos.x, player.pos.z - c4.pos.z);
  if (d > 2) return false;
  c4.defuserId = player.id;
  c4.defuseTimer = 0;
  // defuse kit shortens (simulate by checking money>400 as "has kit" approx)
  c4.defuseDuration = player.money >= 400 ? 3 : 5;
  return true;
}
