// Dust2 5v5 FPS — core engine (Three.js + custom physics + AI)
import * as THREE from 'three';

export type Side = 'CT' | 'T';
export type WeaponId = 'knife' | 'glock' | 'usp' | 'deagle' | 'ak47' | 'm4a4' | 'awp';
export type HitZone = 'head' | 'chest' | 'stomach' | 'arm' | 'leg';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: 'primary' | 'secondary' | 'melee';
  damage: number;
  fireRate: number; // seconds between shots
  reloadTime: number;
  magSize: number;
  reserve: number;
  recoil: number;
  spread: number;
  range: number;
  automatic: boolean;
  headMul: number;
  bodyMul: number;
  armMul: number;
  legMul: number;
  armorPen: number;
  scope?: number; // fov when scoped
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife:  { id:'knife',  name:'Knife',    slot:'melee',    damage:40, fireRate:0.4, reloadTime:0,   magSize:1, reserve:999, recoil:0,    spread:0,    range:2.2, automatic:false, headMul:2,bodyMul:1,armMul:0.8,legMul:0.75, armorPen:0.8 },
  glock:  { id:'glock',  name:'Glock-18', slot:'secondary',damage:28, fireRate:0.15,reloadTime:2.2, magSize:20,reserve:120, recoil:0.01, spread:0.02, range:60,  automatic:false, headMul:4,bodyMul:1,armMul:1,legMul:0.75, armorPen:0.5 },
  usp:    { id:'usp',    name:'USP-S',    slot:'secondary',damage:35, fireRate:0.17,reloadTime:2.4, magSize:12,reserve:100, recoil:0.008,spread:0.012,range:70,  automatic:false, headMul:4,bodyMul:1,armMul:1,legMul:0.75, armorPen:0.55 },
  deagle: { id:'deagle', name:'Desert Eagle',slot:'secondary',damage:63,fireRate:0.35,reloadTime:2.4, magSize:7, reserve:35,  recoil:0.04, spread:0.025,range:100, automatic:false, headMul:4,bodyMul:1,armMul:1,legMul:0.75, armorPen:0.7 },
  ak47:   { id:'ak47',   name:'AK-47',    slot:'primary',  damage:36, fireRate:0.1, reloadTime:2.5, magSize:30,reserve:90,  recoil:0.04, spread:0.022,range:120, automatic:true,  headMul:4,bodyMul:1,armMul:1,legMul:0.75, armorPen:0.75 },
  m4a4:   { id:'m4a4',   name:'M4A4',     slot:'primary',  damage:30, fireRate:0.09,reloadTime:3.1, magSize:30,reserve:90,  recoil:0.025,spread:0.015,range:120, automatic:true,  headMul:4,bodyMul:1,armMul:1,legMul:0.75, armorPen:0.7 },
  awp:    { id:'awp',    name:'AWP',      slot:'primary',  damage:115,fireRate:1.5, reloadTime:3.7, magSize:5, reserve:30,  recoil:0.1,  spread:0.002,range:500, automatic:false, headMul:4,bodyMul:1,armMul:1,legMul:0.75, armorPen:0.95, scope:30 },
};

