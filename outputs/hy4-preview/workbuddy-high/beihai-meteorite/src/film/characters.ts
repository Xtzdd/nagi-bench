// Blocky humanoid figures.
//
// Each character is deliberately built from separate head / torso / arms / legs
// blocks — no capsule or single-column shortcut — and returns a rig the shots
// can animate. Faces are suggested with a visor or eye blocks only.

import * as THREE from 'three';
import { M, PALETTE, block, mat } from './vox';

export interface Figure {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  height: number;
  seed: number;
}

export interface FigureOpts {
  suit?: 'navy' | 'light' | 'civil' | 'eva';
  hair?: number;
  skin?: number;
  accent?: number;
  scale?: number;
  seed?: number;
  helmet?: boolean;
}

export function makeFigure(opts: FigureOpts = {}): Figure {
  const scale = opts.scale ?? 1;
  const seed = opts.seed ?? 3;
  const skin = mat(opts.skin ?? PALETTE.skin, { roughness: 0.9, metalness: 0 });
  const hair = mat(opts.hair ?? PALETTE.hair, { roughness: 0.95 });

  let suitM: THREE.Material;
  let trimM: THREE.Material;
  switch (opts.suit) {
    case 'light': suitM = mat(0xdde4ea, { roughness: 0.7 }); trimM = mat(0x9fb0bd, { roughness: 0.6 }); break;
    case 'civil': suitM = mat(0x4a5462, { roughness: 0.85 }); trimM = mat(0x2f3944, { roughness: 0.8 }); break;
    case 'eva': suitM = M.suitA(); trimM = mat(0xc0cad4, { roughness: 0.5, metalness: 0.4 }); break;
    default: suitM = mat(PALETTE.suitB, { roughness: 0.82 }); trimM = mat(0x18202a, { roughness: 0.7 }); break;
  }
  const accent = mat(opts.accent ?? PALETTE.cyan, { emissive: opts.accent ?? PALETTE.cyan, emissiveIntensity: 0.7, roughness: 0.4 });

  const root = new THREE.Group();

  // ---- hips / pelvis ----
  const hips = new THREE.Group();
  hips.position.y = 0.92 * scale;
  root.add(hips);
  hips.add(block(0.52 * scale, 0.22 * scale, 0.32 * scale, trimM, 0, 0, 0));

  // ---- torso ----
  const torso = new THREE.Group();
  torso.position.y = 0.11 * scale;
  hips.add(torso);
  torso.add(block(0.58 * scale, 0.62 * scale, 0.34 * scale, suitM, 0, 0.31 * scale, 0));
  // chest rig / collar
  torso.add(block(0.60 * scale, 0.10 * scale, 0.36 * scale, trimM, 0, 0.58 * scale, 0));
  torso.add(block(0.14 * scale, 0.10 * scale, 0.05 * scale, accent, -0.16 * scale, 0.44 * scale, 0.18 * scale));
  // shoulders
  torso.add(block(0.16 * scale, 0.16 * scale, 0.30 * scale, trimM, -0.35 * scale, 0.52 * scale, 0));
  torso.add(block(0.16 * scale, 0.16 * scale, 0.30 * scale, trimM, 0.35 * scale, 0.52 * scale, 0));

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 0.66 * scale;
  torso.add(head);
  head.add(block(0.40 * scale, 0.38 * scale, 0.36 * scale, skin, 0, 0.19 * scale, 0));
  head.add(block(0.42 * scale, 0.12 * scale, 0.38 * scale, hair, 0, 0.40 * scale, 0));
  head.add(block(0.42 * scale, 0.34 * scale, 0.06 * scale, hair, 0, 0.22 * scale, -0.17 * scale));
  // eyes
  head.add(block(0.06 * scale, 0.06 * scale, 0.03 * scale, mat(0x14181d), -0.09 * scale, 0.21 * scale, 0.19 * scale));
  head.add(block(0.06 * scale, 0.06 * scale, 0.03 * scale, mat(0x14181d), 0.09 * scale, 0.21 * scale, 0.19 * scale));
  // neck
  head.add(block(0.16 * scale, 0.10 * scale, 0.16 * scale, skin, 0, 0.02 * scale, 0));

  if (opts.helmet) {
    const visor = mat(0x1a2632, { roughness: 0.15, metalness: 0.5, transparent: true, opacity: 0.85 });
    const shell = mat(0xe6ebf0, { roughness: 0.4, metalness: 0.2 });
    head.add(block(0.48 * scale, 0.48 * scale, 0.46 * scale, shell, 0, 0.24 * scale, 0));
    head.add(block(0.36 * scale, 0.20 * scale, 0.04 * scale, visor, 0, 0.22 * scale, 0.22 * scale));
    head.add(block(0.52 * scale, 0.06 * scale, 0.50 * scale, mat(0xc0cad4), 0, 0.46 * scale, 0));
  }

  // ---- arms (pivot at shoulder) ----
  function makeArm(side: number) {
    const upper = new THREE.Group();
    upper.position.set(side * 0.35 * scale, 0.52 * scale, 0);
    torso.add(upper);
    upper.add(block(0.15 * scale, 0.34 * scale, 0.16 * scale, suitM, 0, -0.17 * scale, 0));

    const fore = new THREE.Group();
    fore.position.y = -0.34 * scale;
    upper.add(fore);
    fore.add(block(0.13 * scale, 0.32 * scale, 0.14 * scale, suitM, 0, -0.16 * scale, 0));
    fore.add(block(0.14 * scale, 0.10 * scale, 0.15 * scale, skin, 0, -0.34 * scale, 0));
    return { upper, fore };
  }
  const aL = makeArm(-1);
  const aR = makeArm(1);

  // ---- legs (pivot at hip) ----
  function makeLeg(side: number) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.15 * scale, -0.05 * scale, 0);
    hips.add(leg);
    leg.add(block(0.19 * scale, 0.42 * scale, 0.20 * scale, suitM, 0, -0.21 * scale, 0));
    leg.add(block(0.20 * scale, 0.36 * scale, 0.21 * scale, trimM, 0, -0.58 * scale, 0));
    leg.add(block(0.21 * scale, 0.10 * scale, 0.28 * scale, mat(0x22282f, { roughness: 0.9 }), 0, -0.78 * scale, 0.03 * scale));
    return leg;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  return {
    root, hips, torso, head,
    armL: aL.upper, armR: aR.upper,
    forearmL: aL.fore, forearmR: aR.fore,
    legL, legR,
    height: 1.78 * scale,
    seed
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Pose = 'idle' | 'speak' | 'walk' | 'aim' | 'sit' | 'work' | 'salute' | 'dead';

/** Drive a figure's rig procedurally. `t` is absolute film time. */
export function poseFigure(f: Figure, t: number, pose: Pose, phase = 0) {
  const s = (f.seed % 97) / 97;
  const breath = Math.sin(t * 1.15 + s * 6.28) * 0.5 + 0.5;
  const sway = Math.sin(t * 0.62 + s * 6.28);

  // reset
  f.hips.position.y = 0.92 * (f.root.scale.x || 1);
  f.hips.rotation.set(0, 0, 0);
  f.torso.rotation.set(0, 0, 0);
  f.head.rotation.set(0, 0, 0);
  f.armL.rotation.set(0, 0, 0);
  f.armR.rotation.set(0, 0, 0);
  f.forearmL.rotation.set(0, 0, 0);
  f.forearmR.rotation.set(0, 0, 0);
  f.legL.rotation.set(0, 0, 0);
  f.legR.rotation.set(0, 0, 0);

  const sc = f.root.scale.x || 1;
  f.hips.position.y = 0.92 * sc;

  switch (pose) {
    case 'idle': {
      f.torso.rotation.y = sway * 0.05;
      f.head.rotation.y = -sway * 0.09;
      f.head.rotation.x = breath * 0.03 - 0.015;
      f.armL.rotation.x = Math.sin(t * 0.9 + s * 3) * 0.05;
      f.armR.rotation.x = -Math.sin(t * 0.9 + s * 3) * 0.05;
      f.armL.rotation.z = 0.08;
      f.armR.rotation.z = -0.08;
      f.hips.position.y = 0.92 * sc + breath * 0.008 * sc;
      break;
    }
    case 'speak': {
      const g = Math.max(0, Math.sin(t * 2.4 + s * 5));
      f.torso.rotation.y = sway * 0.07;
      f.head.rotation.y = -sway * 0.12;
      f.head.rotation.x = -0.04 - g * 0.05;
      f.armR.rotation.x = -0.5 - g * 0.35;
      f.forearmR.rotation.x = -0.7 - g * 0.4;
      f.armL.rotation.z = 0.1;
      f.armL.rotation.x = Math.sin(t * 0.8) * 0.06;
      break;
    }
    case 'walk': {
      const w = t * 3.1 + phase;
      const sw = Math.sin(w);
      f.legL.rotation.x = sw * 0.62;
      f.legR.rotation.x = -sw * 0.62;
      f.armL.rotation.x = -sw * 0.5;
      f.armR.rotation.x = sw * 0.5;
      f.forearmL.rotation.x = -0.25;
      f.forearmR.rotation.x = -0.25;
      f.torso.rotation.y = sw * 0.08;
      f.hips.position.y = 0.92 * sc + Math.abs(Math.sin(w)) * 0.035 * sc;
      f.head.rotation.x = 0.03;
      break;
    }
    case 'aim': {
      const steady = Math.sin(t * 7.3) * 0.004 + Math.sin(t * 1.7) * 0.008;
      f.armR.rotation.x = -1.42 + steady;
      f.armR.rotation.y = -0.22;
      f.forearmR.rotation.x = -0.16;
      f.armL.rotation.x = -1.05;
      f.armL.rotation.y = 0.3;
      f.forearmL.rotation.x = -0.7;
      f.torso.rotation.y = 0.16;
      f.head.rotation.y = -0.1;
      f.head.rotation.x = -0.05;
      f.legL.rotation.x = 0.12;
      f.legR.rotation.x = -0.16;
      f.hips.position.y = 0.92 * sc + Math.sin(t * 1.4) * 0.004 * sc;
      break;
    }
    case 'sit': {
      f.hips.position.y = 0.60 * sc;
      f.legL.rotation.x = -1.45;
      f.legR.rotation.x = -1.45;
      f.forearmL.rotation.x = -0.9;
      f.forearmR.rotation.x = -0.9;
      f.armL.rotation.x = -0.25;
      f.armR.rotation.x = -0.25;
      f.torso.rotation.x = 0.06;
      f.head.rotation.x = 0.05 + breath * 0.02;
      break;
    }
    case 'work': {
      const w = Math.sin(t * 3.6 + s * 4);
      f.torso.rotation.x = 0.24 + w * 0.04;
      f.armL.rotation.x = -1.1 + w * 0.12;
      f.armR.rotation.x = -1.15 - w * 0.12;
      f.forearmL.rotation.x = -0.75;
      f.forearmR.rotation.x = -0.8;
      f.head.rotation.x = 0.26;
      f.legL.rotation.x = 0.06;
      f.legR.rotation.x = -0.06;
      break;
    }
    case 'salute': {
      f.armR.rotation.x = -1.35;
      f.armR.rotation.z = -0.5;
      f.forearmR.rotation.x = -1.3;
      f.armL.rotation.z = 0.08;
      f.torso.rotation.x = -0.03;
      f.head.rotation.x = -0.02;
      break;
    }
    case 'dead': {
      f.torso.rotation.x = 0.5;
      f.head.rotation.x = 0.6;
      f.armL.rotation.x = 0.9;
      f.armR.rotation.x = 1.2;
      f.legL.rotation.x = -0.4;
      f.legR.rotation.x = 0.3;
      break;
    }
  }
  void lerp;
}

/** Four preset cast members. */
export function makeCast() {
  const beihai = makeFigure({ suit: 'navy', scale: 1.0, seed: 5, accent: 0xd9903a });
  const elderA = makeFigure({ suit: 'light', scale: 0.98, seed: 17, hair: 0xb9bcc0, accent: 0x9fb0bd });
  const elderB = makeFigure({ suit: 'light', scale: 0.95, seed: 31, hair: 0xc4c7cb, accent: 0x9fb0bd });
  const elderC = makeFigure({ suit: 'light', scale: 1.01, seed: 53, hair: 0xa8adb2, accent: 0x9fb0bd });
  const tech = makeFigure({ suit: 'civil', scale: 0.99, seed: 71, accent: 0x7fd6e8 });
  return { beihai, elderA, elderB, elderC, tech };
}
