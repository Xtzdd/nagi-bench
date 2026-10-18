import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ============================================================
// 字幕/配音 cue 清单 —— 按题目要求集中保存在结构化清单中
// 每条含 id/kind/speaker/text/delivery/start/end 七个字段
// ============================================================
type Subtitle = {
  id: string;
  kind: 'narrator' | 'inner' | 'dialog' | 'radio' | 'sfx-cue';
  speaker: string;
  text: string;
  delivery: string;
  start: number;
  end: number;
};

const SUBS: Subtitle[] = [
  // Act 1: 引子 — 老太空与陨石
  {id:'s1', kind:'narrator', speaker:'旁白', text:'危机纪元 3 年，末日战役前夜。', delivery:'低沉、克制', start:2,  end:7},
  {id:'s2', kind:'narrator', speaker:'旁白', text:'章北海从"陨石收藏者"手中购得三块铁陨石。', delivery:'陈述', start:8,  end:14},
  {id:'s3', kind:'inner', speaker:'章北海（内心）', text:'要让这几个人，像陨石一样消失。', delivery:'冷而轻', start:18, end:24},

  // Act 2: 地下室加工
  {id:'s4', kind:'narrator', speaker:'旁白', text:'他在自家地下室用车床，将陨石切割成子弹形状。', delivery:'陈述', start:28, end:35},
  {id:'s5', kind:'sfx-cue', speaker:'环境', text:'（车床尖啸·金属碎屑飞溅·冷却液流淌）', delivery:'机械感', start:30, end:44},

  // Act 3: 太空出舱
  {id:'s6', kind:'narrator', speaker:'旁白', text:'距离"自然选择"号出航还有 36 小时。', delivery:'冷静推进', start:52, end:57},
  {id:'s7', kind:'inner', speaker:'章北海', text:'他们中的三个人，将阻碍末日战役的胜利。', delivery:'平静', start:60, end:66},
  {id:'s8', kind:'radio', speaker:'航天中心', text:'"北海号"舱外活动许可，已开通。', delivery:'无线电，略带失真', start:70, end:74},
  {id:'s9', kind:'narrator', speaker:'旁白', text:'他漂出减压舱，身后是蓝色的地球。', delivery:'诗意留白', start:78, end:85},

  // Act 4: 瞄准
  {id:'s10',kind:'dialog', speaker:'目标 A', text:'……老航天，就是老顽固。', delivery:'随意闲聊（无线电）', start:96, end:101},
  {id:'s11',kind:'dialog', speaker:'目标 B', text:'呵，推进方向不定下来，仗没法打。', delivery:'附和', start:102, end:107},
  {id:'s12',kind:'narrator', speaker:'旁白', text:'他将陨石子弹压入特制枪膛，瞄准了三公里外的同行者。', delivery:'紧绷', start:110, end:118},
  {id:'s13',kind:'inner', speaker:'章北海', text:'没关系，都一样的。', delivery:'极轻，几不可闻', start:122, end:126},

  // Act 5: 枪响 — 真空不传导
  {id:'s14',kind:'sfx-cue', speaker:'音效', text:'（第一发——仅航天服内闷震）', delivery:'主观化的低频脉冲', start:128, end:132},
  {id:'s15',kind:'sfx-cue', speaker:'音效', text:'（第二发·第三发）', delivery:'连续闷震', start:133, end:139},
  {id:'s16',kind:'narrator', speaker:'旁白', text:'太空中没有声音。只有他的呼吸和心跳。', delivery:'克制·留白', start:142, end:148},
  {id:'s17',kind:'radio', speaker:'航天中心', text:'——目标信号丢失！', delivery:'无线电惊呼', start:152, end:156},
  {id:'s18',kind:'radio', speaker:'航天中心', text:'"北海号"，请报告！请报告！', delivery:'紧张呼叫', start:157, end:161},

  // Act 6: 收束
  {id:'s19',kind:'narrator', speaker:'旁白', text:'三具航天服，像被陨石击中的残骸，静静漂向黑暗深处。', delivery:'低沉·带叹息', start:166, end:175},
  {id:'s20',kind:'inner', speaker:'章北海', text:'自然选择号，前进四。', delivery:'坚定，不带感情', start:182, end:188},
  {id:'s21',kind:'narrator', speaker:'旁白', text:'他收枪，反身向舱门漂去。', delivery:'淡去', start:190, end:195},
];
const TOTAL_DUR = 200; // seconds, < 360s limit