// ---- Simple Web Audio synthesizer ----
export class Audio {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  start(){
    if (this.ctx) return;
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
  }
  private env(gain: GainNode, t0:number, a:number, d:number, peak=1){
    const g = gain.gain;
    g.setValueAtTime(0,t0);
    g.linearRampToValueAtTime(peak,t0+a);
    g.exponentialRampToValueAtTime(0.0001,t0+a+d);
  }
  shot(w: WeaponId){
    if(!this.ctx||!this.masterGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.masterGain);
    const o = ctx.createOscillator();
    o.type='square';
    let base=140, dur=0.12;
    if (w==='ak47'){base=180;dur=0.1;}
    else if (w==='m4a4'){base=160;dur=0.08;}
    else if (w==='awp'){base=80;dur=0.35;}
    else if (w==='deagle'){base=120;dur=0.2;}
    else if (w==='usp'){base=260;dur=0.09;}
    else if (w==='glock'){base=280;dur=0.08;}
    else {base=300;dur=0.06;}
    o.frequency.setValueAtTime(base,t);
    o.frequency.exponentialRampToValueAtTime(40,t+dur);
    this.env(g,t,0.001,dur,0.6);
    o.connect(g);
    o.start(t); o.stop(t+dur+0.05);
    // noise burst for bang
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    n.buffer = buf;
    const ng = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type='bandpass'; bp.frequency.value=w==='awp'?200:1200; bp.Q.value=0.8;
    ng.gain.value= w==='awp'?0.8:0.3;
    n.connect(bp); bp.connect(ng); ng.connect(this.masterGain);
    n.start(t); n.stop(t+dur);
  }
  reload(){ this.tone(420,0.15,0.1); setTimeout(()=>this.tone(640,0.15,0.1),300); }
  scopeIn(){ this.tone(800,0.05,0.06); }
  scopeOut(){ this.tone(500,0.05,0.06); }
  beep(){ this.tone(1400,0.2,0.3); }
  bomb(){ this.tone(80,0.3,0.4); }
  explode(){
    if(!this.ctx||!this.masterGain) return;
    const ctx=this.ctx,t=ctx.currentTime;
    const n=ctx.createBufferSource();
    const buf=ctx.createBuffer(1,ctx.sampleRate*1.5,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
    n.buffer=buf;
    const g=ctx.createGain(); g.gain.value=0.8;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=180;
    n.connect(lp); lp.connect(g); g.connect(this.masterGain);
    n.start(t);
  }
  hit(){ this.tone(2200,0.03,0.05); }
  kill(){ this.tone(880,0.08,0.12); setTimeout(()=>this.tone(1320,0.1,0.15),80); }
  footstep(){ this.tone(80+Math.random()*40,0.03,0.04,0.08); }
  private tone(freq:number,dur:number,vol=0.2,type:OscillatorType='sine'){
    if(!this.ctx||!this.masterGain) return;
    const ctx=this.ctx,t=ctx.currentTime;
    const o=ctx.createOscillator(); o.type=type; o.frequency.value=freq;
    const g=ctx.createGain();
    o.connect(g); g.connect(this.masterGain);
    this.env(g,t,0.005,dur,vol);
    o.start(t); o.stop(t+dur+0.02);
  }
}

// ---- Map (Dust2-lite, block-based) ----
// Grid size in meters per cell
export const CELL = 1;
// We build a voxel-style map of axis-aligned boxes representing walls/boxes.
export interface Box { min: THREE.Vector3; max: THREE.Vector3; color:number; }

export function buildMap(): Box[] {
  const boxes: Box[] = [];
  const add = (x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,color:number)=>{
    boxes.push({min:new THREE.Vector3(x0,y0,z0),max:new THREE.Vector3(x1,y1,z1),color});
  };
  // Ground
  add(0,0,0,44,0,52, 0xc9a774);
  // outer walls (tall)
  const H = 6;
  // outer boundary
  add(0,0,0,44,H,0.4, 0xa8824a);     // north
  add(0,0,51.6,44,H,52, 0xa8824a);  // south
  add(0,0,0,0.4,H,52, 0xa8824a);    // west
  add(43.6,0,0,44,H,52, 0xa8824a);  // east

  // T spawn (SW corner)
  // some crates in T spawn
  add(3,0.1,44,5,2,46, 0x8b5a2b);
  add(6,0.1,46,8,2,48, 0x8b5a2b);
  // T -> mid wall
  add(10,0,40,12,H,52, 0xb08060);
  // Mid (center region)
  add(20,0,24,22,H,28, 0xb08060);   // mid box/wall
  add(18,0,34,26,3.5,35, 0xb08060); // mid low wall (catwalk cut)
  // Mid doors (two gap, use thin walls as doorframe)
  add(18,0,22,18.4,H,24, 0xb08060);
  add(25.6,0,22,26,H,24, 0xb08060);
  add(18,0,22,26,H,22.4, 0xb08060);
  // door body (passable? keep it non-colliding decorative = don't add solid)
  // Catwalk (raised walkway north side from mid to A short)
  add(24,0,12,26,4,22, 0xc09060);
  add(24,4,12,26,4.2,22, 0xd0a070); // catwalk floor
  // Catwalk ramp up from mid
  add(24,0,22,26,4,24, 0xc09060); // simplified solid block; small collision is ok for a demo
  // B tunnels (NW) - tunnels carved as spaces, walls around
  add(0.4,0,10,10,H,12, 0x906040); // outer wall of B tunnels
  add(0.4,0,20,10,H,22, 0x906040);
  add(10,0,10,12,H,22, 0x906040); // east wall of tunnels
  add(0.4,0,10,12,4,22, 0); // placeholder removed
  // carve out tunnel interior by NOT putting walls where tunnel is.
  // B site (NW)
  add(4,0.1,4,8,2,8, 0x8b5a2b); // B site boxes
  add(2,0.1,14,4,3,16, 0x8b5a2b);
  // B car/barrel block
  add(6,0.1,16,9,2.5,18, 0x707a70);
  // A long (east long corridor from T spawn up to A site)
  add(32,0,40,34,H,52, 0xb08060); // long west wall
  add(40,0,40,43.6,H,52, 0xb08060); // long east wall
  // A doors at end of long
  add(36,0,32,38,H,34, 0xb08060);
  // A site (NE corner)
  add(34,0,4,44,H,14, 0xb08060); // A north wall
  add(34,0,4,34.4,H,22, 0xb08060); // A west wall
  // A site goose/platform
  add(36,0.1,6,40,1.5,10, 0x8b5a2b); // crates
  add(40,0.1,8,43,1,12, 0xa08050); // platform
  // CT spawn (SE area)
  add(30,0.1,46,33,2,50, 0x8b5a2b);
  add(38,0.1,48,41,3,51, 0x8b5a2b);
  // CT -> mid connector walls
  add(30,0,36,34,H,40, 0xb08060);
  return boxes;
}

// ---- Entity system ----
export interface Entity {
  id:number;
  side:Side;
  isPlayer:boolean;
  alive:boolean;
  pos:THREE.Vector3;
  vel:THREE.Vector3;
  yaw:number;
  pitch:number;
  hp:number;
  armor:number;
  onGround:boolean;
  weapons: {w:WeaponId; ammo:number; reserve:number}[];
  curWeapon:number; // index into weapons
  reloading:number; // time remaining
  fireCooldown:number;
  hasC4:boolean;
  c4Carrier:boolean;
  height:number;
  radius:number;
  eye:number;
  // AI
  ai?:{
    state:'patrol'|'attack'|'push'|'defend'|'retreat'|'plant'|'defuse';
    target?:Entity;
    path:THREE.Vector3[];
    pathIdx:number;
    nextFire:number;
    lastSeen:number;
    goal:THREE.Vector3;
    aim:THREE.Vector3;
  };
  // dead timer (respawn handled globally)
  deadTime:number;
  muzzleFlash:number;
}

export interface Projectile {
  from:THREE.Vector3;
  dir:THREE.Vector3;
  owner:number;
  weapon:WeaponId;
  ttl:number;
  damage:number;
}

export interface C4State {
  planted:boolean;
  pos:THREE.Vector3|null;
  timeLeft:number;
  carrier:number; // entity id
  defusing:number; // time remaining defusing
  defuser:number;
  site:'A'|'B'|null;
}

export interface GameState {
  entities: Entity[];
  projectiles: Projectile[];
  boxes: Box[];
  nextId:number;
  time:number;
  round:number;
  scoreCT:number;
  scoreT:number;
  roundTime:number;
  phase:'warmup'|'live'|'ended'|'planting'|'bombPlanted'|'defusing';
  winner:Side|null;
  c4:C4State;
  playerId:number;
  spectateId:number;
  kills:{killer:number,victim:number,weapon:WeaponId,headshot:boolean,time:number}[];
  audio:Audio;
  bombSiteA:{min:THREE.Vector3,max:THREE.Vector3};
  bombSiteB:{min:THREE.Vector3,max:THREE.Vector3};
}

export function createGame(): GameState {
  const boxes = buildMap();
  const st: GameState = {
    entities:[], projectiles:[], boxes, nextId:1, time:0,
    round:1, scoreCT:0, scoreT:0, roundTime:115, phase:'warmup', winner:null,
    c4:{planted:false,pos:null,timeLeft:0,carrier:0,defusing:0,defuser:0,site:null},
    playerId:0, spectateId:0, kills:[],
    audio: new Audio(),
    bombSiteA:{min:new THREE.Vector3(34,0,4),max:new THREE.Vector3(44,6,14)},
    bombSiteB:{min:new THREE.Vector3(2,0,2),max:new THREE.Vector3(12,6,18)},
  };
  return st;
}

export function spawnPlayer(st:GameState, side:Side, isPlayer:boolean): Entity {
  const e: Entity = {
    id: st.nextId++, side, isPlayer, alive:true,
    pos:new THREE.Vector3(), vel:new THREE.Vector3(),
    yaw:0, pitch:0, hp:100, armor:0, onGround:false,
    weapons:[], curWeapon:0, reloading:0, fireCooldown:0,
    hasC4:false, c4Carrier:false,
    height:1.8, radius:0.35, eye:1.6, deadTime:0, muzzleFlash:0,
  };
  if (side==='CT'){
    e.pos.set(38+Math.random()*4, 2, 48+Math.random()*3);
    e.weapons=[{w:'usp',ammo:WEAPONS.usp.magSize,reserve:WEAPONS.usp.reserve}];
    e.armor = 100;
  } else {
    e.pos.set(4+Math.random()*4, 2, 46+Math.random()*3);
    e.weapons=[{w:'glock',ammo:WEAPONS.glock.magSize,reserve:WEAPONS.glock.reserve}];
    e.armor = 0;
  }
  st.entities.push(e);
  return e;
}

export function equipPrimary(e:Entity, w:WeaponId){
  // remove any existing primary slot
  e.weapons = e.weapons.filter(x=>WEAPONS[x.w].slot!=='primary');
  e.weapons.push({w,ammo:WEAPONS[w].magSize,reserve:WEAPONS[w].reserve});
  e.curWeapon = e.weapons.length-1;
}

export function startRound(st:GameState, pistolRound=true){
  st.entities=[]; st.projectiles=[];
  st.roundTime = 115;
  st.phase='live';
  st.winner=null;
  st.c4={planted:false,pos:null,timeLeft:40,carrier:0,defusing:0,defuser:0,site:null};
  st.kills=[];
  // spawn 1 player (CT by default) + 4 CT + 5 T
  const p = spawnPlayer(st,'CT',true);
  st.playerId = p.id;
  st.spectateId = p.id;
  if (!pistolRound){
    equipPrimary(p,'m4a4');
    p.weapons.unshift({w:'usp',ammo:WEAPONS.usp.magSize,reserve:WEAPONS.usp.reserve});
    p.curWeapon=1;
    p.armor=100;
  }
  for (let i=0;i<4;i++){
    const e = spawnPlayer(st,'CT',false);
    if (!pistolRound){
      equipPrimary(e,'m4a4');
      e.armor=100;
    }
    e.ai = {state:'defend', path:[], pathIdx:0, nextFire:0, lastSeen:0, goal:new THREE.Vector3(20+Math.random()*15,0,20+Math.random()*10), aim:new THREE.Vector3()};
  }
  // T side
  let c4given=false;
  for (let i=0;i<5;i++){
    const e = spawnPlayer(st,'T',false);
    if (!pistolRound){
      equipPrimary(e,'ak47');
      if (Math.random()<0.2) { e.weapons = e.weapons.filter(x=>x.w!=='ak47'); equipPrimary(e,'awp'); }
      e.armor=100;
    }
    if (!c4given){
      e.hasC4=true; e.c4Carrier=true; c4given=true;
      st.c4.carrier = e.id;
    }
    e.ai = {state:'patrol', path:[], pathIdx:0, nextFire:0, lastSeen:0, goal:new THREE.Vector3(36,0,8), aim:new THREE.Vector3()};
  }
}

// ---- Collision ----
function aabbIntersect(a:{min:THREE.Vector3,max:THREE.Vector3}, b:{min:THREE.Vector3,max:THREE.Vector3}){
  return a.min.x<b.max.x && a.max.x>b.min.x && a.min.y<b.max.y && a.max.y>b.min.y && a.min.z<b.max.z && a.max.z>b.min.z;
}
function entityAABB(e:Entity, dx=0, dy=0, dz=0){
  const p = e.pos;
  return {min:new THREE.Vector3(p.x-e.radius+dx,p.y+dy,p.z-e.radius+dz),max:new THREE.Vector3(p.x+e.radius+dx,p.y+e.height+dy,p.z+e.radius+dz)};
}

export function moveEntity(st:GameState, e:Entity, want:THREE.Vector3, dt:number){
  // axis separated sweep
  e.onGround=false;
  // gravity
  e.vel.y -= 22*dt;
  if (e.vel.y<-30) e.vel.y=-30;
  const tryMove=(ax:'x'|'y'|'z',delta:number)=>{
    if (delta===0) return;
    const me = entityAABB(e);
    if (ax==='x'){me.min.x+=delta;me.max.x+=delta;}
    else if (ax==='y'){me.min.y+=delta;me.max.y+=delta;}
    else {me.min.z+=delta;me.max.z+=delta;}
    for (const b of st.boxes){
      if (aabbIntersect(me,b)){
        if (ax==='y'){ if(delta<0) e.onGround=true; e.vel.y=0; }
        return;
      }
    }
    e.pos[ax]+=delta;
  };
  tryMove('x',(want.x+e.vel.x)*dt);
  tryMove('z',(want.z+e.vel.z)*dt);
  tryMove('y',e.vel.y*dt);
  if (e.pos.y<0){ e.pos.y=0; e.vel.y=0; e.onGround=true; }
}

// ---- Line of sight (ray vs boxes) ----
function rayBoxHit(origin:THREE.Vector3, dir:THREE.Vector3, maxDist:number, b:Box): number|null{
  let tmin = -Infinity, tmax = Infinity;
  for(const ax of ['x','y','z'] as const){
    const o=origin[ax], d=dir[ax];
    if (Math.abs(d)<1e-8){
      if (o<b.min[ax] || o>b.max[ax]) return null;
    } else {
      let t1=(b.min[ax]-o)/d, t2=(b.max[ax]-o)/d;
      if (t1>t2) [t1,t2]=[t2,t1];
      tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2);
      if (tmin>tmax) return null;
    }
  }
  if (tmax<0) return null;
  const t = tmin<0?tmax:tmin;
  if (t>maxDist) return null;
  return t;
}
export function losClear(st:GameState, from:THREE.Vector3, to:THREE.Vector3, ignoreId?:number):boolean{
  const dir = new THREE.Vector3().subVectors(to,from);
  const d = dir.length();
  dir.multiplyScalar(1/d);
  for(const b of st.boxes){
    const t = rayBoxHit(from,dir,d,b);
    if (t!==null && t>0.05) return false;
  }
  for(const e of st.entities){
    if (!e.alive) continue;
    if (e.id===ignoreId) continue;
    // check against entity bbox
    const bb = {min:new THREE.Vector3(e.pos.x-e.radius,e.pos.y,e.pos.z-e.radius),max:new THREE.Vector3(e.pos.x+e.radius,e.pos.y+e.height,e.pos.z+e.radius)};
    const t = rayBoxHit(from,dir,d,bb);
    if (t!==null && t>0.05 && t<d-0.05) return false;
  }
  return true;
}

