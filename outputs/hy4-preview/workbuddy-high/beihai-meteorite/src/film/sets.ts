// Scene sets. Each builder returns a self-contained Group plus an optional
// per-frame update. Everything is boxes and blocky primitives.

import * as THREE from 'three';
import { M, PALETTE, block, bake, blockyCylinder, blockySphere, starfield, debrisField, rng, panelLines, mat } from './vox';
import { makeCast, poseFigure, makeFigure } from './characters';

export interface SetResult {
  group: THREE.Group;
  update?: (t: number, local: number, dt: number) => void;
}

const lamp = (color: number, intensity: number, dist = 26) =>
  new THREE.PointLight(color, intensity, dist, 1.8);

/* ============================================================
   1. Titles — deep space
   ============================================================ */
export function buildTitles(): SetResult {
  const g = new THREE.Group();
  const stars = starfield(1400, 620, 11);
  g.add(stars);
  const dust = debrisField(320, 90, 23);
  g.add(dust);
  g.add(new THREE.AmbientLight(0x223046, 1.1));
  const key = new THREE.DirectionalLight(0xfff0d0, 0.9);
  key.position.set(6, 4, 8);
  g.add(key);
  return {
    group: g,
    update: (t) => {
      stars.rotation.y = t * 0.004;
      dust.rotation.y = -t * 0.02;
      dust.position.y = Math.sin(t * 0.1) * 0.6;
    }
  };
}

/* ============================================================
   2. Orbit — Earth from the station
   ============================================================ */
export function buildOrbit(): SetResult {
  const g = new THREE.Group();
  const stars = starfield(1100, 700, 29);
  g.add(stars);

  const earth = new THREE.Group();
  earth.position.set(6, -46, -34);
  const blue = M.earth();
  const core = blockySphere(blue, 40, 11, 41);
  earth.add(core);
  const land = mat(PALETTE.earthGreen, { roughness: 0.94 });
  const r = rng(97);
  for (let i = 0; i < 26; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const p = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s).multiplyScalar(40.4);
    const size = 3 + r() * 7;
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.4, size * (0.6 + r())), land);
    m.position.copy(p);
    m.lookAt(0, 0, 0);
    m.rotateX(Math.PI / 2);
    earth.add(m);
  }
  const clouds = new THREE.Group();
  const cm = M.cloud();
  for (let i = 0; i < 34; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const p = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s).multiplyScalar(41.2);
    const w = 4 + r() * 11, h = 3 + r() * 6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, h), cm);
    m.position.copy(p);
    m.lookAt(0, 0, 0);
    m.rotateX(Math.PI / 2);
    clouds.add(m);
  }
  earth.add(clouds);
  // thin atmosphere rim
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(41.6, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x6fb6f0, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  earth.add(halo);
  g.add(earth);

  g.add(new THREE.AmbientLight(0x2b3a52, 1.25));
  const sun = new THREE.DirectionalLight(0xfff6e2, 3.4);
  sun.position.set(-30, 26, 44);
  g.add(sun);
  const bounce = new THREE.DirectionalLight(0x4d7fb0, 1.0);
  bounce.position.set(20, -30, -20);
  g.add(bounce);

  return {
    group: g,
    update: (t) => {
      earth.rotation.y = t * 0.012;
      clouds.rotation.y = t * 0.019;
      stars.rotation.y = -t * 0.003;
    }
  };
}

/* ============================================================
   3. Station exterior (shared by departure / pod / aftermath)
   ============================================================ */
function buildStationHull(target: THREE.Group, alarm: boolean) {
  const hull = M.hullMid();
  const dark = M.hullDark();
  const deep = M.hullDeep();
  const line = M.panel();
  const glow = M.glow();
  const alarmM = mat(0xd93a2a, { emissive: 0xd93a2a, emissiveIntensity: 1.2, roughness: 0.5 });

  // spine truss
  for (let i = -6; i <= 6; i++) {
    target.add(block(1.6, 1.6, 1.6, i % 2 === 0 ? hull : dark, 0, 0, i * 2.4));
    if (i % 2 === 0) {
      target.add(block(0.7, 0.7, 1.2, line, 0, 1.0, i * 2.4));
      target.add(block(0.7, 0.7, 1.2, line, 0, -1.0, i * 2.4));
    }
  }
  // hub
  const hub = new THREE.Group();
  blockyCylinder(hub, hull, 3.4, 5.2, 12, 0, 0.05);
  blockyCylinder(hub, line, 3.5, 0.5, 12, 1.6);
  blockyCylinder(hub, line, 3.5, 0.5, 12, -1.6);
  hub.rotation.z = Math.PI / 2;
  target.add(hub);

  // modules branching off
  for (const s of [-1, 1]) {
    const mod = new THREE.Group();
    blockyCylinder(mod, hull, 2.2, 6.0, 10, 0, 0.04);
    blockyCylinder(mod, line, 2.3, 0.35, 10, 2.0);
    blockyCylinder(mod, line, 2.3, 0.35, 10, -2.0);
    mod.position.set(0, s * 4.6, 0);
    target.add(mod);
    // windows
    for (let i = -2; i <= 2; i++) {
      const w = block(0.5, 0.5, 0.12, alarm ? alarmM : glow, i * 1.5, s * 6.4, 2.15);
      target.add(w);
    }
  }

  // solar arrays
  const panelM = mat(0x1d2a44, { roughness: 0.35, metalness: 0.6 });
  const frameM = mat(0x8b97a6, { roughness: 0.5, metalness: 0.5 });
  for (const s of [-1, 1]) {
    const arm = block(0.5, 0.5, 5.0, frameM, 0, 0, s * 8.6);
    target.add(arm);
    for (let w = 0; w < 2; w++) {
      const p = new THREE.Group();
      panelLines(p, frameM, -4.4, -2.2, 0, 4.4, 2.2, 0, 1.1, 0.08);
      p.add(block(8.8, 4.4, 0.16, panelM, 0, 0, -0.1));
      p.position.set(s * 0, 0, s * (12.2 + w * 4.8));
      p.rotation.y = s > 0 ? 0 : Math.PI;
      target.add(p);
    }
  }

  // docking collar + beacon
  const collar = new THREE.Group();
  blockyCylinder(collar, dark, 1.5, 1.4, 8, 0);
  collar.position.set(0, 0, 7.6);
  collar.rotation.x = Math.PI / 2;
  target.add(collar);
  const beacon = block(0.3, 0.3, 0.3, mat(0x59f0a0, { emissive: 0x59f0a0, emissiveIntensity: 1.6 }), 0, 1.1, 7.9);
  target.add(beacon);

  void deep;
  return beacon;
}