// ============================================================
// 程序化音效 (Web Audio) —— 真空下无外部声响，
// 只有航天服内部呼吸/心跳/闷震/无线电/金属加工声
// ============================================================
class AudioEngine {
  ctx: AudioContext|null = null;
  master: GainNode|null = null;
  started = false;
  start(){
    if (this.started) return;
    this.started=true;
    const AC = (window.AudioContext||(window as any).webkitAudioContext);
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
  }
  private env(g:GainNode,t0:number,a:number,d:number,peak=1){
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(peak,t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
  }
  tone(freq:number,t0:number,dur:number,vol=0.2,type:OscillatorType='sine',lp?:number){
    if(!this.ctx||!this.master) return;
    const ctx=this.ctx;
    const o=ctx.createOscillator(); o.type=type; o.frequency.value=freq;
    const g=ctx.createGain();
    o.connect(g);
    if (lp){
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=lp;
      g.connect(f); f.connect(this.master);
    } else {
      g.connect(this.master);
    }
    this.env(g,t0,0.01,dur,vol);
    o.start(t0); o.stop(t0+dur+0.05);
  }
  // 车床：高频正弦+噪声
  lathe(startT:number, dur:number){
    if(!this.ctx||!this.master) return;
    const ctx=this.ctx;
    const t=ctx.currentTime+startT;
    // high whine
    const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(1400,t);
    o.frequency.linearRampToValueAtTime(2200,t+dur*0.3);
    o.frequency.linearRampToValueAtTime(1600,t+dur);
    const g=ctx.createGain();
    const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; f.Q.value=2;
    o.connect(f); f.connect(g); g.connect(this.master);
    this.env(g,t,0.5,dur,0.15);
    o.start(t); o.stop(t+dur);
    // noise
    const n=ctx.createBufferSource();
    const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length)*0.5;
    n.buffer=buf;
    const ng=ctx.createGain(); ng.gain.value=0.2;
    const nf=ctx.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=2000;
    n.connect(nf); nf.connect(ng); ng.connect(this.master);
    n.start(t);
  }
  // 呼吸（持续的低频风）
  breath(startT:number, dur:number, vol=0.12){
    if(!this.ctx||!this.master) return;
    const ctx=this.ctx; const t0=ctx.currentTime+startT;
    for(let i=0;i<dur/2.5;i++){
      const t=t0+i*2.5;
      const n=ctx.createBufferSource();
      const b=ctx.createBuffer(1,ctx.sampleRate*1.5,ctx.sampleRate);
      const d=b.getChannelData(0);
      for(let j=0;j<d.length;j++) d[j]=(Math.random()*2-1)*Math.sin(j/d.length*Math.PI);
      n.buffer=b;
      const g=ctx.createGain(); const f=ctx.createBiquadFilter(); f.type='lowpass';f.frequency.value=400;
      n.connect(f);f.connect(g);g.connect(this.master);
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(vol,t+0.8);
      g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);
      n.start(t); n.stop(t+1.5);
    }
  }
  // 心跳
  heartbeat(startT:number, count:number){
    if(!this.ctx) return;
    for(let i=0;i<count;i++){
      const t=this.ctx.currentTime+startT+i*0.9;
      this.tone(60,t,0.15,0.4,'sine',80);
      this.tone(50,t+0.25,0.2,0.3,'sine',80);
    }
  }
  // 枪响（闷震）—— 主观传导
  shot(startT:number){
    if(!this.ctx||!this.master) return;
    const ctx=this.ctx; const t=ctx.currentTime+startT;
    const n=ctx.createBufferSource();
    const b=ctx.createBuffer(1,ctx.sampleRate*1.2,ctx.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    n.buffer=b;
    const g=ctx.createGain(); const f=ctx.createBiquadFilter(); f.type='lowpass';f.frequency.value=120;
    n.connect(f);f.connect(g);g.connect(this.master);
    g.gain.setValueAtTime(0.8,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
    n.start(t);
  }
  // 无线电噪声底
  radio(startT:number, dur:number){
    if(!this.ctx||!this.master) return;
    const ctx=this.ctx; const t=ctx.currentTime+startT;
    const n=ctx.createBufferSource();
    const b=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.05;
    n.buffer=b;
    const g=ctx.createGain(); const f=ctx.createBiquadFilter(); f.type='bandpass';f.frequency.value=1200;f.Q.value=2;
    n.connect(f);f.connect(g);g.connect(this.master);
    g.gain.value=0.2;
    n.start(t); n.stop(t+dur);
  }
  // 警报
  alarm(startT:number, dur:number){
    if(!this.ctx) return;
    for(let i=0;i<dur*2;i++){
      this.tone(800,startT+i*0.5,0.2,0.25,'square');
    }
  }
  // 推进器点火
  thruster(startT:number, dur:number){
    if(!this.ctx||!this.master) return;
    const ctx=this.ctx; const t=ctx.currentTime+startT;
    const n=ctx.createBufferSource();
    const b=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.min(1,(dur-i/d.length*dur)/2);
    n.buffer=b;
    const g=ctx.createGain(); const f=ctx.createBiquadFilter(); f.type='lowpass';f.frequency.value=300;
    n.connect(f);f.connect(g);g.connect(this.master);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.5,t+0.3);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    n.start(t);
  }
}