function pickTarget(st:GameState, from:Entity, dir:THREE.Vector3): {entity:Entity, zone:HitZone, dist:number}|null{
  let best: {entity:Entity, zone:HitZone, dist:number}|null=null;
  const maxD = 200;
  for (const e of st.entities){
    if (!e.alive||e.id===from.id||e.side===from.side) continue;
    // simple bbox sphere test
    const to = new THREE.Vector3(e.pos.x,e.pos.y+e.height*0.5,e.pos.z);
    const diff = new THREE.Vector3().subVectors(to,from.pos);
    const t = diff.dot(dir);
    if (t<0||t>maxD) continue;
    const closest = from.pos.clone().addScaledVector(dir,t);
    const r = e.radius+0.2;
    if (closest.distanceTo(to)<r){
      // check los walls
      let blocked=false;
      const dir2 = dir.clone();
      for(const b of st.boxes){
        const tt = rayBoxHit(from.pos.clone().setY(from.pos.y+from.eye),dir2,t,b);
        if (tt!==null && tt>0.2 && tt<t-0.2){blocked=true;break;}
      }
      if (blocked) continue;
      // determine zone by height
      const hAt = closest.y - e.pos.y;
      let zone:HitZone='chest';
      if (hAt>e.height*0.85) zone='head';
      else if (hAt>e.height*0.55) zone='chest';
      else if (hAt>e.height*0.3) zone='stomach';
      else if (hAt>e.height*0.15) zone='leg';
      else zone='leg';
      if (!best || t<best.dist) best={entity:e,zone,dist:t};
    }
  }
  return best;
}