/* ============================================================
   4. Chamber — the meeting dome
   ============================================================ */
export function buildChamber(): SetResult {
  const g = new THREE.Group();
  const cast = makeCast();

  const floorM = mat(0x3a414c, { roughness: 0.9 });
  const wallM = mat(0x59636f, { roughness: 0.86 });
  const trimM = mat(0x2b323b, { roughness: 0.8 });
  const glassM = M.glass();
  const glowM = M.glow();

  // floor
  g.add(block(26, 0.6, 26, floorM, 0, -0.3, 0));
  // ring of floor inlay
  const inlayM = mat(0x8e9aa8, { roughness: 0.5, metalness: 0.4 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.add(block(1.2, 0.1, 0.6, inlayM, Math.cos(a) * 6.4, 0.02, Math.sin(a) * 6.4).rotateY(-a));
  }

  // curved wall made of stacked blocks
  const wall = new THREE.Group();
  const R = 12.4;
  for (let ring = 0; ring < 5; ring++) {
    const y = ring * 1.6 + 0.8;
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const w = (Math.PI * 2 * R) / n * 1.1;
      // leave a window gap facing -Z
      const inWindow = ring >= 1 && ring <= 3 && Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.55;
      if (inWindow) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 1.0), ring % 2 ? wallM : trimM);
      m.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
      m.rotation.y = -a;
      wall.add(m);
    }
  }
  g.add(wall);

  // the big window: frame + glass + Earth beyond
  const win = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4 - 0.5) * 1.0;
    win.add(block(0.5, 5.2, 1.2, trimM, Math.cos(a) * R, 2.8, Math.sin(a) * R).rotateY(-a));
  }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.4, R - 0.4, 4.8, 24, 1, true, Math.PI - 0.55, 1.1), glassM);
  glass.position.y = 2.8;
  win.add(glass);
  g.add(win);

  // table
  g.add(block(5.6, 0.24, 3.0, mat(0x6d7885, { roughness: 0.55, metalness: 0.35 }), 0, 1.0, 0));
  g.add(block(0.5, 1.0, 0.5, trimM, 0, 0.5, 0));
  // holo projector on the table
  const projector = block(0.7, 0.16, 0.7, mat(0x1d2430, { roughness: 0.4 }), 0, 1.2, 0);
  g.add(projector);
  const holo = new THREE.Group();
  const holoM = mat(0x7fd6e8, { emissive: 0x7fd6e8, emissiveIntensity: 1.1, transparent: true, opacity: 0.5, roughness: 0.3 });
  for (let i = 0; i < 3; i++) holo.add(block(2.4 - i * 0.5, 0.06, 1.6 - i * 0.35, holoM, 0, 1.35 + i * 0.22, 0));
  g.add(holo);

  // ceiling ring light
  const ringLight = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    ringLight.add(block(0.9, 0.18, 0.5, glowM, Math.cos(a) * 9.2, 8.6, Math.sin(a) * 9.2).rotateY(-a));
  }
  g.add(ringLight);

  // cast placement
  cast.elderA.root.position.set(-3.4, 0, -1.6); cast.elderA.root.rotation.y = 0.7;
  cast.elderB.root.position.set(3.4, 0, -1.6); cast.elderB.root.rotation.y = -0.7;
  cast.elderC.root.position.set(-3.0, 0, 2.0); cast.elderC.root.rotation.y = 0.35;
  cast.beihai.root.position.set(2.6, 0, 2.2); cast.beihai.root.rotation.y = -0.5;
  g.add(cast.elderA.root, cast.elderB.root, cast.elderC.root, cast.beihai.root);

  g.add(new THREE.AmbientLight(0x3a4c66, 1.2));
  const key = new THREE.DirectionalLight(0xffe9c8, 1.5); key.position.set(4, 14, -16); g.add(key);
  const fill = new THREE.DirectionalLight(0x6f9fd0, 0.7); fill.position.set(-8, 6, 10); g.add(fill);
  const l = lamp(0xffe2a8, 22, 30); l.position.set(0, 7.4, 0); g.add(l);

  return {
    group: g,
    update: (t, local) => {
      holo.rotation.y = t * 0.55;
      holo.position.y = Math.sin(t * 0.9) * 0.04;
      // who is speaking, driven by local shot time
      const s = local;
      poseFigure(cast.beihai, t, 'idle');
      poseFigure(cast.elderC, t, 'idle');
      if (s > 12.5 && s < 24.5) poseFigure(cast.elderA, t, 'speak');
      else poseFigure(cast.elderA, t, 'idle');
      if (s > 24.5 && s < 36.5) poseFigure(cast.elderB, t, 'speak');
      else poseFigure(cast.elderB, t, 'idle');
      if (s > 0 && s < 12.5) poseFigure(cast.beihai, t, 'idle');
    }
  };
}