// ============================================================
// 体素工具：快速构造方块人/场景（mesh-less，用 InstancedMesh）
// ============================================================
type VoxPalette = Record<string, number>;
function makeMat(color:number, opts:Partial<THREE.MeshStandardMaterialParameters>={}){
  return new THREE.MeshStandardMaterial({color, roughness:0.85, metalness:0.1, ...opts});
}

// Palette
const PAL = {
  spacesuit: makeMat(0xf0f0f0, {roughness:0.5}),
  spacesuitDark: makeMat(0x606870, {roughness:0.7}),
  visor: new THREE.MeshPhysicalMaterial({color:0x203040, roughness:0.1, metalness:0.6, emissive:0x0a1525, emissiveIntensity:0.3}),
  visorGold: new THREE.MeshPhysicalMaterial({color:0xd4a848, roughness:0.2, metalness:1.0, emissive:0x2a1a00, emissiveIntensity:0.1}),
  skin: makeMat(0xd8b088),
  hair: makeMat(0x1a1208),
  metal: makeMat(0x808890, {roughness:0.4, metalness:0.9}),
  dark: makeMat(0x20242a),
  steel: makeMat(0xa0a8b0, {roughness:0.3, metalness:1}),
  rock: makeMat(0x5a4a3a, {roughness:1}),
  rockDark: makeMat(0x3a2a22, {roughness:1}),
  iron: makeMat(0x706860, {roughness:0.5, metalness:0.8}),
  concrete: makeMat(0x807868, {roughness:0.95}),
  floor: makeMat(0x302820, {roughness:1}),
  wood: makeMat(0x5a3820, {roughness:0.9}),
  glass: new THREE.MeshPhysicalMaterial({color:0x8098b0, roughness:0.05, metalness:0, transmission:0.4, transparent:true, opacity:0.4}),
  earthBlue: new THREE.MeshStandardMaterial({color:0x2a4a80, roughness:0.8}),
  earthGreen: makeMat(0x2a5a30),
  earthWhite: makeMat(0xffffff),
  glow: new THREE.MeshBasicMaterial({color:0xff6020}),
  glowBlue: new THREE.MeshBasicMaterial({color:0x4080ff}),
  bloodFloat: makeMat(0x600000),
};

function voxel(x:number,y:number,z:number,sx:number,sy:number,sz:number,mat:THREE.Material, parent:THREE.Group, pos?:THREE.Vector3){
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat);
  m.position.set(x,y,z);
  if (pos) m.position.add(pos);
  m.castShadow = true; m.receiveShadow=true;
  parent.add(m);
  return m;
}

// 构建一个方块宇航员
function buildAstronaut(goldVisor=false, rifle=false): THREE.Group {
  const g = new THREE.Group();
  const suit = PAL.spacesuit;
  const suitD = PAL.spacesuitDark;
  const visor = goldVisor?PAL.visorGold:PAL.visor;
  // backpack
  voxel(0,1.2,-0.22,0.55,0.7,0.18, suitD, g);
  voxel(0,1.3,-0.28,0.2,0.18,0.08, PAL.metal, g);
  // torso
  voxel(0,1.1,0,0.55,0.7,0.35, suit, g);
  // chest panel
  voxel(0,1.15,0.18,0.25,0.35,0.02, PAL.metal, g);
  // legs
  voxel(-0.15,0.35,0,0.22,0.7,0.24, suit, g);
  voxel(0.15,0.35,0,0.22,0.7,0.24, suit, g);
  voxel(-0.15,0.02,0,0.24,0.1,0.26, suitD, g); // boot
  voxel(0.15,0.02,0,0.24,0.1,0.26, suitD, g);
  // arms
  voxel(-0.38,1.1,0,0.18,0.65,0.2, suit, g);
  voxel(0.38,1.1,0,0.18,0.65,0.2, suit, g);
  voxel(-0.38,0.65,0,0.2,0.1,0.22, suitD, g); // glove
  voxel(0.38,0.65,0,0.2,0.1,0.22, suitD, g);
  // helmet
  voxel(0,1.72,0,0.42,0.4,0.42, suit, g);
  // visor
  voxel(0,1.72,0.18,0.32,0.26,0.08, visor, g);
  // helmet light
  voxel(0,1.9,0.21,0.08,0.08,0.05, PAL.glow, g);
  // umbilical
  voxel(-0.25,1.4,-0.22,0.04,0.3,0.04, suitD, g);
  // Rifle — 特制陨石枪
  if (rifle){
    const rg = new THREE.Group();
    voxel(0,0,0,0.08,0.12,0.6, PAL.dark, rg);
    voxel(0,-0.08,-0.05,0.08,0.1,0.15, PAL.dark, rg);
    voxel(0,0.04,-0.25,0.04,0.04,0.2, PAL.steel, rg); // barrel
    voxel(0,-0.02,0.2,0.06,0.06,0.1, PAL.metal, rg); // stock/cylinder
    rg.position.set(0.38,0.85,-0.05);
    rg.rotation.set(0,0,-0.1);
    g.add(rg);
    (g as any)._rifle = rg;
  }
  // muzzle
  if (rifle){
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshBasicMaterial({color:0xffc060, transparent:true, opacity:0}));
    flash.position.set(0.38,0.89,-0.3);
    g.add(flash);
    (g as any)._flash = flash;
  }
  return g;
}