export function fireWeapon(st:GameState, e:Entity){
  if (!e.alive) return;
  if (e.fireCooldown>0||e.reloading>0) return;
  const w = e.weapons[e.curWeapon];
  const def = WEAPONS[w.w];
  if (w.ammo<=0){
    if (w.w!=='knife' && w.reserve>0) reload(e, st);
    return;
  }
  e.fireCooldown = def.fireRate;
  if (w.w!=='knife') w.ammo--;
  st.audio.shot(w.w);
  e.muzzleFlash = 0.06;
  // muzzle pos
  const eye = new THREE.Vector3(e.pos.x,e.pos.y+e.eye,e.pos.z);
  const fwd = new THREE.Vector3(-Math.sin(e.yaw)*Math.cos(e.pitch), Math.sin(e.pitch), -Math.cos(e.yaw)*Math.cos(e.pitch));
  // recoil spread
  const spread = def.spread + (e.isPlayer?0:0.02);
  const dir = fwd.clone();
  dir.x += (Math.random()-0.5)*spread;
  dir.y += (Math.random()-0.5)*spread;
  dir.z += (Math.random()-0.5)*spread;
  dir.normalize();
  // melee/knife
  if (w.w==='knife'){
    // small forward swing
    const hit = pickTarget(st,e,fwd);
    if (hit && hit.dist<def.range){
      const mul = hit.zone==='head'?def.headMul:(hit.zone==='leg'?def.legMul:def.bodyMul);
      applyDamage(st,e,hit.entity,def.damage*mul,hit.zone,'knife');
    }
    return;
  }
  // ranged trace
  const hit = pickTarget(st,e,dir);
  let dist = def.range;
  if (hit) dist = hit.dist;
  else {
    for(const b of st.boxes){
      const t = rayBoxHit(eye,dir,def.range,b);
      if (t!==null && t>0.2 && t<dist) dist=t;
    }
  }
  // visual tracer
  st.projectiles.push({from:eye.clone(),dir:dir.clone(),owner:e.id,weapon:w.w,ttl:0.08,damage:0});
  if (hit){
    let dmg = def.damage;
    if (hit.zone==='head') dmg*=def.headMul;
    else if (hit.zone==='leg') dmg*=def.legMul;
    else if (hit.zone==='arm') dmg*=def.armMul;
    applyDamage(st,e,hit.entity,dmg,hit.zone,w.w);
    st.audio.hit();
  }
}