/* ============================================================
   5. Quarters — the cabin and the decision
   ============================================================ */
export function buildQuarters(): SetResult {
  const g = new THREE.Group();
  const cast = makeCast();

  const wallM = mat(0x4a5361, { roughness: 0.88 });
  const darkM = mat(0x2c333d, { roughness: 0.85 });
  const floorM = mat(0x39404a, { roughness: 0.9 });
  const glowM = M.glow();

  g.add(block(11, 0.5, 11, floorM, 0, -0.25, 0));
  g.add(block(11, 5.2, 0.5, wallM, 0, 2.6, -5.5));
  g.add(block(0.5, 5.2, 11, wallM, -5.5, 2.6, 0));
  g.add(block(0.5, 5.2, 11, wallM, 5.5, 2.6, 0));
  g.add(block(11, 0.5, 11, darkM, 0, 5.2, 0));
  // wall ribs
  for (let i = -2; i <= 2; i++) g.add(block(0.3, 5.0, 0.3, darkM, i * 2.0, 2.6, -5.2));

  // porthole
  g.add(block(1.8, 1.8, 0.3, darkM, 2.6, 3.0, -5.4));
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.24, 16), M.glass());
  port.rotation.x = Math.PI / 2; port.position.set(2.6, 3.0, -5.35);
  g.add(port);
  const outside = starfield(220, 40, 51);
  outside.position.set(2.6, 3.0, -7.4);
  g.add(outside);

  // bunk
  g.add(block(2.2, 0.3, 4.4, mat(0x59636f, { roughness: 0.85 }), -3.6, 0.7, -1.6));
  g.add(block(2.0, 0.22, 4.2, mat(0x8b97a6, { roughness: 0.9 }), -3.6, 0.95, -1.6));
  g.add(block(2.0, 0.5, 0.9, mat(0x9aa5b2, { roughness: 0.95 }), -3.6, 1.2, -3.2));

  // desk + holo table
  g.add(block(2.6, 0.18, 1.4, mat(0x6d7885, { roughness: 0.6, metalness: 0.3 }), 1.4, 0.95, 2.4));
  for (const s of [-1, 1]) g.add(block(0.2, 0.95, 0.2, darkM, 1.4 + s * 1.1, 0.48, 2.4));

  // floating trajectory hologram
  const holo = new THREE.Group();
  const holoM = mat(0x7fd6e8, { emissive: 0x7fd6e8, emissiveIntensity: 1.15, transparent: true, opacity: 0.62 });
  const redM = mat(0xe07a4a, { emissive: 0xe07a4a, emissiveIntensity: 1.0, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 14; i++) {
    const b = block(0.16, 0.16, 0.16, i % 3 === 0 ? redM : holoM,
      -1.2 + i * 0.16, 1.2 + Math.sin(i * 0.4) * 0.24, 2.4 - i * 0.05);
    holo.add(b);
  }
  // a wide arc = the long route
  for (let i = 0; i < 22; i++) {
    const a = i / 21 * Math.PI * 0.9;
    holo.add(block(0.12, 0.12, 0.12, holoM,
      Math.cos(a) * 1.5 - 0.4, 1.5 + Math.sin(a) * 0.7, 2.4 + i * 0.03));
  }
  g.add(holo);

  // strip light
  g.add(block(6.4, 0.12, 0.3, glowM, 0, 5.0, -2.0));
  g.add(block(6.4, 0.12, 0.3, glowM, 0, 5.0, 2.4));

  cast.beihai.root.position.set(-0.4, 0, 0.6);
  cast.beihai.root.rotation.y = -2.35;
  g.add(cast.beihai.root);

  g.add(new THREE.AmbientLight(0x33415a, 1.0));
  const l = lamp(0xffe2a8, 16, 22); l.position.set(0, 4.6, -1.0); g.add(l);
  const rim = new THREE.DirectionalLight(0x7fb4e0, 1.1); rim.position.set(6, 4, -8); g.add(rim);

  return {
    group: g,
    update: (t) => {
      holo.rotation.y = t * 0.32;
      holo.position.y = Math.sin(t * 0.8) * 0.03;
      outside.rotation.y = t * 0.01;
      poseFigure(cast.beihai, t, 'idle');
    }
  };
}

