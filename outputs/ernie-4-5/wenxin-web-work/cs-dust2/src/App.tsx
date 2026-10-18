import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  WEAPONS, createGame, startRound, updateGame, moveEntity, fireWeapon, reload, switchWeapon,
  equipPrimary, tryPlant, tryDefuse, GameState, Entity, WeaponId
} from './game';

export default function App(){
  const mountRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState|null>(null);
  const [started, setStarted] = useState(false);
  const [hudTick, setHudTick] = useState(0); // force re-render
  const [scoped, setScoped] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(()=>{
    if (!started || !mountRef.current) return;
    const st = createGame();
    gameRef.current = st;
    st.audio.start();
    // pistol round first
    startRound(st, true);

    // ---- Three.js scene ----
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0xd8c090);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd8c090, 30, 100);
    const camera = new THREE.PerspectiveCamera(85, innerWidth/innerHeight, 0.05, 500);

    // lights
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.0);
    sun.position.set(30,60,20);
    sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xfff0d0,0x807050,0.5));

    // ground + sky
    scene.add(new THREE.AmbientLight(0xffffff,0.25));

    // Build geometry from boxes
    const boxMeshes: THREE.Mesh[] = [];
    const boxToMesh = new Map<any, THREE.Mesh>();
    st.boxes.forEach(b=>{
      const size = new THREE.Vector3().subVectors(b.max,b.min);
      if (size.y<0.05){
        // ground
        const geo = new THREE.PlaneGeometry(size.x,size.z);
        const mat = new THREE.MeshStandardMaterial({color:b.color,roughness:1});
        const m = new THREE.Mesh(geo,mat);
        m.rotation.x=-Math.PI/2;
        m.position.set((b.min.x+b.max.x)/2,b.max.y,(b.min.z+b.max.z)/2);
        m.receiveShadow=true;
        scene.add(m);
        boxMeshes.push(m);
      } else {
        const geo = new THREE.BoxGeometry(size.x,size.y,size.z);
        const mat = new THREE.MeshStandardMaterial({color:b.color,roughness:0.9});
        const m = new THREE.Mesh(geo,mat);
        m.position.set((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2);
        m.castShadow=true; m.receiveShadow=true;
        scene.add(m);
        boxMeshes.push(m);
      }
    });

    // Bomb sites markers (subtle)
    const makeMarker=(x:number,z:number,color:number)=>{
      const geo=new THREE.CircleGeometry(3,24);
      const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.2});
      const m=new THREE.Mesh(geo,mat); m.rotation.x=-Math.PI/2; m.position.set(x,0.02,z);
      scene.add(m);
    };
    makeMarker(39,8,0xff4040);
    makeMarker(6,8,0xff4040);

    // Characters (instances per side)
    const charGroup = new THREE.Group();
    scene.add(charGroup);
    const charMeshes = new Map<number, THREE.Group>();
    const tracerGroup = new THREE.Group();
    scene.add(tracerGroup);
    const viewModelGroup = new THREE.Group(); // first-person weapon
    scene.add(viewModelGroup);

    function buildCharacter(side:'CT'|'T'): THREE.Group {
      const g = new THREE.Group();
      const skin = side==='CT'?0xd8b088:0xa87040;
      const shirt = side==='CT'?0x3058a8:0xb09060;
      const pants = side==='CT'?0x20304a:0x4a3820;
      const matSkin = new THREE.MeshStandardMaterial({color:skin,roughness:0.8});
      const matShirt = new THREE.MeshStandardMaterial({color:shirt,roughness:0.9});
      const matPants = new THREE.MeshStandardMaterial({color:pants,roughness:0.9});
      const matHelmet = new THREE.MeshStandardMaterial({color:side==='CT'?0x406050:0x2a2018,roughness:0.6});
      // head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.35,0.32), matSkin);
      head.position.y=1.65; head.castShadow=true;
      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.2,0.38), matHelmet);
      helmet.position.y=1.75; helmet.castShadow=true;
      // torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.3), matShirt);
      torso.position.y=1.15; torso.castShadow=true;
      // arms
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.6,0.14), matShirt);
      armL.position.set(-0.32,1.2,0); armL.castShadow=true;
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.6,0.14), matShirt);
      armR.position.set(0.32,1.2,0); armR.castShadow=true;
      // legs
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.7,0.22), matPants);
      legL.position.set(-0.12,0.45,0); legL.castShadow=true;
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.7,0.22), matPants);
      legR.position.set(0.12,0.45,0); legR.castShadow=true;
      // weapon stub
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.12,0.5), new THREE.MeshStandardMaterial({color:0x202020,roughness:0.5,metalness:0.7}));
      gun.position.set(0.32,1.05,-0.1);
      gun.rotation.x=Math.PI/32;
      // C4 block on back
      const c4 = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.25,0.1), new THREE.MeshStandardMaterial({color:0x604020,roughness:0.8}));
      c4.position.set(0,1.3,0.18);
      c4.name='c4mesh';
      c4.visible=false;
      g.add(head,helmet,torso,armL,armR,legL,legR,gun,c4);
      return g;
    }
    function ensureCharMesh(e:Entity){
      let g = charMeshes.get(e.id);
      if (!g){
        g = buildCharacter(e.side);
        charMeshes.set(e.id,g);
        charGroup.add(g);
      }
      g.visible = e.alive;
      g.position.copy(e.pos);
      g.rotation.y = e.yaw;
      // c4 visibility
      const c4m = g.getObjectByName('c4mesh') as THREE.Mesh;
      if (c4m) c4m.visible = e.c4Carrier;
      // muzzle flash
      let flash = g.getObjectByName('flash') as THREE.Mesh;
      if (e.muzzleFlash>0){
        if (!flash){
          flash = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,8), new THREE.MeshBasicMaterial({color:0xfff0a0}));
          flash.name='flash';
          flash.position.set(0.32,1.05,-0.4);
          g.add(flash);
        }
        flash.visible=true;
      } else if (flash) flash.visible=false;
    }

    // View model (weapon in front of camera)
    function buildViewModel(wid:WeaponId): THREE.Group {
      const g = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({color:0x202020,metalness:0.8,roughness:0.35});
      const wood = new THREE.MeshStandardMaterial({color:0x4a2a18,roughness:0.8});
      const dark = new THREE.MeshStandardMaterial({color:0x101010,metalness:0.9,roughness:0.4});
      if (wid==='ak47'){
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.1,0.7), metal);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.12,0.25), wood);
        stock.position.z=0.35;
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.22,0.1), dark);
        mag.position.set(0,-0.15,-0.05); mag.rotation.x=0.15;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.3,12), dark);
        barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.45);
        g.add(body,stock,mag,barrel);
      } else if (wid==='m4a4'){
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.1,0.6), metal);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.1,0.25), dark);
        stock.position.z=0.3;
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.2,0.1), metal);
        mag.position.set(0,-0.14,-0.02);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.4,12), dark);
        barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.45);
        const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.05,0.12), dark);
        sight.position.set(0,0.08,0);
        g.add(body,stock,mag,barrel,sight);
      } else if (wid==='awp'){
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.1,0.9), dark);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.3,16), metal);
        scope.rotation.x=Math.PI/2; scope.position.set(0,0.08,-0.05);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.14,0.3), dark);
        stock.position.z=0.35;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.6,12), dark);
        barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.6);
        g.add(body,scope,stock,barrel);
      } else if (wid==='glock'||wid==='usp'||wid==='deagle'){
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.08,0.25), metal);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.12), dark);
        grip.position.set(0,-0.1,0.05);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.1,12), dark);
        barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.15);
        g.add(slide,grip,barrel);
      } else if (wid==='knife'){
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.02,0.3), metal);
        blade.position.set(0,-0.01,-0.15);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.12), wood);
        handle.position.z=0.05;
        g.add(blade,handle);
      }
      return g;
    }

    let vm: THREE.Group | null = null;
    function updateViewModel(){
      const p = st.entities.find(e=>e.id===st.playerId);
      const spectated = st.entities.find(e=>e.id===st.spectateId) || p;
      if (!spectated) return;
      if (spectated.isPlayer && p && p.alive){
        // first person view model
        const wid = p.weapons[p.curWeapon].w;
        if (!vm || vm.userData.wid!==wid){
          if (vm) viewModelGroup.remove(vm);
          vm = buildViewModel(wid);
          vm.userData.wid=wid;
          viewModelGroup.add(vm);
        }
        // place VM in lower right of camera
        vm.visible=true;
        vm.position.set(0.22,-0.22,-0.5);
        vm.rotation.set(0,0,0);
        // recoil offset
        if (p.fireCooldown>0){
          const k = p.fireCooldown/WEAPONS[wid].fireRate;
          vm.position.y -= 0.1*k;
          vm.rotation.x = 0.2*k;
        }
      } else {
        if (vm) vm.visible=false;
      }
    }

    // C4 mesh (planted)
    let bombMesh: THREE.Mesh|null=null;
    function updateBombMesh(){
      if (st.c4.planted && st.c4.pos){
        if (!bombMesh){
          bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.2,0.3), new THREE.MeshStandardMaterial({color:0x302020,roughness:0.8}));
          const blink = new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8), new THREE.MeshBasicMaterial({color:0xff0000}));
          blink.name='blink'; blink.position.set(0,0.12,0); bombMesh.add(blink);
          scene.add(bombMesh);
        }
        bombMesh.position.copy(st.c4.pos);
        bombMesh.position.y=0.15;
        const blink = bombMesh.getObjectByName('blink') as THREE.Mesh;
        if (blink) blink.visible = Math.floor(st.c4.timeLeft*4)%2===0;
      } else {
        if (bombMesh){ scene.remove(bombMesh); bombMesh=null; }
      }
    }

    // Tracers
    const tracers: THREE.Line[]=[];
    function updateTracers(){
      // clear old
      tracers.forEach(t=>{tracerGroup.remove(t);});
      tracers.length=0;
      st.projectiles.forEach(p=>{
        const from = p.from.clone();
        const to = p.from.clone().addScaledVector(p.dir,80);
        // shorten if hits wall
        const geo = new THREE.BufferGeometry().setFromPoints([from,to]);
        const mat = new THREE.LineBasicMaterial({color:0xffee88,transparent:true,opacity:0.6});
        const line = new THREE.Line(geo,mat);
        tracers.push(line);
        tracerGroup.add(line);
      });
    }

    // ---- Input ----
    const keys:Record<string,boolean> = {};
    const onKeyDown = (e:KeyboardEvent)=>{
      keys[e.code]=true;
      const p = st.entities.find(x=>x.id===st.playerId);
      if (!p || !p.alive) {
        if (e.code==='Space' && st.phase==='ended'){
          // next round
          const nextIsPistol = (st.round%2===0);
          st.round++;
          startRound(st, nextIsPistol);
        }
        return;
      }
      if (e.code==='KeyR') reload(p, st);
      if (e.code==='Digit1') switchWeapon(p, p.weapons.findIndex(x=>WEAPONS[x.w].slot==='primary'));
      if (e.code==='Digit2') switchWeapon(p, p.weapons.findIndex(x=>WEAPONS[x.w].slot==='secondary'));
      if (e.code==='Digit3') switchWeapon(p, p.weapons.findIndex(x=>WEAPONS[x.w].slot==='melee'));
      if (e.code==='KeyE'){
        // plant or defuse
        if (p.side==='T' && p.hasC4) tryPlant(st,p);
        if (p.side==='CT' && st.c4.planted) {/* continuous defuse in update */}
      }
    };
    const onKeyUp = (e:KeyboardEvent)=>{ keys[e.code]=false; };
    addEventListener('keydown',onKeyDown);
    addEventListener('keyup',onKeyUp);

    let mouseDown=false;
    const onMouseDown=(e:MouseEvent)=>{
      if (document.pointerLockElement!==renderer.domElement){
        renderer.domElement.requestPointerLock();
        return;
      }
      mouseDown=true;
      const p = st.entities.find(x=>x.id===st.playerId);
      if (!p||!p.alive) return;
      if (e.button===2){
        // right click scope (only for AWP)
        const w = p.weapons[p.curWeapon];
        if (w.w==='awp'){ setScoped(s=>!s); st.audio.scopeIn(); }
      } else {
        fireWeapon(st,p);
      }
    };
    const onMouseUp=()=>{mouseDown=false;};
    const onMouseMove=(e:MouseEvent)=>{
      if (document.pointerLockElement!==renderer.domElement) return;
      const p = st.entities.find(x=>x.id===st.playerId);
      if (!p||!p.alive) return;
      p.yaw -= e.movementX*0.0022;
      p.pitch -= e.movementY*0.0022;
      p.pitch = Math.max(-Math.PI/2+0.01,Math.min(Math.PI/2-0.01,p.pitch));
    };
    const onContext=(e:Event)=>e.preventDefault();
    renderer.domElement.addEventListener('mousedown',onMouseDown);
    addEventListener('mouseup',onMouseUp);
    addEventListener('mousemove',onMouseMove);
    renderer.domElement.addEventListener('contextmenu',onContext);

    const onResize=()=>{
      renderer.setSize(innerWidth,innerHeight);
      camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();
    };
    addEventListener('resize',onResize);

    // Damage flash
    const damageEl = document.createElement('div');
    damageEl.className='damage';
    mountRef.current.parentElement?.appendChild(damageEl);

    // ---- Loop ----
    let last = performance.now();
    let raf=0;
    const clock = new THREE.Clock();

    function loop(){
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(),0.05);
      const p = st.entities.find(x=>x.id===st.playerId);
      const spectated = st.entities.find(x=>x.id===st.spectateId) || p;

      if (p && p.alive){
        // movement input
        const speed = keys['ShiftLeft']?3:5;
        const fwd = new THREE.Vector3(-Math.sin(p.yaw),0,-Math.cos(p.yaw));
        const right = new THREE.Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw));
        const mv = new THREE.Vector3();
        if (keys['KeyW']) mv.add(fwd);
        if (keys['KeyS']) mv.sub(fwd);
        if (keys['KeyD']) mv.add(right);
        if (keys['KeyA']) mv.sub(right);
        if (mv.lengthSq()>0) mv.normalize().multiplyScalar(speed);
        moveEntity(st,p,mv,dt);
        if (keys['Space'] && p.onGround) p.vel.y=8;
        // defuse
        if (keys['KeyE'] && p.side==='CT' && st.c4.planted){
          tryDefuse(st,p);
        } else {
          st.c4.defusing=0;
        }
        // automatic fire
        if (mouseDown){
          const w = p.weapons[p.curWeapon];
          if (WEAPONS[w.w].automatic) fireWeapon(st,p);
        }
        // scope fov
        camera.fov = scoped ? 25 : 85;
        camera.updateProjectionMatrix();
      } else if (spectated){
        camera.fov=85; camera.updateProjectionMatrix();
      }

      updateGame(st,dt);

      // damage flash based on hp delta
      if (p){
        const dmg = (p as any)._lastHp ?? 100;
        if (p.hp < dmg){
          damageEl.style.opacity = '1';
          setTimeout(()=>damageEl.style.opacity='0',200);
        }
        (p as any)._lastHp = p.hp;
      }

      // render meshes
      st.entities.forEach(ensureCharMesh);
      updateBombMesh();
      updateTracers();
      updateViewModel();

      // Camera
      if (p && p.alive){
        camera.position.set(p.pos.x,p.pos.y+p.eye,p.pos.z);
        camera.rotation.order='YXZ';
        camera.rotation.set(p.pitch,p.yaw,0);
        if (vm){
          viewModelGroup.position.copy(camera.position);
          viewModelGroup.rotation.copy(camera.rotation);
        }
      } else if (spectated){
        // third-person chase cam
        const back = new THREE.Vector3(Math.sin(spectated.yaw)*4, 2.5, Math.cos(spectated.yaw)*4);
        const desired = new THREE.Vector3(spectated.pos.x+back.x, spectated.pos.y+spectated.eye+back.y, spectated.pos.z+back.z);
        camera.position.lerp(desired, 0.15);
        camera.lookAt(spectated.pos.x, spectated.pos.y+spectated.eye, spectated.pos.z);
        if (vm) vm.visible=false;
      }

      renderer.render(scene,camera);

      // draw minimap (every few frames)
      if (miniRef.current){
        const ctx = miniRef.current.getContext('2d')!;
        const W=200,H=200;
        if (miniRef.current.width!==W){miniRef.current.width=W;miniRef.current.height=H;}
        ctx.fillStyle='rgba(60,50,40,0.6)'; ctx.fillRect(0,0,W,H);
        const sx=W/44, sy=H/52;
        ctx.fillStyle='#a08050';
        st.boxes.forEach(b=>{
          if (b.max.y<0.5) return;
          ctx.fillRect(b.min.x*sx, b.min.z*sy, Math.max(1,(b.max.x-b.min.x)*sx), Math.max(1,(b.max.z-b.min.z)*sy));
        });
        // sites
        ctx.fillStyle='rgba(255,80,80,0.35)';
        ctx.fillRect(st.bombSiteA.min.x*sx, st.bombSiteA.min.z*sy, (st.bombSiteA.max.x-st.bombSiteA.min.x)*sx, (st.bombSiteA.max.z-st.bombSiteA.min.z)*sy);
        ctx.fillRect(st.bombSiteB.min.x*sx, st.bombSiteB.min.z*sy, (st.bombSiteB.max.x-st.bombSiteB.min.x)*sx, (st.bombSiteB.max.z-st.bombSiteB.min.z)*sy);
        // entities
        st.entities.forEach(e=>{
          if (!e.alive) return;
          if (e.side==='CT') ctx.fillStyle='#5ab0ff';
          else ctx.fillStyle='#e0a050';
          if (e.id===st.playerId) ctx.fillStyle='#ffffff';
          ctx.beginPath(); ctx.arc(e.pos.x*sx,e.pos.z*sy,3,0,Math.PI*2); ctx.fill();
        });
        if (st.c4.planted && st.c4.pos){
          ctx.fillStyle='#ff2020';
          ctx.beginPath(); ctx.arc(st.c4.pos.x*sx, st.c4.pos.z*sy, 4, 0, Math.PI*2); ctx.fill();
        }
      }

      setHudTick(t=>t+1);
      if (st.phase==='ended' && !msg){
        setMsg(st.winner==='CT'?'CT 胜利!':'T 胜利!');
        setTimeout(()=>{setMsg(null);},3000);
      }
    }
    loop();

    return ()=>{
      cancelAnimationFrame(raf);
      removeEventListener('keydown',onKeyDown);
      removeEventListener('keyup',onKeyUp);
      removeEventListener('mouseup',onMouseUp);
      removeEventListener('mousemove',onMouseMove);
      removeEventListener('resize',onResize);
      if (damageEl.parentElement) damageEl.parentElement.removeChild(damageEl);
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    };
  }, [started]);

  const st = gameRef.current;
  const player = st?.entities.find(e=>e.id===st.playerId);
  const spectated = st?.entities.find(e=>e.id===st.spectateId) || player;
  const curW = player && player.alive ? player.weapons[player.curWeapon] : null;
  const curWDef = curW ? WEAPONS[curW.w] : null;
  const hpPct = player?Math.max(0,player.hp):0;
  const arPct = player?Math.max(0,player.armor):0;
  const hpBars = Array.from({length:10},(_,i)=>(i+1)*10<=hpPct);
  const arBars = Array.from({length:10},(_,i)=>(i+1)*10<=arPct);
  const bombPlanted = st?.c4.planted;
  const bombTime = st?.c4.timeLeft ?? 0;
  const recentKills = st?.kills.slice(-5).reverse() ?? [];
  const tAlive = st?.entities.filter(e=>e.alive&&e.side==='T').length ?? 0;
  const ctAlive = st?.entities.filter(e=>e.alive&&e.side==='CT').length ?? 0;
  const roundSecs = Math.max(0,Math.ceil(st?.roundTime??0));
  const isDead = player && !player.alive;

  return (
    <>
      <div ref={mountRef} style={{width:'100%',height:'100%',position:'fixed',inset:0}}/>
      {started && (
        <div className="hud">
          <div className={`cross ${scoped?'scoped':''}`}></div>
          <div className={`scope ${scoped?'show':''}`}><div className="ring"><div className="dot"/></div></div>
          <div className="topbar">
            <span className="ct">CT <span className="score">{st?.scoreCT??0}</span></span>
            <span className="timer">{Math.floor(roundSecs/60)}:{String(roundSecs%60).padStart(2,'0')}</span>
            <span className="t"><span className="score">{st?.scoreT??0}</span> T</span>
            <span className="round">第 {st?.round??1} 回合 · CT {ctAlive} : {tAlive} T</span>
          </div>
          <div className="killfeed">
            {recentKills.map((k,i)=>{
              const killer = st?.entities.find(e=>e.id===k.killer);
              const victim = st?.entities.find(e=>e.id===k.victim);
              return (
                <div key={i} className={`item ${killer?.side==='CT'?'ct-side':''}`}>
                  <span style={{color:killer?.side==='CT'?'#5ab0ff':'#e0a050'}}>{killer?.isPlayer?'你':(killer?.side==='CT'?'CT':'T')}</span>
                  <span style={{color:k.headshot?'#ffd060':'#fff'}}>{k.weapon}</span>
                  <span style={{color:victim?.side==='CT'?'#5ab0ff':'#e0a050'}}>{victim?.isPlayer?'你':(victim?.side==='CT'?'CT':'T')}</span>
                </div>
              );
            })}
          </div>
          <div className="minimap"><canvas ref={miniRef}/></div>
          <div className="bottom">
            <div className="hp">{hpBars.map((on,i)=><span key={i} className={on?'on':''}/>)}</div>
            <div className="armor">{arBars.map((on,i)=><span key={i} className={on?'on':''}/>)}</div>
            {curW && curWDef && (
              <>
                <div className="ammo">{curW.ammo} <small>/ {curW.reserve}</small></div>
                <div className="weapon">{curWDef.name}{player?.reloading>0?' · 换弹中...':''}</div>
              </>
            )}
            {player?.hasC4 && <div className="weapon" style={{color:'#ff6040'}}>★ 持有 C4 (E 下包)</div>}
            {bombPlanted && <div className="weapon" style={{color:'#ff4040'}}>⚠ C4 已安放 · {bombTime.toFixed(1)}s</div>}
          </div>
          <div className="money">$ 800</div>
          <div className={`bomb-indicator ${bombPlanted?'show':''}`}>C4 {bombTime.toFixed(1)}s</div>
          <div className={`death ${isDead?'show':''}`}>你已阵亡</div>
          <div className={`spectate-hint ${isDead?'show':''}`}>观察队友中 · 空格开始下一回合</div>
        </div>
      )}
      {!started && (
        <div className="overlay" onClick={()=>setStarted(true)}>
          <h1>DUST2 5v5</h1>
          <p>WASD 移动 · 空格跳跃 · 左键射击 · 右键开镜(AWP) · R 换弹 · 1/2/3 切换武器 · E 下包/拆弹</p>
          <p className="tip">点击开始游戏</p>
        </div>
      )}
      {msg && (
        <div className="overlay" style={{pointerEvents:'none'}}>
          <h1 className={msg.startsWith('CT')?'ct':''}>{msg}</h1>
          <p>按 空格 开始下一回合</p>
        </div>
      )}
    </>
  );
}