export function applyDamage(st:GameState, attacker:Entity, victim:Entity, dmg:number, zone:HitZone, w:WeaponId){
  // armor reduction
  let actualDmg = dmg;
  if (victim.armor>0){
    const armorDmg = dmg*0.5;
    victim.armor = Math.max(0,victim.armor-armorDmg);
    actualDmg = dmg*0.55;
  }
  victim.hp -= actualDmg;
  if (victim.hp<=0){
    victim.hp=0; victim.alive=false; victim.deadTime=0;
    st.kills.push({killer:attacker.id,victim:victim.id,weapon:w,headshot:zone==='head',time:st.time});
    st.audio.kill();
    if (victim.c4Carrier){
      victim.c4Carrier=false;
      // drop C4 at victim position
      st.c4.planted=false;
      st.c4.pos = victim.pos.clone();
      st.c4.carrier = 0;
      // give to nearest T alive
      let nearest:Entity|null=null, nd=1e9;
      for(const e of st.entities){
        if (e.alive && e.side==='T'){
          const d=e.pos.distanceTo(victim.pos);
          if(d<nd){nd=d;nearest=e;}
        }
      }
      if (nearest){ nearest.hasC4=true; nearest.c4Carrier=true; st.c4.carrier=nearest.id; st.c4.pos=null; }
    }
    // check round end
    checkRoundEnd(st);
  }
}

