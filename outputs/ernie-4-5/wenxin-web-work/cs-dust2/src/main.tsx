import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';

const CSGame: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(30);
  const [score, setScore] = useState({ ct: 0, t: 0 });
  const [roundTime, setRoundTime] = useState(120);
  const [showMsg, setShowMsg] = useState('点击开始 按Shift前进');
  const [team, setTeam] = useState<'CT'|'T'>('CT');

  useEffect(() => {
    if (!container.current) return;
    const c = container.current;
    const W = c.clientWidth, H = c.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87a0b8);
    scene.fog = new THREE.Fog(0x7a8ca3, 10, 80);

    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    c.appendChild(renderer.domElement);

    const sun = new THREE.DirectionalLight(0xfff0c8, 1.8);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xa0b8d8, 0.5));

    // ========== Dust2 Map ==========
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);

    // Texture-like procedural colors
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xd4b888 });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc2b298 });
    const darkWall = new THREE.MeshLambertMaterial({ color: 0x7a6858 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.7, roughness: 0.4 });
    const skyWallMat = new THREE.MeshLambertMaterial({ color: 0x3a4060 });

    function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y * 0.5, z);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.collider = { w, h, d };
      mapGroup.add(m);
    }

    // Global ground (big)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floor = new THREE.Mesh(floorGeo, sandMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // CT spawn area (west)
    box(18, 4, 30, -32, 2, 0, wallMat); // west wall of CT spawn
    box(3, 4, 18, -22, 2, 0, wallMat); // mid divider
    // T spawn area (east)
    box(18, 4, 30, 32, 2, 0, wallMat);
    box(3, 4, 18, 22, 2, 0, wallMat);
    // Long A (north corridor)
    box(3, 4, 50, 0, 2, 35, wallMat); // north wall long A
    box(3, 4, 50, 0, 2, 15, wallMat); // south wall long A
    // A platform high wall
    box(16, 4, 6, -18, 2, 30, wallMat);
    box(16, 4, 6, 18, 2, 30, wallMat);
    // B tunnel (south corridor)
    box(50, 4, 3, 0, 2, -35, darkWall); // south outer wall
    box(10, 4, 12, -15, 2, -35, metalMat); // B door
    // Mid doors
    box(3, 4, 12, 0, 2, 0, skyWallMat);
    // Catwalk ramp to B
    for(let i=0;i<4;i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 6), darkWall);
      s.position.set(-15+i*3, 0.3+i*0.3, -20+i*3);
      s.rotation.z = -0.15;
      s.receiveShadow = true;
      mapGroup.add(s);
    }
    // Crates (classic orange/wood)
    function crate(sx: number, sz: number, h: number, c: number) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), new THREE.MeshLambertMaterial({ color: c }));
      m.position.set(sx, h*0.5, sz);
      m.castShadow = true; m.receiveShadow = true;
      mapGroup.add(m);
    }
    crate(-12, 22, 1.8, 0xd46030); crate(-10, 24, 0.9, 0x6b4220);
    crate(-8, 20, 1.8, 0x985028); crate(12, 22, 1.8, 0xd46030);
    crate(-15, -22, 1.8, 0x6b4220); crate(-17, -20, 0.9, 0xd46030);

    // ========== Player ==========
    const keys = new Set<string>();
    const playerPos = new THREE.Vector3(team==='CT'?-28:28, 1.8, 0);
    const yaw = { v: team==='CT'?Math.PI:0 }, pitch = { v:0 };
    const vel = new THREE.Vector3();
    let locked = false;

    const speed = 5.5;
    addEventListener('keydown', e=>keys.add(e.code));
    addEventListener('keyup', e=>keys.delete(e.code));

    const pointerLock = () => {
      renderer.domElement.requestPointerLock?.();
    };
    renderer.domElement.addEventListener('click', pointerLock);
    document.addEventListener('pointerlockchange', ()=>{
      locked = document.pointerLockElement === renderer.domElement;
      if(locked) setShowMsg('');
    });
    document.addEventListener('mousemove', e=>{
      if(!locked) return;
      yaw.v -= e.movementX * 0.002;
      pitch.v -= e.movementY * 0.002;
      pitch.v = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, pitch.v));
    });

    // ========== Weapon (AK47 procedural) ==========
    const gun = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.85,16), new THREE.MeshLambertMaterial({color:0x1a1a1a}));
    bar.rotation.z = -Math.PI/2; bar.position.x = 0.5; gun.add(bar);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.08,0.12), new THREE.MeshLambertMaterial({color:0x7a4920}));
    body.position.x = 0.1; gun.add(body);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.3,0.06), new THREE.MeshLambertMaterial({color:0x1a1a1a}));
    mag.rotation.z = -0.25; mag.position.set(-0.05,-0.15,0); gun.add(mag);
    gun.position.set(0.3,-0.3,-0.4);
    camera.add(gun); scene.add(camera);

    // ========== Sound (Web Audio) ==========
    const audioCtx = new AudioContext();
    function shootSound(){
      if(audioCtx.state==='suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type='sawtooth'; o.frequency.setValueAtTime(220, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime+0.1);
      g.gain.setValueAtTime(0.25, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.2);
      o.start(); o.stop(audioCtx.currentTime+0.2);
    }
    function stepSound(){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type='square'; o.frequency.value=80;
      g.gain.setValueAtTime(0.05, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.05);
      o.start(); o.stop(audioCtx.currentTime+0.05);
    }

    // Raycast shoot
    const rc = new THREE.Raycaster();
    const aiBots: {p:THREE.Vector3}[] = [{p: new THREE.Vector3(-25,1,5)},{p: new THREE.Vector3(-25,1,-5)},{p: new THREE.Vector3(25,1,5)},{p: new THREE.Vector3(25,1,-5)}];
    aiBots.forEach(b=>{
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3,1.2,8,16), new THREE.MeshLambertMaterial({color: Math.random()>0.5?0x3070c0:0xc03030}));
      m.position.copy(b.p); m.castShadow=true; scene.add(m); b.p = m.position; (b as any).mesh=m;
    });

    renderer.domElement.addEventListener('mousedown', ()=>{
      if(!locked || ammo<=0) return;
      shootSound();
      gun.position.z+=0.12;
      rc.setFromCamera(new THREE.Vector2(0,0), camera);
      const hits = rc.intersectObjects(scene.children, false);
      for(const h of hits){
        for(const ai of aiBots){
          const d = h.point.distanceTo(ai.p);
          if(d<0.8){
            setHealth(prev=>Math.max(0, prev-15));
            break;
          }
        }
      }
      setAmmo(prev=>prev-1);
      setTimeout(()=>{gun.position.z=-0.4;}, 60);
    });

    // Animation loop
    let last = 0, stepTimer=0;
    const animate = (t: number)=>{
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, (t-last)/1000||0.016); last=t;

      const fwd = new THREE.Vector3(-Math.sin(yaw.v), 0, -Math.cos(yaw.v));
      const rt = new THREE.Vector3(Math.cos(yaw.v), 0, -Math.sin(yaw.v));
      const sp = keys.has('ShiftLeft')? speed*1.8 : speed;
      vel.set(0,0,0);
      if(keys.has('KeyW')) vel.add(fwd); if(keys.has('KeyS')) vel.sub(fwd);
      if(keys.has('KeyD')) vel.add(rt); if(keys.has('KeyA')) vel.sub(rt);
      if(vel.length()>0.01) vel.normalize().multiplyScalar(sp);
      playerPos.x += vel.x * dt;
      playerPos.z += vel.z * dt;
      playerPos.x = THREE.MathUtils.clamp(playerPos.x, -48, 48);
      playerPos.z = THREE.MathUtils.clamp(playerPos.z, -48, 48);

      stepTimer += dt;
      if(vel.length()>0.1 && stepTimer>0.32){stepSound(); stepTimer=0;}

      camera.position.copy(playerPos);
      camera.rotation.order='YXZ';
      camera.rotation.y = yaw.v;
      camera.rotation.x = pitch.v;

      renderer.render(scene, camera);
    };
    requestAnimationFrame(animate);

    return ()=>{c.removeChild(renderer.domElement);};
  }, []);

  return (
    <div style={{width:'100%',height:'100vh',background:'#000',position:'relative',overflow:'hidden'}}>
      <div ref={container} style={{width:'100%',height:'100%'}}/>
      <div style={{position:'fixed',left:'20px',top:'20px',color:'#fff',fontFamily:'monospace',fontSize:'14px',textShadow:'0 0 3px #000'}}>
        <div><span style={{color:'#ff3030'}}>❤ HP</span> {health}</div>
        <div><span style={{color:'#ffd030'}}>弾</span> {ammo}/30</div>
      </div>
      <div style={{position:'fixed',top:'20px',right:'20px',color:'#fff',fontFamily:'monospace',fontSize:'14px'}}>
        CT {score.ct} : {score.t} T
      </div>
      <div style={{position:'fixed',left:'50%',top:'50%',width:'20px',height:'20px',margin:'-10px 0 0 -10px',pointerEvents:'none'}}>
        <div style={{position:'absolute',left:'9px',top:0,width:'2px',height:'20px',background:'#fff'}}/>
        <div style={{position:'absolute',top:'9px',left:0,width:'20px',height:'2px',background:'#fff'}}/>
      </div>
      <div style={{position:'fixed',bottom:'12px',left:'50%',transform:'translateX(-50%)',color:'#fff',fontSize:'12px',opacity:0.6}}>{showMsg}</div>
    </div>
  );
};

export default CSGame;


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CSGame />
  </React.StrictMode>
);