/* ============================================================
   6. Workshop — machining the bullet
   ============================================================ */
export function buildWorkshop(): SetResult {
  const g = new THREE.Group();
  const cast = makeCast();

  const wallM = mat(0x515a66, { roughness: 0.9 });
  const darkM = mat(0x2b323b, { roughness: 0.85 });
  const steelM = mat(0x9aa5b2, { roughness: 0.45, metalness: 0.6 });
  const glowM = M.glow();
  const hotM = mat(0xff9a3c, { emissive: 0xff9a3c, emissiveIntensity: 1.4, roughness: 0.4 });

  g.add(block(16, 0.5, 12, mat(0x363d47, { roughness: 0.92 }), 0, -0.25, 0));
  g.add(block(16, 6.0, 0.5, wallM, 0, 3.0, -6.0));
  g.add(block(0.5, 6.0, 12, wallM, -8.0, 3.0, 0));
  g.add(block(16, 0.5, 12, darkM, 0, 6.0, 0));
  for (let i = -3; i <= 3; i++) g.add(block(0.34, 5.6, 0.34, darkM, i * 2.2, 3.0, -5.7));

  // workbench
  g.add(block(6.4, 0.3, 2.4, mat(0x6d7885, { roughness: 0.6, metalness: 0.35 }), 0, 1.0, 0));
  for (const s of [-1, 1]) for (const z of [-1, 1])
    g.add(block(0.26, 1.0, 0.26, darkM, s * 2.8, 0.5, z * 0.9));

  // lathe / milling head
  const mill = new THREE.Group();
  mill.add(block(1.4, 2.2, 1.4, steelM, 0, 1.1, 0));
  mill.add(block(0.5, 1.2, 0.5, darkM, 0, 2.6, 0));
  mill.add(block(1.6, 0.3, 0.6, steelM, 0, 2.15, 0.7));
  const spindle = block(0.28, 0.7, 0.28, mat(0xc0cad4, { roughness: 0.3, metalness: 0.8 }), 0, 1.75, 0.7);
  mill.add(spindle);
  mill.position.set(-2.2, 1.15, -0.2);
  g.add(mill);

  // the meteorite fragment on the bench
  const meteorite = new THREE.Group();
  const rockM = mat(PALETTE.rockDark, { roughness: 0.98, metalness: 0.06 });
  const rm = blockySphere(rockM, 0.26, 4, 67);
  meteorite.add(rm);
  const glintM = mat(0xb9c3ce, { roughness: 0.3, metalness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const b = block(0.05, 0.05, 0.05, glintM,
      (i % 3 - 1) * 0.12, 0.06 + (i % 2) * 0.1, (i % 2 - 0.5) * 0.14);
    meteorite.add(b);
  }
  meteorite.position.set(0.4, 1.32, 0.1);
  g.add(meteorite);

  // the weapon, assembled in pieces on the bench
  const gun = new THREE.Group();
  const gunM = mat(0x3b434e, { roughness: 0.4, metalness: 0.7 });
  const barrelM = mat(0x767f8b, { roughness: 0.3, metalness: 0.85 });
  gun.add(block(1.5, 0.22, 0.2, gunM, 0, 0, 0));                 // receiver
  gun.add(block(0.9, 0.16, 0.16, barrelM, 1.1, 0.02, 0));        // barrel
  gun.add(block(0.34, 0.5, 0.18, gunM, -0.5, -0.28, 0));         // grip
  gun.add(block(0.6, 0.1, 0.14, gunM, -0.1, 0.14, 0));           // rail
  gun.add(block(0.2, 0.2, 0.2, mat(0x7fd6e8, { emissive: 0x7fd6e8, emissiveIntensity: 1.0 }), 0.5, 0.16, 0.09));
  gun.position.set(2.0, 1.24, -0.3);
  gun.rotation.y = -0.35;
  g.add(gun);

  // sparks group that we toggle
  const sparks = new THREE.Points(
    (() => {
      const n = 90;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = (Math.random() - .5); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return geo;
    })(),
    new THREE.PointsMaterial({ color: 0xffb45a, size: 0.07, transparent: true, opacity: 0.9, fog: false })
  );
  sparks.position.set(-2.2, 2.5, 0.5);
  g.add(sparks);

  // wall cabinet + warning light
  g.add(block(3.0, 1.6, 0.6, darkM, -5.0, 2.6, -5.6));
  g.add(block(0.3, 0.3, 0.3, hotM, -3.2, 3.6, -5.4));

  // overhead lamps
  g.add(block(7.0, 0.14, 0.34, glowM, 0, 5.4, -1.6));
  g.add(block(7.0, 0.14, 0.34, glowM, 0, 5.4, 1.8));

  cast.beihai.root.position.set(-0.2, 0, 1.7);
  cast.beihai.root.rotation.y = Math.PI * 0.98;
  g.add(cast.beihai.root);

  g.add(new THREE.AmbientLight(0x39445a, 1.05));
  const l = lamp(0xffe2a8, 20, 26); l.position.set(0, 5.0, 0.4); g.add(l);
  const spark = lamp(0xff9a3c, 8, 7); spark.position.set(-2.2, 2.4, 0.5); g.add(spark);
  const rim = new THREE.DirectionalLight(0x86b8e8, 0.8); rim.position.set(7, 5, 6); g.add(rim);

  return {
    group: g,
    update: (t, local) => {
      const working = local > 4 && local < 40;
      spindle.rotation.y = t * (working ? 26 : 0.4);
      sparks.visible = working;
      if (working) {
        sparks.rotation.y = t * 8;
        (sparks.material as THREE.PointsMaterial).opacity = 0.55 + Math.abs(Math.sin(t * 22)) * 0.45;
        spark.intensity = 6 + Math.abs(Math.sin(t * 19)) * 9;
      } else {
        spark.intensity = 1.2;
      }
      meteorite.rotation.y = t * 0.4;
      meteorite.position.y = 1.32 + Math.sin(t * 0.7) * 0.012;
      // he picks the gun up near the end
      const lift = Math.max(0, Math.min(1, (local - 40) / 5));
      gun.position.y = 1.24 + lift * 0.34;
      gun.rotation.z = lift * -0.22;
      poseFigure(cast.beihai, t, working ? 'work' : 'idle');
      cast.beihai.armR.rotation.x = -1.05 - lift * 0.35;
      cast.beihai.forearmR.rotation.x = -0.7 - lift * 0.2;
    }
  };
}

/* ============================================================
   7. Departure bay
   ============================================================ */
export function buildBay(): SetResult {
  const g = new THREE.Group();
  const cast = makeCast();

  const floorM = mat(0x333a44, { roughness: 0.92 });
  const wallM = mat(0x4d5663, { roughness: 0.88 });
  const darkM = mat(0x272e37, { roughness: 0.85 });
  const glowM = M.glow();
  const warnM = M.warn();

  g.add(block(30, 0.5, 20, floorM, 0, -0.25, 0));
  g.add(block(30, 9.0, 0.5, wallM, 0, 4.5, -10.0));
  g.add(block(0.5, 9.0, 20, wallM, -15.0, 4.5, 0));
  g.add(block(0.5, 9.0, 20, wallM, 15.0, 4.5, 0));
  g.add(block(30, 0.5, 20, darkM, 0, 9.0, 0));
  for (let i = -6; i <= 6; i++) g.add(block(0.4, 8.6, 0.4, darkM, i * 2.2, 4.5, -9.7));
  // gantry rails
  for (const z of [-3, 3]) {
    g.add(block(26, 0.4, 0.4, warnM, 0, 7.4, z));
    for (let i = -5; i <= 5; i++) g.add(block(0.3, 3.0, 0.3, darkM, i * 2.4, 5.9, z));
  }
  // floor markings
  for (let i = -5; i <= 5; i++) g.add(block(0.3, 0.06, 12, warnM, i * 2.4, 0.02, 0));

  // the shuttle
  const craft = new THREE.Group();
  const hull = M.hullLight();
  const hullD = M.hullDark();
  craft.add(block(9.0, 2.2, 3.0, hull, 0, 0, 0));
  craft.add(block(3.0, 1.5, 2.4, M.glass(), 3.6, 0.5, 0));
  craft.add(block(6.0, 1.6, 2.6, hullD, -2.6, -0.2, 0));
  // wings / fins
  for (const s of [-1, 1]) craft.add(block(2.4, 0.3, 2.2, hullD, -3.4, 1.2, s * 2.0));
  // engines
  for (const s of [-1, 1]) {
    const e = block(1.6, 1.2, 1.2, mat(0x2b323b, { roughness: 0.5, metalness: 0.7 }), -6.0, -0.2, s * 1.0);
    craft.add(e);
  }
  const plume = new THREE.Group();
  const plumeM = mat(0xffc06a, { emissive: 0xffb04a, emissiveIntensity: 1.8, transparent: true, opacity: 0.75 });
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++)
    plume.add(block(0.9 - i * 0.12, 0.8 - i * 0.1, 0.8 - i * 0.1, plumeM, -7.0 - i * 1.1, -0.2, s * 1.0));
  plume.visible = false;
  craft.add(plume);
  // running lights
  for (let i = -3; i <= 3; i++) craft.add(block(0.14, 0.14, 0.14, glowM, i * 1.2, -1.2, 1.55));
  craft.position.set(-6, 1.5, 0);
  g.add(craft);

  // three elders boarding
  cast.elderA.root.position.set(-1.2, 0, 3.0); cast.elderA.root.rotation.y = -1.55;
  cast.elderB.root.position.set(0.4, 0, 3.6); cast.elderB.root.rotation.y = -1.55;
  cast.elderC.root.position.set(1.9, 0, 3.0); cast.elderC.root.rotation.y = -1.55;
  g.add(cast.elderA.root, cast.elderB.root, cast.elderC.root);
  // Beihai watching from the gantry
  cast.beihai.root.position.set(4.5, 0, 5.4); cast.beihai.root.rotation.y = -0.55;
  g.add(cast.beihai.root);

  g.add(new THREE.AmbientLight(0x38445c, 1.15));
  const key = new THREE.DirectionalLight(0xffe9c8, 1.35); key.position.set(10, 14, 8); g.add(key);
  const fill = new THREE.DirectionalLight(0x6f9fd0, 0.8); fill.position.set(-12, 8, -6); g.add(fill);
  for (const z of [-6, 0, 6]) { const l = lamp(0xffe2a8, 14, 26); l.position.set(0, 8.0, z); g.add(l); }
  const exit = lamp(0xff7a3c, 10, 18); exit.position.set(13.5, 2.0, 0); g.add(exit);

  return {
    group: g,
    update: (t, local) => {
      const boarding = local < 18;
      const walk = boarding ? 1 : 0;
      cast.elderA.root.position.x = -1.2 - (boarding ? local * 0.20 : 3.6);
      cast.elderB.root.position.x = 0.4 - (boarding ? local * 0.20 : 3.6);
      cast.elderC.root.position.x = 1.9 - (boarding ? local * 0.20 : 3.6);
      poseFigure(cast.elderA, t, walk ? 'walk' : 'idle', 0);
      poseFigure(cast.elderB, t, walk ? 'walk' : 'idle', 1.7);
      poseFigure(cast.elderC, t, walk ? 'walk' : 'idle', 3.4);
      poseFigure(cast.beihai, t, local > 20 ? 'salute' : 'idle');

      const launch = Math.max(0, Math.min(1, (local - 22) / 14));
      plume.visible = launch > 0.02;
      plume.scale.setScalar(0.4 + launch * 1.6);
      (plumeM as THREE.MeshStandardMaterial).opacity = 0.35 + launch * 0.5;
      exit.intensity = 6 + launch * 16;
      craft.position.x = -6 + launch * launch * 16;
      craft.position.y = 1.5 + launch * 1.2;
      craft.rotation.z = -launch * 0.05;
    }
  };
}