export function reload(e:Entity, st:GameState){
  const w = e.weapons[e.curWeapon];
  const def = WEAPONS[w.w];
  if (w.w==='knife') return;
  if (w.ammo===def.magSize||w.reserve<=0) return;
  e.reloading = def.reloadTime;
  st.audio.reload();
}

export function switchWeapon(e:Entity, idx:number){
  if (idx<0||idx>=e.weapons.length||e.reloading>0) return;
  e.curWeapon=idx;
}

function insideSite(pos:THREE.Vector3, site:{min:THREE.Vector3,max:THREE.Vector3}){
  return pos.x>=site.min.x&&pos.x<=site.max.x&&pos.z>=site.min.z&&pos.z<=site.max.z;
}

export function tryPlant(st:GameState, e:Entity){
  if (e.side!=='T'||!e.hasC4||st.c4.planted) return false;
  if (!insideSite(e.pos,st.bombSiteA) && !insideSite(e.pos,st.bombSiteB)) return false;
  // plant takes 3 seconds; simplified: plant instantly
  st.c4.planted=true;
  st.c4.pos = e.pos.clone();
  st.c4.timeLeft = 40;
  st.c4.site = insideSite(e.pos,st.bombSiteA)?'A':'B';
  e.hasC4=false; e.c4Carrier=false;
  st.c4.carrier=0;
  st.phase='bombPlanted';
  st.audio.beep();
  return true;
}
export function tryDefuse(st:GameState, e:Entity){
  if(e.side!=='CT'||!st.c4.planted) return false;
  if (!st.c4.pos || e.pos.distanceTo(st.c4.pos)>2) return false;
  st.c4.defusing += 1/60;
  st.c4.defuser = e.id;
  if (st.c4.defusing>=5){
    // defused
    st.winner='CT';
    st.phase='ended';
    st.scoreCT++;
    st.audio.beep();
    return true;
  }
  return false;
}

export function checkRoundEnd(st:GameState){
  if (st.winner) return;
  const aliveT = st.entities.filter(e=>e.alive&&e.side==='T').length;
  const aliveCT = st.entities.filter(e=>e.alive&&e.side==='CT').length;
  if (aliveT===0){
    st.winner='CT'; st.phase='ended'; st.scoreCT++; return;
  }
  if (aliveCT===0 && !st.c4.planted){
    st.winner='T'; st.phase='ended'; st.scoreT++; return;
  }
  // bomb exploded handled in update
}

