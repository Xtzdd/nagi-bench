import * as THREE from 'three';
import { FilmAudio } from './audio';
import { CUES, DURATION } from './cues';
import type { FilmState, VoiceCue } from './types';

interface ShotKey { time:number; pos:[number,number,number]; look:[number,number,number] }
const SHOTS: ShotKey[] = [
  { time:0, pos:[0,9,20], look:[0,0,0] },
  { time:20, pos:[-12,20,26], look:[-10,24,-14] },
  { time:42, pos:[7,10,18], look:[0,12,-6] },
  { time:62, pos:[0,32,30], look:[0,0,0] },
  { time:82, pos:[-15,8,17], look:[-18,1,10] },
  { time:106, pos:[-3,7,13], look:[-5,0,5] },
  { time:132, pos:[9,-3,10], look:[0,-9,0] },
  { time:158, pos:[7,-4,10], look:[0,-9,0] },
  { time:180, pos:[0,15,26], look:[0,-2,0] }
];
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp01(v);return v*v*(3-2*v)};

export class CinematicEngine {
  private container:HTMLElement;
  private onState:(s:FilmState)=>void;
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera:THREE.PerspectiveCamera;
  private audio=new FilmAudio();
  private time=0;
  private playing=false;
  private lastCueId=-1;
  private ambientTimer=0;
  private oceanCubes:{m:THREE.Mesh;x:number;z:number;phase:number}[]=[];
  private meteor!:THREE.Group;
  private debris!:THREE.Group;
  private ship!:THREE.Group;
  private sub!:THREE.Group;
  private seabed!:THREE.Group;
  private underwaterMeteor!:THREE.Group;
  private impactRing!:THREE.Mesh;
  private flash!:THREE.Mesh;
  private subLight!:THREE.PointLight;
  private meteorLight!:THREE.PointLight;
  private currentLook=new THREE.Vector3();
  private disposed=false;