/* ============================================================
   8. External work position — the aim
   ============================================================ */
export function buildPod(): SetResult {
  const g = new THREE.Group();
  const cast = makeCast();

  const stars = starfield(1200, 640, 83);
  g.add(stars);
  const earth = new THREE.Group();
  const blue = M.earth();
  earth.add(blockySphere(blue, 60, 13, 91));
  const land = mat(PALETTE.earthGreen, { roughness: 0.94 });
  const r = rng(131);
  for (let i = 0; i < 30; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const p = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s).multiplyScalar(60.5);
    const size = 5 + r() * 10;
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.4, size * (0.6 + r())), land);
    m.position.copy(p); m.lookAt(0, 0, 0); m.rotateX(Math.PI / 2);
    earth.add(m);
  }
  earth.position.set(-8, -78, -22);
  g.add(earth);

  // station hull he is standing on
  const station = new THREE.Group();
  const beacon = buildStationHull(station, false);
  station.position.set(0, -6.5, -4);
  station.rotation.y = 0.4;
  station.scale.setScalar(1.5);
  g.add(station);

  // handrail + tether
  const railM = mat(0xc0cad4, { roughness: 0.4, metalness: 0.7 });
  g.add(block(0.16, 0.16, 3.2, railM, 1.4, 0.6, -1.0));
  for (const z of [-2.6, 0.6]) g.add(block(0.16, 0.7, 0.16, railM, 1.4, 0.3, z));
  const tether = block(0.07, 0.07, 5.0, mat(0xd9903a, { roughness: 0.9 }), 0.7, 0.5, -3.4);
  tether.rotation.x = 0.25;
  g.add(tether);

  // Beihai in EVA
  const eva = makeFigure({ suit: 'eva', helmet: true, scale: 1.0, seed: 5, accent: 0xd9903a });
  eva.root.position.set(0, 0, 1.2);
  eva.root.rotation.y = 0.12;
  g.add(eva.root);

  // the weapon, held
  const gunM = mat(0x3b434e, { roughness: 0.4, metalness: 0.7 });
  const barrelM = mat(0x767f8b, { roughness: 0.3, metalness: 0.85 });
  const gun = new THREE.Group();
  gun.add(block(1.5, 0.22, 0.2, gunM, 0, 0, 0));
  gun.add(block(1.1, 0.16, 0.16, barrelM, 1.2, 0.02, 0));
  gun.add(block(0.34, 0.5, 0.18, gunM, -0.5, -0.28, 0));
  gun.rotation.y = 0.12;
  g.add(gun);

  // distant target craft
  const target = new THREE.Group();
  const th = M.hullLight();
  target.add(block(6.0, 1.6, 2.2, th, 0, 0, 0));
  target.add(block(2.0, 1.0, 1.6, M.glass(), 2.6, 0.35, 0));
  for (const s of [-1, 1]) target.add(block(1.0, 0.9, 0.9, M.hullDark(), -3.2, -0.1, s * 0.8));
  for (let i = -2; i <= 2; i++) target.add(block(0.12, 0.12, 0.12, M.glow(), i * 1.0, -0.9, 1.15));
  target.position.set(10, 6, -74);
  g.add(target);

  g.add(new THREE.AmbientLight(0x2e3c54, 1.0));
  const sun = new THREE.DirectionalLight(0xfff6e2, 3.0); sun.position.set(-20, 24, 30); g.add(sun);
  const bounce = new THREE.DirectionalLight(0x4d7fb0, 1.4); bounce.position.set(14, -30, -10); g.add(bounce);

  void cast;
  void beacon;

  return {
    group: g,
    update: (t, local) => {
      stars.rotation.y = -t * 0.0035;
      earth.rotation.y = t * 0.008;
      station.rotation.z = Math.sin(t * 0.05) * 0.004;
      const aiming = local > 6;
      poseFigure(eva, t, aiming ? 'aim' : 'idle');
      // gun follows the right hand
      const arm = eva.armR;
      gun.position.set(
        eva.root.position.x + Math.cos(eva.root.rotation.y) * 0.5 + 0.1,
        eva.root.position.y + 1.42 + arm.rotation.x * -0.12,
        eva.root.position.z + 0.42
      );
      gun.rotation.set(arm.rotation.x * 0.6, eva.root.rotation.y + 0.12, 0);
      target.position.x = 10 + Math.sin(t * 0.18) * 1.4;
      target.position.y = 6 + Math.cos(t * 0.14) * 0.9;
      target.rotation.z = Math.sin(t * 0.2) * 0.02;
    }
  };
}