// 构建地下室工作坊
function buildBasement(scene:THREE.Scene){
  const g = new THREE.Group();
  // floor
  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(8,8), PAL.floor);
  floorM.rotation.x=-Math.PI/2; g.add(floorM);
  // walls (3 sides visible)
  voxel(-4,1.5,0,0.1,3,8, PAL.concrete, g); // left
  voxel(4,1.5,0,0.1,3,8, PAL.concrete, g);  // right
  voxel(0,1.5,-4,8,3,0.1, PAL.concrete, g); // back
  // ceiling - skip (camera view from slightly low)
  // workbench
  voxel(0,0.8,0.5,1.8,0.1,0.8, PAL.wood, g);
  voxel(-0.7,0.4,0.7,0.1,0.8,0.1, PAL.metal, g);
  voxel(0.7,0.4,0.7,0.1,0.8,0.1, PAL.metal, g);
  // lathe
  voxel(-0.3,1.05,0.4,0.5,0.3,0.5, PAL.metal, g);
  voxel(0.3,1.0,0.35,0.12,0.12,0.6, PAL.steel, g); // spindle/bar
  voxel(0.3,1.0,0.35,0.05,0.05,0.6, PAL.dark, g);
  // chuck
  voxel(-0.1,1.05,0.35,0.18,0.18,0.12, PAL.dark, g);
  // meteorite rock on bench
  voxel(-0.6,0.95,0.55,0.25,0.2,0.2, PAL.rock, g);
  voxel(-0.55,1.1,0.6,0.08,0.06,0.08, PAL.rockDark, g);
  // finished bullet in small holder
  voxel(0.5,0.95,0.4,0.05,0.05,0.2, PAL.iron, g);
  voxel(0.5,0.95,0.55,0.04,0.04,0.08, PAL.rock, g);
  // lamp over bench
  const lampLight = new THREE.SpotLight(0xfff0c0,1.5,6,Math.PI/4,0.5,1);
  lampLight.position.set(0,2.8,0.5); lampLight.target.position.set(0,0.9,0.5);
  lampLight.castShadow=true;
  g.add(lampLight); g.add(lampLight.target);
  voxel(0,2.8,0.5,0.2,0.1,0.2, PAL.dark, g);
  // some metal shavings (flat boxes on floor)
  for(let i=0;i<20;i++){
    voxel((Math.random()-0.5)*2,0.01,0.3+Math.random()*0.8,0.04+Math.random()*0.04,0.005,0.04+Math.random()*0.04, PAL.steel, g);
  }
  // bucket with coolant
  voxel(1.2,0.3,0.2,0.2,0.4,0.2, PAL.metal, g);
  const cool = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.25,16), new THREE.MeshPhysicalMaterial({color:0x4080c0, roughness:0.2, transmission:0.3, transparent:true, opacity:0.7}));
  cool.position.set(1.2,0.2,0.2); g.add(cool);
  scene.add(g);
  return g;
}

// 构建太空场景：地球远景+星空+三位漂浮宇航员
function buildSpace(scene:THREE.Scene){
  const g = new THREE.Group(); g.visible=false; scene.add(g);
  // starfield
  const stars = new THREE.BufferGeometry();
  const pts:number[]=[];
  for(let i=0;i<1500;i++){
    const r=60;
    const a=Math.random()*Math.PI*2;
    const b=Math.acos(2*Math.random()-1);
    pts.push(Math.sin(b)*Math.cos(a)*r, Math.sin(b)*Math.sin(a)*r*0.8+Math.cos(b)*r*0.5, Math.cos(b)*Math.sin(a)*r);
  }
  stars.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
  g.add(new THREE.Points(stars, new THREE.PointsMaterial({color:0xffffff,size:0.15,sizeAttenuation:true})));
  // Earth
  const earth = new THREE.Group();
  const e = new THREE.Mesh(new THREE.SphereGeometry(5,48,32), PAL.earthBlue);
  earth.add(e);
  // crude continents (green patches)
  for(let i=0;i<30;i++){
    const lat=(Math.random()-0.5)*Math.PI;
    const lon=Math.random()*Math.PI*2;
    const r=5.01;
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.8+Math.random()*0.8,8,8), PAL.earthGreen);
    patch.position.set(Math.cos(lon)*Math.cos(lat)*r, Math.sin(lat)*r, Math.sin(lon)*Math.cos(lat)*r);
    patch.lookAt(0,0,0);
    earth.add(patch);
  }
  // clouds
  for(let i=0;i<20;i++){
    const lat=(Math.random()-0.5)*Math.PI;
    const lon=Math.random()*Math.PI*2;
    const r=5.03;
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.5+Math.random(),6,6), new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0.6,roughness:1}));
    c.position.set(Math.cos(lon)*Math.cos(lat)*r, Math.sin(lat)*r, Math.sin(lon)*Math.cos(lat)*r);
    c.lookAt(0,0,0);
    earth.add(c);
  }
  earth.position.set(-18,-8,-30);
  g.add(earth);
  (g as any)._earth = earth;
  // sunlight
  const sun = new THREE.DirectionalLight(0xfff8e8, 1.6);
  sun.position.set(-20,10,-10);
  g.add(sun);
  g.add(new THREE.AmbientLight(0x203050,0.3));
  // airlock ring (exit door)
  const airlock = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8,0.15,12,32), PAL.metal);
  airlock.add(ring);
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.75,24), PAL.dark);
  door.position.z=-0.01; airlock.add(door);
  airlock.position.set(0,0,-3);
  airlock.rotation.y = 0;
  g.add(airlock);
  (g as any)._airlock = airlock;
  return g;
}