  constructor(container:HTMLElement,onState:(s:FilmState)=>void) {
    this.container=container; this.onState=onState;
    this.renderer=new THREE.WebGLRenderer({antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(container.clientWidth,container.clientHeight);
    this.renderer.shadowMap.enabled=true;
    container.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color(0x07101f);
    this.scene.fog=new THREE.FogExp2(0x07101f,.018);
    this.camera=new THREE.PerspectiveCamera(45,container.clientWidth/container.clientHeight,.1,200);
    this.camera.position.set(...SHOTS[0].pos);
    this.buildLights(); this.buildStars(); this.buildOcean(); this.buildMeteor(); this.buildShip(); this.buildSub(); this.buildSeabed(); this.buildImpact();
    addEventListener('resize',this.handleResize);
    this.renderer.setAnimationLoop(this.tick);
    this.update(0,true); this.emit();
  }
  private mat(color:number,emissive=0,ei=0) { return new THREE.MeshLambertMaterial({color,emissive,emissiveIntensity:ei}); }
  private voxel(parent:THREE.Object3D,x:number,y:number,z:number,color:number,s=1,emissive=0) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(s,s*.98,s),this.mat(color,emissive,emissive?1:0));
    m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; parent.add(m); return m;
  }
  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x8fb4e8,0x1b2530,1.4));
    const moon=new THREE.DirectionalLight(0xd7e8ff,1.7); moon.position.set(-12,24,10); moon.castShadow=true; this.scene.add(moon);
    this.meteorLight=new THREE.PointLight(0xff7b35,0,18); this.scene.add(this.meteorLight);
    this.subLight=new THREE.PointLight(0xdff5ff,0,18); this.scene.add(this.subLight);
  }
  private buildStars() {
    const g=new THREE.Group();
    for(let i=0;i<180;i++){
      const s=this.voxel(g,(Math.random()*80-40),18+Math.random()*22,(Math.random()*70-35),0xe9f5ff,.18);
      (s as THREE.Mesh).material=new THREE.MeshBasicMaterial({color:0xe9f5ff});
    }
    this.scene.add(g);
  }
  private buildOcean() {
    const g=new THREE.Group();
    for(let x=-9;x<=9;x++)for(let z=-9;z<=9;z++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(1.05,.22,1.05),this.mat(0x1b6f9f));
      m.position.set(x*.98,-.2,z*.98); g.add(m); this.oceanCubes.push({m,x:x*.98,z:z*.98,phase:Math.random()*Math.PI*2});
    }
    this.scene.add(g);
  }
  private buildMeteor() {
    this.meteor=new THREE.Group();
    for(let i=0;i<70;i++){
      const x=Math.random()*2.8-1.4,y=Math.random()*2.4-1.2,z=Math.random()*2.8-1.4;
      if(x*x+y*y+z*z<4.2) {
        const crack=Math.random()<.18;
        this.voxel(this.meteor,x,y,z,crack?0xff742e:0x4a4846,.82,crack?0xff4a1a:0);
      }
    }
    this.meteor.position.set(-18,34,-18); this.scene.add(this.meteor);
    this.debris=new THREE.Group();
    for(let i=0;i<28;i++)this.voxel(this.debris,Math.random()*2-1,Math.random()*2-1,Math.random()*2-1,Math.random()<.5?0x6b5545:0xff8338,.25,0xff5a20);
    this.scene.add(this.debris);
  }
  private buildShip() {
    this.ship=new THREE.Group();
    const hull=0x6e3f2a, deck=0xb78355, cabin=0xe2e5dc;
    for(let x=-4;x<=4;x++){const w=6-Math.abs(x)*.45;for(let z=-2;z<=2;z++)if(Math.abs(z)<w/2)this.voxel(this.ship,x,z===0?0:1,z,Math.random()<.25?deck:hull,.92)}
    for(let x=-1;x<=2;x++)for(let z=-1;z<=1;z++)this.voxel(this.ship,x,2,z,cabin,.9);
    this.voxel(this.ship,0,3,0,0x45627a,.7);
    this.voxel(this.ship,-4,2,0,0xffffd0,.35,0xffe08a);
    this.ship.position.set(-24,0,14); this.ship.visible=false; this.scene.add(this.ship);
  }
  private buildSub() {
    this.sub=new THREE.Group();
    for(let x=-2;x<=2;x++)for(let z=-1;z<=1;z++)this.voxel(this.sub,x,0,z,0xe8c24e,.88);
    for(let x=-1;x<=1;x++)this.voxel(this.sub,x,1,0,0xf2f4e8,.82);
    this.voxel(this.sub,-3,0,0,0x4c555a,.5); this.voxel(this.sub,3,0,0,0x263746,.45);
    this.voxel(this.sub,1,1,.5,0xfff3b0,.25,0xffe08a);
    this.sub.visible=false; this.scene.add(this.sub);
  }
  private buildSeabed() {
    this.seabed=new THREE.Group();
    const floor=new THREE.Mesh(new THREE.BoxGeometry(42,1,42),this.mat(0x9c8760));
    floor.position.y=-10.5; floor.receiveShadow=true; this.seabed.add(floor);
    for(let i=0;i<70;i++){
      const x=Math.random()*36-18,z=Math.random()*36-18;
      const h=1+Math.random()*3;
      this.voxel(this.seabed,x,-10+h/2,z,Math.random()<.5?0x6b6558:0x7d705e,h);
      if(Math.random()<.22)for(let y=0;y<4;y++)this.voxel(this.seabed,x,-9+y,z,0x356b4b,.25);
    }
    this.underwaterMeteor=new THREE.Group();
    for(let i=0;i<45;i++){
      const x=Math.random()*2.2-1.1,y=Math.random()*1.4-.7,z=Math.random()*2.2-1.1;
      if(x*x+y*y+z*z<2.6)this.voxel(this.underwaterMeteor,x,y,z,Math.random()<.15?0xd6c17d:0x3d3d3b,.72,Math.random()<.15?0xd6c17d:0);
    }
    this.underwaterMeteor.position.set(0,-9,0); this.seabed.add(this.underwaterMeteor);
    this.scene.add(this.seabed);
  }
  private buildImpact() {
    this.impactRing=new THREE.Mesh(new THREE.TorusGeometry(2,.08,10,100),new THREE.MeshBasicMaterial({color:0xdff6ff,transparent:true,opacity:0}));
    this.impactRing.rotation.x=-Math.PI/2; this.impactRing.position.y=.18; this.scene.add(this.impactRing);
    this.flash=new THREE.Mesh(new THREE.SphereGeometry(1,32,18),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0}));
    this.scene.add(this.flash);
  }
  play() { this.audio.unlock(); this.playing=true; this.emit(); }
  pause() { this.playing=false; this.emit(); }
  seek(t:number) { this.time=Math.max(0,Math.min(DURATION,t)); this.update(this.time,true); this.emit(); }

  private cueAt(t:number):VoiceCue { return CUES.find(c=>t>=c.start&&t<c.end)||CUES[CUES.length-1]; }
  private triggerCueSound(c:VoiceCue) {
    if(c.id===this.lastCueId)return; this.lastCueId=c.id;
    if(c.id<=2)this.audio.wind();
    if(c.id===2)this.audio.whoosh();
    if(c.id===3)this.audio.fire();
    if(c.id===4)this.audio.explosion();
    if(c.id===5)this.audio.horn();
    if(c.id===6||c.id===7)this.audio.sonar();
    if(c.id===8)this.audio.tail();
  }
  private updateCamera(t:number) {
    let i=0; while(i<SHOTS.length-1&&SHOTS[i+1].time<=t)i++;
    const a=SHOTS[i],b=SHOTS[Math.min(SHOTS.length-1,i+1)];
    const p=smooth((t-a.time)/Math.max(.001,b.time-a.time));
    this.camera.position.set(a.pos[0]+(b.pos[0]-a.pos[0])*p,a.pos[1]+(b.pos[1]-a.pos[1])*p,a.pos[2]+(b.pos[2]-a.pos[2])*p);
    this.currentLook.set(a.look[0]+(b.look[0]-a.look[0])*p,a.look[1]+(b.look[1]-a.look[1])*p,a.look[2]+(b.look[2]-a.look[2])*p);
    this.camera.lookAt(this.currentLook);
  }
  private update(t:number,force=false) {
    const cue=this.cueAt(t); this.triggerCueSound(cue);
    const night=t<106;
    this.scene.background=new THREE.Color(t<62?0x07101f:t<106?0x102942:t<158?0x063957:0x172d4a);
    this.scene.fog=new THREE.FogExp2(t<106?0x07101f:0x0a5b80,t<106?.018:.055);
    for(const o of this.oceanCubes){o.m.position.y=-.22+Math.sin(t*1.4+o.phase)*.08;o.m.visible=t<158}
    if(t<62) {
      const p=smooth((t-20)/42);
      this.meteor.visible=t>18;
      this.meteor.position.lerpVectors(new THREE.Vector3(-18,34,-18),new THREE.Vector3(0,0,0),p);
      this.meteor.rotation.set(t*.7,t*1.3,t*.4);
      this.meteorLight.position.copy(this.meteor.position); this.meteorLight.intensity=t>20?2.2:0;
      this.debris.visible=t>24;
      this.debris.children.forEach((c,i)=>{c.position.set(Math.sin(i*7+t*(.7+i*.03))*2,Math.cos(i*5+t*.6)*1.4,Math.cos(i*9+t*.5)*2)});
    } else { this.meteor.visible=false; this.debris.visible=false; this.meteorLight.intensity=0; }
    const ip=t-62;
    if(ip>=0&&ip<18){const p=smooth(ip/18);this.impactRing.scale.setScalar(1+p*13);(this.impactRing.material as THREE.MeshBasicMaterial).opacity=(1-p)*.75;this.flash.scale.setScalar(1+p*8);(this.flash.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.8-p)}
    this.ship.visible=t>=82&&t<116;
    if(this.ship.visible){const p=smooth((t-82)/24);this.ship.position.lerpVectors(new THREE.Vector3(-24,0,14),new THREE.Vector3(-8,0,8),p);this.ship.rotation.z=Math.sin(t*2)*.02}
    this.sub.visible=t>=104;
    if(this.sub.visible){
      if(t<132){const p=smooth((t-106)/26);this.sub.position.lerpVectors(new THREE.Vector3(-8,0,8),new THREE.Vector3(0,-8,0),p)}
      else this.sub.position.set(3,-7.5,3);
      this.subLight.position.copy(this.sub.position); this.subLight.intensity=t>106?2.5:0;
    } else this.subLight.intensity=0;
    this.updateCamera(t);
    if(force)this.emit();
  }
  private tick=()=>{
    if(this.disposed)return; const dt=1/60;
    if(this.playing){this.time+=dt;if(this.time>=DURATION){this.time=DURATION;this.playing=false};this.update(this.time)}
    this.ambientTimer-=dt; if(this.ambientTimer<=0){this.ambientTimer=this.time<106?1.6:1.2;if(this.time<82)this.audio.ocean();if(this.time<62)this.audio.wind();if(this.time>106)this.audio.sonar()}
    this.renderer.render(this.scene,this.camera);
    if(this.playing)this.emit();
  };
  private emit(){const cue=this.cueAt(this.time);this.onState({time:this.time,duration:DURATION,playing:this.playing,subtitle:cue.subtitle,scene:cue.scene,cueId:cue.id,cues:CUES})}
  private handleResize=()=>{const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h)};
  dispose(){this.disposed=true;this.renderer.setAnimationLoop(null);removeEventListener('resize',this.handleResize);this.renderer.dispose();this.renderer.domElement.remove()}
}
