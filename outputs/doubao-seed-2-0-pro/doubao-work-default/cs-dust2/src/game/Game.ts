import * as THREE from 'three';
import { AudioEngine } from './audio';
import { createMap, type Region } from './map';
import { Soldier, WEAPONS } from './soldier';
import type { HudState, RoundPhase, SiteId, Team, WeaponId } from './types';

interface Tracer { line: THREE.Line; life: number }
interface Effect { object: THREE.Object3D; life: number; maxLife: number; kind: string }

const T_NAMES = ['你','渡鸦','猎隼','灯塔','燧石'];
const CT_NAMES = ['寒霜','城墙','猎鹰','哨兵','蓝盾'];
const DEFENSIVE: [number,number][] = [[32,-10],[24,-16],[12,-18],[-34,21],[-28,10],[0,2]];

export class Game {
  private container: HTMLElement;
  private onState: (s: HudState) => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private audio = new AudioEngine();
  private regions: Region[] = [];
  private soldiers: Soldier[] = [];
  private player!: Soldier;
  private keys = new Set<string>();
  private mouse = new THREE.Vector2();
  private aimPoint = new THREE.Vector3();
  private mouseDown = false;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private tracers: Tracer[] = [];
  private effects: Effect[] = [];
  private bomb = new THREE.Mesh(new THREE.BoxGeometry(.65,.28,.42), new THREE.MeshStandardMaterial({color:0x2f3a28,roughness:.5,metalness:.4}));
  private bombPlanted = false;
  private bombSite: SiteId | null = null;
  private bombTimer = 40;
  private defuseProgress = 0;
  private roundTimer = 115;
  private phase: RoundPhase = '进行中';
  private scoreT = 0;
  private scoreCT = 0;
  private feed: string[] = [];
  private message = '进攻方：前往 A 或 B 包点安放 C4';
  private roundEndAt = 0;
  private stateTimer = 0;
  private footstepTimer = 0;
  private lastBombSecond = -1;
  private disposed = false;