// ---- AI ----
function pickAIGoal(st:GameState, e:Entity): THREE.Vector3 {
  const pos = e.pos;
  if (e.side==='T'){
    if (e.c4Carrier){
      // go to B site or A site
      const toA = pos.distanceTo(new THREE.Vector3(40,0,8));
      const toB = pos.distanceTo(new THREE.Vector3(6,0,6));
      if (toA<toB) return new THREE.Vector3(40,0,8);
      return new THREE.Vector3(6,0,6);
    }
    if (st.c4.planted){
      return st.c4.pos?.clone()||new THREE.Vector3(20,0,26);
    }
    // follow carrier
    const carrier = st.entities.find(x=>x.id===st.c4.carrier);
    if (carrier) return carrier.pos.clone();
    return new THREE.Vector3(30,0,20);
  } else {
    // CT: hold sites; if bomb planted go to it
    if (st.c4.planted && st.c4.pos) return st.c4.pos.clone();
    if (pos.x>30) return new THREE.Vector3(40,0,10); // A site holder
    if (pos.x<15) return new THREE.Vector3(6,0,8);   // B site holder
    return new THREE.Vector3(22,0,26); // mid
  }
}

function moveTowards(st:GameState, e:Entity, target:THREE.Vector3, dt:number, speed=4){
  const dir = new THREE.Vector3().subVectors(target,e.pos);
  dir.y=0;
  const d = dir.length();
  if (d<0.4) return;
  dir.multiplyScalar(1/d);
  e.yaw = Math.atan2(-dir.x,-dir.z);
  const mv = dir.multiplyScalar(speed);
  moveEntity(st,e,mv,dt);
}

function aiFire(st:GameState, e:Entity, target:Entity){
  if (e.fireCooldown>0||e.reloading>0) return;
  const def = WEAPONS[e.weapons[e.curWeapon].w];
  // aim at target
  const tgt = new THREE.Vector3(target.pos.x, target.pos.y+target.eye*0.9, target.pos.z);
  const eye = new THREE.Vector3(e.pos.x,e.pos.y+e.eye,e.pos.z);
  const dir = new THREE.Vector3().subVectors(tgt,eye);
  const dist = dir.length();
  dir.normalize();
  e.pitch = Math.asin(Math.max(-1,Math.min(1,dir.y)));
  e.yaw = Math.atan2(-dir.x,-dir.z);
  // accuracy scales with distance
  if (Math.random()<Math.max(0.3, 0.9 - dist*0.01)){
    // actually fire
    const saveFwd = new THREE.Vector3(-Math.sin(e.yaw)*Math.cos(e.pitch), Math.sin(e.pitch), -Math.cos(e.yaw)*Math.cos(e.pitch));
    const jitter = def.spread*(0.5+Math.random());
    saveFwd.x+=(Math.random()-0.5)*jitter;
    saveFwd.y+=(Math.random()-0.5)*jitter;
    saveFwd.normalize();
    // temporarily override yaw/pitch via direction
    const hit = pickTarget(st,e,saveFwd);
    if (hit && hit.entity.id===target.id){
      // apply damage
      let dmg = def.damage;
      if (hit.zone==='head') dmg*=def.headMul*0.7; // nerf AI headshot rate slightly
      else if (hit.zone==='leg') dmg*=def.legMul;
      applyDamage(st,e,target,dmg,hit.zone,def.id);
      st.audio.shot(def.id);
      e.muzzleFlash=0.05;
      e.fireCooldown = def.fireRate*1.2;
      // ammo
      const w = e.weapons[e.curWeapon];
      if (w.w!=='knife') w.ammo--;
      if (w.ammo<=0 && w.reserve>0) reload(e,st);
    } else {
      st.audio.shot(def.id);
      e.fireCooldown = def.fireRate*1.5;
      e.muzzleFlash=0.05;
      const w = e.weapons[e.curWeapon];
      if (w.w!=='knife') w.ammo--;
    }
  } else {
    e.fireCooldown = def.fireRate*0.8;
  }
}