/* ============================================================
   9. The shot — vacuum crossing
   ============================================================ */
export function buildTheShot(): SetResult {
  const g = new THREE.Group();
  const stars = starfield(1500, 700, 151);
  g.add(stars);
  const earth = new THREE.Group();
  earth.add(blockySphere(M.earth(), 70, 14, 157));
  const r = rng(163);
  const land = mat(PALETTE.earthGreen, { roughness: 0.94 });
  for (let i = 0; i < 26; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const p = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s).multiplyScalar(70.5);
    const size = 6 + r() * 11;
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.4, size * (0.6 + r())), land);
    m.position.copy(p); m.lookAt(0, 0, 0); m.rotateX(Math.PI / 2);
    earth.add(m);
  }
  earth.position.set(20, -92, -30);
  g.add(earth);

  // the target craft, closer now
  const target = new THREE.Group();
  target.add(block(6.0, 1.6, 2.2, M.hullLight(), 0, 0, 0));
  target.add(block(2.0, 1.0, 1.6, M.glass(), 2.6, 0.35, 0));
  for (const s of [-1, 1]) target.add(block(1.0, 0.9, 0.9, M.hullDark(), -3.2, -0.1, s * 0.8));
  for (let i = -2; i <= 2; i++) target.add(block(0.12, 0.12, 0.12, M.glow(), i * 1.0, -0.9, 1.15));
  target.position.set(0, 0, -30);
  g.add(target);

  // the meteorite bullet
  const bullet = blockySphere(mat(PALETTE.rockDark, { roughness: 0.98 }), 0.22, 4, 179);
  bullet.position.set(-16, 2, 6);
  g.add(bullet);
  const glint = mat(0xb9c3ce, { roughness: 0.3, metalness: 0.85 });
  for (let i = 0; i < 4; i++) bullet.add(block(0.045, 0.045, 0.045, glint, (i % 2 - .5) * 0.18, 0.08, (i % 3 - 1) * 0.1));

  // impact debris, hidden until impact
  const debris = new THREE.Group();
  const dr = rng(191);
  const dMat = mat(0x8b97a6, { roughness: 0.6, metalness: 0.5 });
  const dMat2 = mat(0x3b434e, { roughness: 0.7 });
  for (let i = 0; i < 90; i++) {
    const s = 0.16 + dr() * 0.5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s * 0.8), dr() > 0.5 ? dMat : dMat2);
    m.userData.v = new THREE.Vector3((dr() - .5) * 6, (dr() - .5) * 6, (dr() - .5) * 6);
    m.userData.spin = new THREE.Vector3(dr() - .5, dr() - .5, dr() - .5).multiplyScalar(2.4);
    debris.add(m);
  }
  debris.visible = false;
  debris.position.copy(target.position);
  g.add(debris);

  // flash
  const flash = new THREE.PointLight(0xffe6a8, 0, 60, 2);
  flash.position.copy(target.position);
  g.add(flash);

  g.add(new THREE.AmbientLight(0x2a3650, 0.95));
  const sun = new THREE.DirectionalLight(0xfff6e2, 2.8); sun.position.set(-24, 20, 26); g.add(sun);
  const bounce = new THREE.DirectionalLight(0x4d7fb0, 1.5); bounce.position.set(16, -26, -12); g.add(bounce);

  let exploded = false;
  return {
    group: g,
    update: (t, local) => {
      stars.rotation.y = -t * 0.002;
      earth.rotation.y = t * 0.006;
      target.rotation.z = Math.sin(t * 0.2) * 0.02;
      target.position.x = Math.sin(t * 0.16) * 0.7;

      if (!exploded) {
        // the crossing: 12 s of silence, the bullet closes 22 units
        const p = Math.min(1, local / 11.5);
        bullet.position.set(-16 + p * 22, 2 - p * 1.4, 6 - p * 36);
        bullet.rotation.x = t * 3.2;
        bullet.rotation.y = t * 2.1;
        if (p >= 1) {
          exploded = true;
          debris.visible = true;
          target.visible = false;
          flash.intensity = 260;
          debris.children.forEach(c => { c.position.set(0, 0, 0); });
        }
      } else {
        const e = local - 11.5;
        flash.intensity = Math.max(0, 260 * Math.exp(-e * 2.4));
        debris.visible = true;
      }
      if (debris.visible) {
        const dt = 1 / 60;
        for (const c of debris.children) {
          c.position.addScaledVector(c.userData.v, dt);
          c.rotation.x += c.userData.spin.x * dt;
          c.rotation.y += c.userData.spin.y * dt;
        }
      }
    }
  };
}