  constructor(container: HTMLElement, onState: (s: HudState) => void) {
    this.container = container;
    this.onState = onState;
    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xc7d2d8);
    this.scene.fog = new THREE.FogExp2(0xc7d2d8,.008);
    this.camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, .1, 200);
    this.camera.position.set(0,54,46);
    this.camera.lookAt(0,0,2);

    const hemi = new THREE.HemisphereLight(0xffffff,0x7a5e42,1.7);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d2,2.4);
    sun.position.set(-25,45,20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-55; sun.shadow.camera.right=55; sun.shadow.camera.top=55; sun.shadow.camera.bottom=-55;
    this.scene.add(sun);

    const map = createMap(this.scene);
    this.regions = map.regions;
    this.bomb.visible = false; this.bomb.position.y = .16; this.scene.add(this.bomb);
    this.buildActors();
    this.bindEvents();
    this.emitState();
    this.renderer.setAnimationLoop(this.tick);
  }

  private bindEvents() {
    addEventListener('keydown', this.handleKeyDown);
    addEventListener('keyup', this.handleKeyUp);
    addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    addEventListener('pointerup', this.handlePointerUp);
  }

  private buildActors() {
    for (const s of this.soldiers) this.scene.remove(s.group);
    this.soldiers = [];
    let id = 0;
    for (let i=0;i<T_NAMES.length;i++) {
      const s = new Soldier(id++, T_NAMES[i], 'T', -40 + i*1.2, -34 + (i%2)*1.4, i===0);
      s.setWeapon(i===0?'rifle':(i===4?'pistol':'rifle'));
      this.soldiers.push(s); this.scene.add(s.group);
    }
    for (let i=0;i<CT_NAMES.length;i++) {
      const p = DEFENSIVE[i % DEFENSIVE.length];
      const s = new Soldier(id++, CT_NAMES[i], 'CT', p[0] + (i%2)*2, p[1] + (i%3-1)*2, false);
      s.setWeapon(i===4?'pistol':'rifle');
      s.waypoint.set(p[0],0,p[1]);
      this.soldiers.push(s); this.scene.add(s.group);
    }
    this.player = this.soldiers[0];
    this.bombPlanted=false; this.bombSite=null; this.bomb.visible=false;
    this.bombTimer=40; this.defuseProgress=0; this.roundTimer=115; this.phase='进行中';
    this.feed=[]; this.message='进攻方：前往 A 或 B 包点安放 C4'; this.lastBombSecond=-1;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.audio.unlock();
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k==='1') this.player.setWeapon('rifle');
    if (k==='2') this.player.setWeapon('pistol');
    if (k==='3') this.player.setWeapon('knife');
    if (k==='r') this.reload(this.player);
    if (k==='f') this.tryPlant();
  };
  private handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private handleResize = () => {
    const w=this.container.clientWidth,h=this.container.clientHeight;
    this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w,h);
  };
  private handlePointerMove = (e: PointerEvent) => {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
    this.mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(this.mouse,this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane,this.aimPoint);
  };
  private handlePointerDown = () => { this.audio.unlock(); this.mouseDown=true; };
  private handlePointerUp = () => { this.mouseDown=false; };

  private addFeed(text:string) {
    this.feed.unshift(text); this.feed=this.feed.slice(0,5);
  }
  private currentSite(): { site: SiteId; region: Region } | null {
    if (!this.player.alive) return null;
    for (const r of this.regions) if (r.site) {
      const d=Math.hypot(this.player.position.x-r.x,this.player.position.z-r.z);
      if (d<r.radius) return { site:r.site, region:r };
    }
    return null;
  }
  private tryPlant() {
    if (this.bombPlanted || this.phase!=='进行中') return;
    const site=this.currentSite();
    if (!site) { this.message='必须在 A 或 B 包点安放 C4'; return; }
    this.bombPlanted=true; this.bombSite=site.site; this.phase='炸弹已安放';
    this.bomb.position.copy(this.player.position); this.bomb.position.y=.18; this.bomb.visible=true;
    this.message=`C4 已安放在 ${site.site} 包点，40 秒后爆炸`;
    this.addFeed('你 安放了 C4'); this.audio.plant();
  }
  private reload(s:Soldier) {
    if (s.reload()) { s.cooldown=.9; this.audio.reload(); }
  }
  private alive(team:Team) { return this.soldiers.filter(s=>s.team===team&&s.alive); }
  private enemyNearest(s:Soldier,maxRange=80) {
    let best:Soldier|null=null,bd=maxRange;
    for (const t of this.soldiers) if (t.team!==s.team&&t.alive) {
      const d=s.position.distanceTo(t.position);
      if (d<bd) { bd=d; best=t; }
    }
    return best;
  }
  private muzzle(s:Soldier) {
    return s.group.localToWorld(new THREE.Vector3(.48,1.32,-.82));
  }
  private chest(s:Soldier) {
    return s.group.localToWorld(new THREE.Vector3(0,1.3,0));
  }
  private fire(s:Soldier,target:Soldier|null,point:THREE.Vector3) {
    const spec=WEAPONS[s.weapon];
    if (!s.alive || s.cooldown>0) return;
    if (s.weapon!=='knife' && s.ammo<=0) { this.reload(s); return; }
    s.cooldown=spec.fireRate;
    if (s.weapon!=='knife') s.ammo--;
    this.audio.shot(s.weapon);
    const start=this.muzzle(s);
    let hit=false;
    if (target) {
      const distance=s.position.distanceTo(target.position);
      const chance=s.isPlayer ? .96 : Math.max(.2,.86-distance*.012);
      hit=distance<=spec.range && Math.random()<chance;
      if (hit) {
        const amount=Math.round(spec.damage*(.78+Math.random()*.38));
        const died=target.damage(amount);
        this.audio.hit();
        if (died && !target.alive) this.addFeed(`${s.name} 击杀了 ${target.name}`);
      }
    }
    const end=hit&&target?this.chest(target):point;
    const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:s.weapon==='knife'?0xdddddd:0xffd073,transparent:true,opacity:.9}));
    this.scene.add(line); this.tracers.push({line,life:.08});
  }

  private playerFire() {
    this.raycaster.setFromCamera(this.mouse,this.camera);
    const enemies=this.soldiers.filter(s=>s.team!=='T'&&s.alive);
    const groups=enemies.map(s=>s.group);
    const hits=this.raycaster.intersectObjects(groups,true);
    let target:Soldier|null=null;
    if (hits.length) {
      let o:THREE.Object3D|null=hits[0].object;
      const id=enemies.find(s=>{let p:THREE.Object3D|null=o;while(p){if(p===s.group)return true;p=p.parent}return false});
      target=id||null;
    }
    this.fire(this.player,target,this.aimPoint);
  }

  private updatePlayer(dt:number) {
    if (!this.player.alive) return;
    let x=0,z=0;
    if (this.keys.has('w'))z--; if (this.keys.has('s'))z++; if (this.keys.has('a'))x--; if (this.keys.has('d'))x++;
    const moving=x!==0||z!==0;
    if (moving) {
      const l=Math.hypot(x,z),speed=9.2*dt;
      this.player.position.x=THREE.MathUtils.clamp(this.player.position.x+x/l*speed,-44,44);
      this.player.position.z=THREE.MathUtils.clamp(this.player.position.z+z/l*speed,-38,38);
      this.footstepTimer-=dt;
      if (this.footstepTimer<=0) { this.audio.footstep(); this.footstepTimer=.32; }
    }
    this.player.face(this.aimPoint);
    this.player.animate(dt,moving);
    if (this.mouseDown) this.playerFire();
  }

  private choosePoint(s:Soldier) {
    if (this.bombPlanted) {
      if (s.team==='CT') return new THREE.Vector3(this.bomb.position.x,0,this.bomb.position.z);
      return new THREE.Vector3(this.bomb.position.x+(Math.random()*5-2.5),0,this.bomb.position.z+(Math.random()*5-2.5));
    }
    if (s.team==='T') {
      const a=Math.random()<.55?[32,-10]:[-34,21];
      return new THREE.Vector3(a[0]+(Math.random()*4-2),0,a[1]+(Math.random()*4-2));
    }
    const p=DEFENSIVE[Math.floor(Math.random()*DEFENSIVE.length)];
    return new THREE.Vector3(p[0]+(Math.random()*4-2),0,p[1]+(Math.random()*4-2));
  }

  private updateAI(s:Soldier,dt:number) {
    s.cooldown=Math.max(0,s.cooldown-dt);
    const target=this.enemyNearest(s,this.bombPlanted&&s.team==='CT'?90:32);
    let moving=false;
    if (target) {
      s.face(target.position);
      const d=s.position.distanceTo(target.position);
      if (d>WEAPONS[s.weapon].range*.55) s.waypoint.copy(target.position);
      else if (d<8 && s.team==='T') s.waypoint.set(s.position.x+2,0,s.position.z+2);
      if (d<WEAPONS[s.weapon].range && s.cooldown<=0) this.fire(s,target,this.chest(target));
    }
    const d=s.position.distanceTo(s.waypoint);
    if (!target || d>WEAPONS[s.weapon].range*.55) moving=d>.8;
    if (moving) {
      const dir=s.waypoint.clone().sub(s.position).setY(0).normalize();
      s.position.addScaledVector(dir,dt*7.4);
      s.position.x=THREE.MathUtils.clamp(s.position.x,-44,44);
      s.position.z=THREE.MathUtils.clamp(s.position.z,-38,38);
    }
    if (d<1.2) s.waypoint.copy(this.choosePoint(s));
    s.animate(dt,moving);
  }

  private updateBomb(dt:number) {
    if (!this.bombPlanted) return;
    this.bombTimer-=dt;
    const sec=Math.ceil(this.bombTimer);
    if (sec!==this.lastBombSecond && sec>=0) { this.lastBombSecond=sec; this.audio.beep(); }
    let defuser:Soldier|null=null;
    for (const s of this.alive('CT')) if (s.position.distanceTo(this.bomb.position)<2.6) { defuser=s; break; }
    if (defuser) {
      this.defuseProgress+=dt;
      this.message=`CT 正在拆除 C4：${Math.min(100,Math.round(this.defuseProgress/3*100))}%`;
      if (this.defuseProgress>=3) this.endRound('CT','C4 已被拆除');
    } else this.defuseProgress=0;
    if (this.bombTimer<=0) this.explodeBomb();
  }
  private explodeBomb() {
    this.audio.explosion();
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshBasicMaterial({color:0xff8a28,transparent:true,opacity:.85}));
    sphere.position.copy(this.bomb.position); sphere.position.y=1; this.scene.add(sphere);
    this.effects.push({object:sphere,life:1.1,maxLife:1.1,kind:'explosion'});
    const light=new THREE.PointLight(0xff7a20,18,18); light.position.copy(sphere.position); this.scene.add(light);
    this.effects.push({object:light,life:.7,maxLife:.7,kind:'light'});
    for (const s of this.soldiers) if (s.alive && s.position.distanceTo(this.bomb.position)<10) s.damage(100);
    this.endRound('T','C4 爆炸，进攻方获胜');
  }
  private endRound(winner:Team,text:string) {
    if (this.phase==='回合结束') return;
    this.phase='回合结束'; this.message=text;
    if (winner==='T') this.scoreT++; else this.scoreCT++;
    this.roundEndAt=performance.now();
  }
  private checkRound() {
    if (this.phase==='回合结束') {
      if (performance.now()-this.roundEndAt>4000) this.buildActors();
      return;
    }
    if (!this.bombPlanted) {
      this.roundTimer-=1/60;
      if (this.roundTimer<=0) this.endRound('CT','时间耗尽，防守方获胜');
    }
    if (this.alive('T').length===0) this.endRound('CT','进攻方被全歼');
    if (this.alive('CT').length===0 && !this.bombPlanted) this.endRound('T','防守方被全歼');
  }
  private updateVisuals(dt:number) {
    for (let i=this.tracers.length-1;i>=0;i--) {
      const t=this.tracers[i]; t.life-=dt;
      if (t.life<=0) { this.scene.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i,1); }
    }
    for (let i=this.effects.length-1;i>=0;i--) {
      const e=this.effects[i]; e.life-=dt; const k=1-e.life/e.maxLife;
      if (e.kind==='explosion') e.object.scale.setScalar(1+k*9);
      if (e.kind==='light') (e.object as THREE.PointLight).intensity=18*(1-k);
      if (e.life<=0) { this.scene.remove(e.object); this.effects.splice(i,1); }
    }
  }

  private tick = () => {
    if (this.disposed) return;
    const dt=Math.min(.05,1/60);
    if (this.phase!=='回合结束') {
      this.updatePlayer(dt);
      for (const s of this.soldiers) if (!s.isPlayer&&s.alive) this.updateAI(s,dt);
      this.updateBomb(dt);
      this.checkRound();
    } else this.checkRound();
    this.updateVisuals(dt);
    this.stateTimer+=dt;
    if (this.stateTimer>.1) { this.stateTimer=0; this.emitState(); }
    this.renderer.render(this.scene,this.camera);
  };

  private emitState() {
    const site=this.currentSite();
    this.onState({
      phase:this.phase,
      timer:Math.max(0,Math.ceil(this.bombPlanted?this.bombTimer:this.roundTimer)),
      playerHp:this.player.hp,
      weapon:this.player.weapon,
      ammo:this.player.ammo,
      reserve:this.player.reserve,
      scoreT:this.scoreT,
      scoreCT:this.scoreCT,
      bombPlanted:this.bombPlanted,
      bombTimer:Math.max(0,Math.ceil(this.bombTimer)),
      bombSite:this.bombSite,
      canPlant:!!site&&!this.bombPlanted&&this.phase==='进行中',
      canDefuse:false,
      feed:[...this.feed],
      soldiers:this.soldiers.map(s=>({id:s.id,name:s.name,team:s.team,x:s.position.x,z:s.position.z,hp:s.hp,alive:s.alive,isPlayer:s.isPlayer})),
      message:this.message
    });
  }

  dispose() {
    this.disposed=true;
    this.renderer.setAnimationLoop(null);
    removeEventListener('keydown',this.handleKeyDown);
    removeEventListener('keyup',this.handleKeyUp);
    removeEventListener('resize',this.handleResize);
    this.renderer.domElement.removeEventListener('pointermove',this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown',this.handlePointerDown);
    removeEventListener('pointerup',this.handlePointerUp);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