// ============================================================
// 主 App — 分镜 / 时间轴 / 相机插值 / 动画
// ============================================================
type Shot = {
  start:number; end:number;
  scene:'basement'|'space'|'transition'|'closeup_rifle'|'thruster';
  camFrom:THREE.Vector3; camTo:THREE.Vector3; // camera at start/end (world)
  lookFrom:THREE.Vector3; lookTo:THREE.Vector3;
  fov?:[number,number];
  actors?:Record<string, {pos0?:[number,number,number]; pos1?:[number,number,number]; rot0?:[number,number,number]; rot1?:[number,number,number]; visible?:boolean; mesh?:THREE.Group;}>;
  onStart?:(api:Api)=>void;
  onFrame?:(t:number, api:Api)=>void; // t 0..1 within shot
};

type Api = {
  sceneBasement:THREE.Group, sceneSpace:THREE.Group, camera:THREE.PerspectiveCamera,
  player:THREE.Group, // Zhang Beihai
  targets:THREE.Group[], // 3 old astronauts
  rifleMuzzle:()=>void,
  audio:AudioEngine,
  bloodTrails:THREE.Group,
  thrusterGlow:THREE.Mesh,
};

export default function App(){
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [currentSub, setCurrentSub] = useState<Subtitle|null>(null);
  const [nowText, setNowText] = useState('00:00');
  const [chapter, setChapter] = useState<string>('');

  useEffect(()=>{
    if(!started||!mountRef.current) return;
    const audio = new AudioEngine();
    audio.start();

    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=true;
    renderer.setClearColor(0x05070c);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 0.05, 500);

    // Ambient & fill
    scene.add(new THREE.AmbientLight(0xffffff,0.2));

    // Basement scene
    const basement = buildBasement(scene);
    // Add Zhang Beihai in basement (no helmet; civilian clothes)
    const zbBase = new THREE.Group();
    // civilian: dark jacket, no helmet
    const zb = new THREE.Group();
    // head
    voxel(0,1.65,0,0.3,0.35,0.3, PAL.skin, zb);
    voxel(0,1.82,0,0.3,0.1,0.3, PAL.hair, zb);
    // torso (dark jacket)
    const jacket = makeMat(0x1a2230);
    voxel(0,1.1,0,0.58,0.7,0.35, jacket, zb);
    // legs
    const pants = makeMat(0x20222a);
    voxel(-0.15,0.38,0,0.24,0.7,0.25, pants, zb);
    voxel(0.15,0.38,0,0.24,0.7,0.25, pants, zb);
    // arms — right arm operating lathe
    const armR = new THREE.Group();
    voxel(0,0.3,0,0.15,0.6,0.15, jacket, armR);
    voxel(0,0,0,0.12,0.12,0.12, PAL.skin, armR);
    armR.position.set(0.38,1.2,0);
    armR.rotation.z=-1.0; armR.rotation.x=0.2;
    zb.add(armR);
    const armL = new THREE.Group();
    voxel(0,0.3,0,0.15,0.6,0.15, jacket, armL);
    voxel(0,0,0,0.12,0.12,0.12, PAL.skin, armL);
    armL.position.set(-0.38,1.2,0.05);
    armL.rotation.z=0.6;
    zb.add(armL);
    zb.position.set(-0.8,0,1.2);
    zb.rotation.y = 0.3;
    zbBase.add(zb);
    basement.add(zbBase);

    // Space scene
    const space = buildSpace(scene);
    // Zhang Beihai in spacesuit (gold visor + rifle)
    const zbSpace = buildAstronaut(true, true);
    zbSpace.position.set(0,0,-1);
    space.add(zbSpace);
    // Three targets ahead (3km away, but we scale for film so 20 units away)
    const targets: THREE.Group[] = [];
    for(let i=0;i<3;i++){
      const t = buildAstronaut(false, false);
      t.position.set(-2+i*2, 0+Math.sin(i)*0.3, -18);
      t.rotation.y = Math.PI+(Math.random()-0.5)*0.4;
      // tether/MMU lines
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,1.2,-0.2), new THREE.Vector3(0,1.2,8)
      ]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color:0xa0a8b0,transparent:true,opacity:0.4}));
      t.add(line);
      space.add(t);
      targets.push(t);
    }
    // floating blood/damage bits pool (hidden until shots)
    const bloodGroup = new THREE.Group();
    for (let i=0;i<30;i++){
      const s = 0.03+Math.random()*0.05;
      const b = new THREE.Mesh(new THREE.SphereGeometry(s,6,6), PAL.bloodFloat);
      b.visible=false;
      (b as any)._v = new THREE.Vector3((Math.random()-0.5)*0.3,(Math.random()-0.5)*0.3,(Math.random()-0.5)*0.3);
      bloodGroup.add(b);
    }
    space.add(bloodGroup);
    // thruster glow
    const thrusterGlow = new THREE.Mesh(new THREE.ConeGeometry(0.1,0.4,12), new THREE.MeshBasicMaterial({color:0x80c0ff, transparent:true, opacity:0}));
    thrusterGlow.rotation.x = Math.PI;
    thrusterGlow.position.set(0,1.2,-0.3);
    space.add(thrusterGlow);

    // ============== Cuts / shots ==============
    const shots: Shot[] = [
      // 1) 开场：黑暗中的地下室顶灯亮起
      {
        start:0, end:7, scene:'basement',
        camFrom:new THREE.Vector3(2,1.5,-2.5), camTo:new THREE.Vector3(1.5,1.3,-1.2),
        lookFrom:new THREE.Vector3(-0.5,1,1), lookTo:new THREE.Vector3(-0.8,1.1,0.6),
        fov:[45,40],
      },
      // 2) 近景 陨石与车床
      {
        start:7, end:16, scene:'basement',
        camFrom:new THREE.Vector3(-0.2,1.25,0.2), camTo:new THREE.Vector3(0.1,1.1,1.0),
        lookFrom:new THREE.Vector3(-0.4,1.0,0.7), lookTo:new THREE.Vector3(0.3,0.95,0.6),
        fov:[35,30],
        onStart:()=>audio.lathe(0,9),
        onFrame:(t)=>{
          // lathe spins
          const spindle = basement.getObjectByName('spindle') as THREE.Mesh;
          // we didn't name it; just skip visual spin
        }
      },
      // 3) 章北海侧面特写（眼中映着陨石冷光）
      {
        start:16, end:26, scene:'basement',
        camFrom:new THREE.Vector3(-1.6,1.7,0.8), camTo:new THREE.Vector3(-1.4,1.65,0.9),
        lookFrom:new THREE.Vector3(-0.85,1.7,0.85), lookTo:new THREE.Vector3(-0.78,1.68,0.9),
        fov:[28,28],
      },
      // 4) 转场：黑场 -> 太空 / 地球
      {
        start:26, end:32, scene:'transition',
        camFrom:new THREE.Vector3(-1.4,1.65,0.9), camTo:new THREE.Vector3(0,0,2),
        lookFrom:new THREE.Vector3(-15,0,-25), lookTo:new THREE.Vector3(-18,-8,-30),
        fov:[28,60],
        onStart:()=>{
          basement.visible=false;
          space.visible=true;
        }
      },
      // 5) 太空全景：地球 + 宇航员出舱
      {
        start:32, end:48, scene:'space',
        camFrom:new THREE.Vector3(0,0.5,4), camTo:new THREE.Vector3(0.5,0.2,1.5),
        lookFrom:new THREE.Vector3(-5,-2,-10), lookTo:new THREE.Vector3(-18,-8,-30),
        fov:[70,55],
        onStart:()=>audio.breath(0,16),
      },
      // 6) 章北海飘出舱门（侧面）
      {
        start:48, end:60, scene:'space',
        camFrom:new THREE.Vector3(2.5,0.5,-2), camTo:new THREE.Vector3(1.2,0.2,-1),
        lookFrom:new THREE.Vector3(0,1.6,0), lookTo:new THREE.Vector3(0,1.6,-2),
        fov:[45,40],
      },
      // 7) 头盔面罩特写 — 反射出三个人影
      {
        start:60, end:72, scene:'space',
        camFrom:new THREE.Vector3(0.3,1.8,-0.3), camTo:new THREE.Vector3(0.1,1.75,-0.1),
        lookFrom:new THREE.Vector3(0,1.7,0.3), lookTo:new THREE.Vector3(0,1.72,0.5),
        fov:[20,20],
      },
      // 8) 远景：三人漂浮（章北海在前景取枪）
      {
        start:72, end:88, scene:'space',
        camFrom:new THREE.Vector3(0,0.5,0.5), camTo:new THREE.Vector3(0,0.3,-0.5),
        lookFrom:new THREE.Vector3(-1,0,-15), lookTo:new THREE.Vector3(0,0,-18),
        fov:[50,35],
      },
      // 9) 枪/手套特写：装填子弹
      {
        start:88, end:104, scene:'closeup_rifle',
        camFrom:new THREE.Vector3(0.5,0.9,0.1), camTo:new THREE.Vector3(0.4,0.85,-0.05),
        lookFrom:new THREE.Vector3(0.4,0.85,-0.2), lookTo:new THREE.Vector3(0.38,0.87,-0.25),
        fov:[25,22],
        onStart:()=>{space.visible=true;},
      },
      // 10) 瞄准 — 过肩视角对准目标
      {
        start:104, end:124, scene:'space',
        camFrom:new THREE.Vector3(0.1,1.7,0.2), camTo:new THREE.Vector3(0.15,1.68,0.1),
        lookFrom:new THREE.Vector3(-0.5,0,-16), lookTo:new THREE.Vector3(0,0,-18),
        fov:[30,12],
        onStart:()=>{audio.heartbeat(0,3);},
      },
      // 11) 三枪（闷震+枪焰+无声音）
      {
        start:124, end:144, scene:'space',
        camFrom:new THREE.Vector3(0.15,1.68,0.1), camTo:new THREE.Vector3(0.15,1.68,0.1),
        lookFrom:new THREE.Vector3(0,0,-18), lookTo:new THREE.Vector3(0,0,-18),
        fov:[15,30],
        onFrame:(t)=>{
          // kick at t=0.15, 0.35, 0.6
          const shotsT = [0.12,0.35,0.58];
          shotsT.forEach((st2,i)=>{
            const k = `shot${i}`;
            if (Math.abs(t-st2)<0.02 && !(api as any)[k]){
              (api as any)[k]=true;
              api.rifleMuzzle();
              api.audio.shot(0);
              // release blood bits from target i
              const target = api.targets[i];
              if (target){
                // disable mesh; leave drifting bits
                target.visible=false;
                for (let j=0;j<10;j++){
                  const bit = api.bloodTrails.children[j+i*10] as THREE.Mesh;
                  if (bit){
                    bit.visible=true;
                    bit.position.copy(target.position);
                    bit.position.y+=1.2;
                    (bit as any)._v.set((Math.random()-0.5)*0.5,(Math.random()-0.5)*0.3,-Math.random()*0.6-0.2);
                  }
                }
              }
            }
          });
        }
      },
      // 12) 尸体漂远 — 远景
      {
        start:144, end:166, scene:'space',
        camFrom:new THREE.Vector3(0,1.5,0.5), camTo:new THREE.Vector3(0,0.5,-1),
        lookFrom:new THREE.Vector3(0,0,-18), lookTo:new THREE.Vector3(0,-0.5,-30),
        fov:[45,55],
        onStart:()=>{audio.alarm(0,6); audio.radio(0,8);},
      },
      // 13) 章北海转身（推进器蓝色光点）
      {
        start:166, end:188, scene:'space',
        camFrom:new THREE.Vector3(0.5,1.5,-1.5), camTo:new THREE.Vector3(-1,1,3),
        lookFrom:new THREE.Vector3(0,1.6,0), lookTo:new THREE.Vector3(0,1.2,2),
        fov:[40,50],
        onStart:()=>{audio.thruster(0,4);},
        onFrame:(t)=>{
          zbSpace.rotation.y = t*Math.PI*0.7;
          api.thrusterGlow.material.opacity = Math.max(0,0.8-t*0.3);
        }
      },
      // 14) 结束：远去的飞船 / 自然选择四字
      {
        start:188, end:TOTAL_DUR, scene:'space',
        camFrom:new THREE.Vector3(-1,1,3), camTo:new THREE.Vector3(0,2,8),
        lookFrom:new THREE.Vector3(0,0,-50), lookTo:new THREE.Vector3(0,0,-80),
        fov:[55,60],
      }
    ];

    function findShot(t:number): Shot|undefined{
      return shots.find(s=>t>=s.start&&t<s.end);
    }

    // muzzle flash API
    const rifleMuzzle=()=>{
      const flash = (zbSpace as any)._flash as THREE.Mesh;
      if (flash){
        flash.material.opacity = 1;
        setTimeout(()=>{if(flash.material) flash.material.opacity=0;},80);
      }
    };

    const api: Api = { sceneBasement:basement, sceneSpace:space, camera, player:zbSpace, targets, rifleMuzzle, audio, bloodTrails:bloodGroup, thrusterGlow };

    // initial visibility
    basement.visible = true;
    space.visible = false;

    // subtitles start/end
    function subAt(t:number):Subtitle|null{
      return SUBS.find(s=>t>=s.start&&t<s.end)||null;
    }

    // chapters
    const chapters: {[k:string]:string} = {
      '0':'第一幕 · 陨石','26':'第二幕 · 出舱','72':'第三幕 · 瞄准','124':'第四幕 · 真空','166':'尾声 · 前进四'
    };
    function chapterAt(t:number):string{
      let cur='';
      Object.keys(chapters).map(Number).sort((a,b)=>a-b).forEach(k=>{if(t>=k) cur=chapters[String(k)];});
      return cur;
    }

    const clock = new THREE.Clock();
    let lastShotIdx = -1;
    let raf=0;
    function loop(){
      raf=requestAnimationFrame(loop);
      let dt = Math.min(clock.getDelta(),0.05);
      const t = clock.elapsedTime;
      const tt = t%TOTAL_DUR;
      if (t>=TOTAL_DUR){ clock.elapsedTime=0; }
      const shot = findShot(tt);

      // set scene visibility
      if (shot){
        basement.visible = shot.scene==='basement'||shot.scene==='transition';
        space.visible = shot.scene==='space'||shot.scene==='closeup_rifle'||shot.scene==='transition';
      }

      // camera interpolation
      if (shot){
        const dur = shot.end-shot.start;
        const lt = Math.min(1,(tt-shot.start)/dur);
        // ease
        const e = lt<.5?2*lt*lt:-1+(4-2*lt)*lt;
        const from = shot.camFrom, to = shot.camTo;
        camera.position.set(
          THREE.MathUtils.lerp(from.x,to.x,e),
          THREE.MathUtils.lerp(from.y,to.y,e),
          THREE.MathUtils.lerp(from.z,to.z,e),
        );
        const lf = shot.lookFrom, lt2 = shot.lookTo;
        const look = new THREE.Vector3(
          THREE.MathUtils.lerp(lf.x,lt2.x,e),
          THREE.MathUtils.lerp(lf.y,lt2.y,e),
          THREE.MathUtils.lerp(lf.z,lt2.z,e),
        );
        camera.lookAt(look);
        if (shot.fov){
          camera.fov = THREE.MathUtils.lerp(shot.fov[0],shot.fov[1],e);
          camera.updateProjectionMatrix();
        }
        const sIdx = shots.indexOf(shot);
        if (sIdx!==lastShotIdx){
          lastShotIdx=sIdx;
          (api as any).shot0=false;(api as any).shot1=false;(api as any).shot2=false;
          shot.onStart?.(api);
          // reset thruster glow
          thrusterGlow.material.opacity = 0;
        }
        shot.onFrame?.(e,api);
      }

      // blood bits drift
      bloodGroup.children.forEach(c=>{
        const b = c as THREE.Mesh;
        if (b.visible){
          b.position.add((b as any)._v.clone().multiplyScalar(dt*0.3));
          (b as any)._v.multiplyScalar(0.99);
          b.rotation.x+=dt;b.rotation.y+=dt*0.7;
        }
      });

      // earth slow rotate
      if ((space as any)._earth) (space as any)._earth.rotation.y += dt*0.02;

      // slow drift of targets (when alive/visible)
      targets.forEach((tg,i)=>{
        if (tg.visible){
          tg.position.y += Math.sin(t*0.5+i)*dt*0.02;
          tg.rotation.y += dt*0.1;
        } else {
          tg.position.z -= dt*0.5;
          tg.rotation.x += dt*0.3;
        }
      });

      renderer.render(scene,camera);

      // HUD
      const s = subAt(tt);
      setCurrentSub(s);
      const mins = Math.floor(tt/60), secs = Math.floor(tt%60);
      setNowText(`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`);
      setChapter(chapterAt(tt));
    }
    loop();

    const onResize=()=>{
      renderer.setSize(innerWidth,innerHeight);
      camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();
    };
    addEventListener('resize',onResize);

    return ()=>{
      cancelAnimationFrame(raf);
      removeEventListener('resize',onResize);
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    };
  },[started]);

  return (
    <>
      <div ref={mountRef} style={{width:'100%',height:'100%',position:'fixed',inset:0}}/>
      <div className="film"/>
      <div className="vignette"/>
      {started && (
        <>
          <div className="topbar">章北海 · 陨石子弹</div>
          <div className="chapter">{chapter}</div>
          {currentSub && (
            <div className="subtitle">
              <span className="who">【{currentSub.speaker}】</span>
              {currentSub.text}
            </div>
          )}
          <div className="bottombar">
            <div className="time">{nowText} / 03:20</div>
            <div>基于刘慈欣《三体 II · 黑暗森林》· 体素短片</div>
          </div>
        </>
      )}
      {!started && (
        <div className="overlay" onClick={()=>setStarted(true)}>
          <h1>陨石子弹</h1>
          <div className="sub">—— 章北海 ——</div>
          <div className="quote">
            "自然选择号，前进四。"<br/>
            他举起了陨石子弹，对准三公里外漂浮的同行者。<br/>
            太空中没有声音。
          </div>
          <div className="tip">点击开始播放 · 时长约 3 分 20 秒</div>
        </div>
      )}
    </>
  );
}