export function updateAI(st:GameState, e:Entity, dt:number){
  if (!e.ai||!e.alive) return;
  // find enemies in LOS
  let best:Entity|null=null, bd=1e9;
  for (const o of st.entities){
    if (!o.alive||o.side===e.side||o.id===e.id) continue;
    const d = e.pos.distanceTo(o.pos);
    if (d<50 && losClear(st, new THREE.Vector3(e.pos.x,e.pos.y+e.eye,e.pos.z), new THREE.Vector3(o.pos.x,o.pos.y+o.eye,o.pos.z), e.id)){
      if (d<bd){bd=d;best=o;}
    }
  }
  if (best){
    e.ai.target=best;
    e.ai.lastSeen=st.time;
    e.ai.state='attack';
    aiFire(st,e,best);
    // strafe
    const to = new THREE.Vector3().subVectors(best.pos,e.pos); to.y=0; to.normalize();
    const right = new THREE.Vector3(to.z,0,-to.x);
    const strafe = Math.sin(st.time*2+e.id)*1.5;
    const mv = to.clone().multiplyScalar(bd>15?3:0).add(right.multiplyScalar(strafe));
    moveEntity(st,e,mv,dt);
    if (e.hasC4 && insideSite(e.pos, st.bombSiteA)||insideSite(e.pos,st.bombSiteB)){
      // try plant
      tryPlant(st,e);
    }
  } else {
    // patrol to goal
    e.ai.target=undefined;
    if (st.c4.planted && e.side==='CT'){
      e.ai.goal = st.c4.pos?.clone()||e.ai.goal;
    } else {
      e.ai.goal = pickAIGoal(st,e);
    }
    moveTowards(st,e,e.ai.goal,dt,3.5);
    // plant if carrier & on site
    if (e.c4Carrier && (insideSite(e.pos,st.bombSiteA)||insideSite(e.pos,st.bombSiteB))){
      if (!e.ai._plantT) e.ai._plantT=0;
      e.ai._plantT += dt;
      if (e.ai._plantT>3) { tryPlant(st,e); e.ai._plantT=0; }
    } else {
      e.ai._plantT=0;
    }
    // defuse if CT and near bomb
    if (e.side==='CT' && st.c4.planted && st.c4.pos && e.pos.distanceTo(st.c4.pos)<2){
      tryDefuse(st,e);
    }
  }
}

export function updateGame(st:GameState, dt:number){
  if (st.phase==='ended') return;
  st.time += dt;
  st.roundTime -= dt;
  if (st.c4.planted){
    st.c4.timeLeft -= dt;
    if (st.c4.defusing>0){
      // if defuser not close reset
      const def = st.entities.find(x=>x.id===st.c4.defuser);
      if (!def||!def.alive||!st.c4.pos||def.pos.distanceTo(st.c4.pos)>2) st.c4.defusing=0;
    }
    if (Math.floor(st.c4.timeLeft*2)%2===0 && Math.floor((st.c4.timeLeft-dt)*2)!==Math.floor(st.c4.timeLeft*2)){
      st.audio.bomb();
    }
    if (st.c4.timeLeft<=0){
      // explode
      st.phase='ended'; st.winner='T'; st.scoreT++;
      st.audio.explode();
    }
  }
  for (const e of st.entities){
    if (!e.alive){
      e.deadTime+=dt;
      continue;
    }
    if (e.fireCooldown>0) e.fireCooldown-=dt;
    if (e.reloading>0){
      e.reloading-=dt;
      if (e.reloading<=0){
        const w=e.weapons[e.curWeapon]; const def=WEAPONS[w.w];
        const need = def.magSize-w.ammo;
        const take = Math.min(need, w.reserve);
        w.ammo+=take; w.reserve-=take;
      }
    }
    if (e.muzzleFlash>0) e.muzzleFlash-=dt;
    if (!e.isPlayer){
      updateAI(st,e,dt);
    }
    // footstep sound for player when moving
    if (e.isPlayer && (Math.abs(e.vel.x)+Math.abs(e.vel.z))>0.1 && e.onGround){
      if (!(e as any)._stepT) (e as any)._stepT=0;
      (e as any)._stepT-=dt;
      if ((e as any)._stepT<=0){ st.audio.footstep(); (e as any)._stepT=0.35; }
    }
  }
  // update projectiles (tracer ttl)
  st.projectiles = st.projectiles.filter(p=>(p.ttl-=dt)>0);
  // round time -> T win if they've planted handled above; if time runs out CT win
  if (st.roundTime<=0 && !st.c4.planted){
    st.phase='ended'; st.winner='CT'; st.scoreCT++;
  }
  // if all spectator/player dead, cycle to a teammate
  const player = st.entities.find(e=>e.id===st.playerId);
  if (player && !player.alive){
    // switch to first alive teammate
    const mate = st.entities.find(e=>e.alive && e.side===player.side);
    if (mate) st.spectateId = mate.id;
  }
}