/* ============================================================
   10. Aftermath — alarms and the verdict
   ============================================================ */
export function buildAftermath(): SetResult {
  const g = new THREE.Group();
  const stars = starfield(1000, 660, 197);
  g.add(stars);

  const station = new THREE.Group();
  buildStationHull(station, true);
  station.position.set(0, 0, -14);
  station.rotation.y = -0.3;
  g.add(station);

  // debris cloud drifting past
  const debris = new THREE.Group();
  const dr = rng(211);
  const dMat = mat(0x8b97a6, { roughness: 0.6, metalness: 0.5 });
  for (let i = 0; i < 70; i++) {
    const s = 0.1 + dr() * 0.34;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s), dMat);
    m.position.set((dr() - .5) * 22, (dr() - .5) * 12, (dr() - .5) * 18 + 4);
    m.userData.spin = (dr() - .5) * 1.4;
    m.userData.drift = (dr() - .5) * 0.5;
    debris.add(m);
  }
  g.add(debris);

  const cast = makeCast();
  const wallM = mat(0x4d5663, { roughness: 0.88 });
  const darkM = mat(0x272e37, { roughness: 0.85 });
  const room = new THREE.Group();
  room.add(block(14, 0.5, 12, mat(0x333a44, { roughness: 0.92 }), 0, -0.25, 0));
  room.add(block(14, 6.0, 0.5, wallM, 0, 3.0, -6.0));
  room.add(block(0.5, 6.0, 12, wallM, -7.0, 3.0, 0));
  room.add(block(0.5, 6.0, 12, wallM, 7.0, 3.0, 0));
  room.add(block(14, 0.5, 12, darkM, 0, 6.0, 0));
  // console bank with a red alarm strip
  room.add(block(9.0, 1.2, 1.4, darkM, 0, 0.6, -5.0));
  const strip = block(8.6, 0.16, 0.2, mat(0xd93a2a, { emissive: 0xd93a2a, emissiveIntensity: 1.4 }), 0, 1.3, -4.8);
  room.add(strip);
  for (let i = 0; i < 6; i++) {
    room.add(block(1.0, 0.8, 0.12, mat(0x1d2430, { roughness: 0.4 }), -3.4 + i * 1.4, 1.5, -5.4));
  }
  cast.beihai.root.position.set(1.6, 0, 2.4); cast.beihai.root.rotation.y = -0.3;
  room.add(cast.beihai.root);
  cast.tech.root.position.set(-2.4, 0, 2.8); cast.tech.root.rotation.y = 0.4;
  room.add(cast.tech.root);
  room.position.set(0, -0.2, 0);
  g.add(room);

  g.add(new THREE.AmbientLight(0x4a3540, 1.1));
  const alarm1 = lamp(0xff3a26, 26, 34); alarm1.position.set(0, 4.4, -2.0); g.add(alarm1);
  const alarm2 = lamp(0xff3a26, 20, 30); alarm2.position.set(0, 4.4, 4.0); g.add(alarm2);
  const cool = new THREE.DirectionalLight(0x86b8e8, 1.0); cool.position.set(10, 8, 10); g.add(cool);

  const stripMat = strip.material as THREE.MeshStandardMaterial;

  return {
    group: g,
    update: (t, local) => {
      const pulse = Math.max(0, Math.sin(t * 5.2));
      alarm1.intensity = 8 + pulse * 26;
      alarm2.intensity = 6 + (1 - pulse) * 22;
      stripMat.emissiveIntensity = 0.5 + pulse * 1.6;
      stars.rotation.y = t * 0.002;
      station.rotation.z = Math.sin(t * 0.04) * 0.005;
      for (const c of debris.children) {
        c.rotation.x += c.userData.spin * 0.01;
        c.rotation.y += c.userData.spin * 0.014;
        c.position.x += c.userData.drift * 0.01;
      }
      poseFigure(cast.beihai, t, 'idle');
      poseFigure(cast.tech, t, local > 6 && local < 14 ? 'speak' : 'idle');
    }
  };
}

/* ============================================================
   11. Credits
   ============================================================ */
export function buildCredits(): SetResult {
  const g = new THREE.Group();
  const stars = starfield(1600, 640, 233);
  g.add(stars);
  const dust = debrisField(400, 120, 239);
  g.add(dust);
  g.add(new THREE.AmbientLight(0x223046, 1.15));
  const key = new THREE.DirectionalLight(0xfff0d0, 0.8);
  key.position.set(8, 6, 10);
  g.add(key);
  return {
    group: g,
    update: (t) => {
      stars.rotation.y = t * 0.006;
      stars.rotation.x = Math.sin(t * 0.05) * 0.02;
      dust.rotation.y = -t * 0.014;
    }
  };
}
