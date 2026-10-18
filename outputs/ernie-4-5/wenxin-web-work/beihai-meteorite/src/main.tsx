import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';

type Shot = { t:number; x:number; cap:string; sub:string };

const SHOTS: Shot[] = [
  {t:0,  x:0,  cap:'章北海 · 陨石子弹', sub:'MYTHOS BENCH - 改编自《三体》片段'},
  {t:6,  x:1,  cap:'太空军 · 唐号航母', sub:'距离自然选择号起航还有数月'},
  {t:14, x:2,  cap:'清晨 03:42',          sub:'航天城 · 地下车库'},
  {t:22, x:3,  cap:'他取出三块陨石',     sub:'铁陨石，来自小行星带'},
  {t:30, x:4,  cap:'每一颗都被加工成子弹', sub:'在车床下静静旋转'},
  {t:38, x:5,  cap:'陨石与火药混在一起',  sub:'没有序列号，没有来源'},
  {t:46, x:6,  cap:'自然选择号 · 前进四', sub:'章北海扣下扳机'},
  {t:54, x:7,  cap:'三发陨石子弹',        sub:'在无重力的通道中划出红光'},
  {t:62, x:8,  cap:'老航天倒下了',        sub:'在那之前他们没有看到凶手'},
  {t:70, x:9,  cap:'"没关系，都一样的"', sub:'——未来史学派'},
  {t:78, x:10, cap:'他望向深空',         sub:'星辰大海，才是归宿'},
];
const TOTAL = 90;

const Film: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cap, setCap] = useState(SHOTS[0].cap);
  const [sub, setSub] = useState(SHOTS[0].sub);
  const [t, setT] = useState(0);

  useEffect(()=>{
    if(!containerRef.current) return;
    const c = containerRef.current;
    const W=c.clientWidth, H=c.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x05060a, 0.018);
    const camera = new THREE.PerspectiveCamera(60, W/H, 0.1, 500);
    camera.position.set(0,4,14);
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(W,H);
    c.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0x223050, 0.6));
    const key = new THREE.DirectionalLight(0x88aaff, 1.4);
    key.position.set(-8,10,6); scene.add(key);
    const warm = new THREE.PointLight(0xff8844, 1.6, 20);
    warm.position.set(0,2,-4); scene.add(warm);
    const red = new THREE.PointLight(0xff2244, 0.8, 30);
    red.position.set(0,0,-20); scene.add(red);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(3000);
    for(let i=0;i<1000;i++){
      const r=150+Math.random()*50, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
      pts[i*3]=r*Math.sin(ph)*Math.cos(th);
      pts[i*3+1]=r*Math.cos(ph);
      pts[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pts,3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color:0xffffff,size:0.3,transparent:true,opacity:0.9}));
    scene.add(stars);

    // Voxel character (Zhang Beihai) - block person
    function makeVoxelMan(color:number, suitCol:number) {
      const g = new THREE.Group();
      // head
      const head = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshLambertMaterial({color:0xf4cfa0}));
      head.position.y=2.6; g.add(head);
      // helmet
      const helm = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.3,1.1), new THREE.MeshLambertMaterial({color:suitCol}));
      helm.position.y=3.1; g.add(helm);
      // eyes
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.08,0.02), new THREE.MeshBasicMaterial({color:0x000000}));
      eye.position.set(-0.25,2.65,0.51); g.add(eye);
      const eye2 = eye.clone(); eye2.position.x=0.25; g.add(eye2);
      // body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2,1.6,0.7), new THREE.MeshLambertMaterial({color:suitCol}));
      body.position.y=1.3; g.add(body);
      // arms
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4,1.4,0.4), new THREE.MeshLambertMaterial({color:suitCol}));
      arm.position.set(-0.8,1.4,0); g.add(arm);
      const arm2 = arm.clone(); arm2.position.x=0.8; g.add(arm2);
      // legs
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5,1.2,0.5), new THREE.MeshLambertMaterial({color:0x222233}));
      leg.position.set(-0.3,0,0); g.add(leg);
      const leg2 = leg.clone(); leg2.position.x=0.3; g.add(leg2);
      // red star / badge
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.05), new THREE.MeshBasicMaterial({color:0xd02020}));
      badge.position.set(0,1.7,0.38); g.add(badge);
      return g;
    }
    const zhang = makeVoxelMan(0xf4cfa0,0x3a4a6a);
    zhang.position.set(-3,0,3); scene.add(zhang);

    // Carrier (Tang 唐号) - blocky on left
    const carrier = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(12,0.5,3), new THREE.MeshLambertMaterial({color:0x4a525a}));
    carrier.add(deck);
    const island = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,1.5), new THREE.MeshLambertMaterial({color:0x333a40}));
    island.position.set(-4,1,0); carrier.add(island);
    for(let i=0;i<3;i++){const jet=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.2,0.8), new THREE.MeshLambertMaterial({color:0x202530}));
      jet.position.set(-2+i*2,0.4,0); carrier.add(jet);}
    carrier.position.set(-8,-0.25,-20); carrier.rotation.y=0.4;
    scene.add(carrier);

    // Underground garage floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(60,0.3,60), new THREE.MeshLambertMaterial({color:0x2a2a30}));
    floor.position.y=-0.15; scene.add(floor);
    for(let i=0;i<20;i++){
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.02,60), new THREE.MeshBasicMaterial({color:0x505050}));
      line.position.set(-30+i*3,0.001,0); scene.add(line);
    }
    // Pillars
    for(let i=0;i<8;i++){
      const p=new THREE.Mesh(new THREE.BoxGeometry(0.8,5,0.8),new THREE.MeshLambertMaterial({color:0x3a3a40}));
      p.position.set(-12+i*4,2.5,-15+((i%2)*20)); scene.add(p);
    }

    // Meteorites (3 blocks)
    const meteors: THREE.Mesh[]=[];
    for(let i=0;i<3;i++){
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3+i*0.08,0), new THREE.MeshStandardMaterial({color:0x604a3a,metalness:0.3,roughness:0.8,emissive:0x332211,emissiveIntensity:0.3}));
      m.position.set(-4+i*0.5, 1.5+Math.sin(i)*0.1, 4+i*0.3); m.userData.basePos=m.position.clone();
      scene.add(m); meteors.push(m);
    }
    // Gun
    const gun = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.2,0.2), new THREE.MeshLambertMaterial({color:0x202020}));
    gun.position.set(-2,1.6,3.5); gun.rotation.y=0.4; scene.add(gun);

    // Bullet trails (Lines)
    const trailMat = new THREE.LineBasicMaterial({color:0xff4422,transparent:true,opacity:0.8});
    const trails: THREE.Line[]=[];
    function spawnTrail(from:THREE.Vector3, to:THREE.Vector3){
      const g = new THREE.BufferGeometry().setFromPoints([from,to]);
      const l = new THREE.Line(g, trailMat);
      scene.add(l); trails.push(l);
      setTimeout(()=>{scene.remove(l);}, 900);
    }

    // Targets (other astronauts fallen)
    const victims: THREE.Group[]=[];
    for(let i=0;i<3;i++){
      const v = makeVoxelMan(0xf4cfa0, 0x8088a0);
      v.position.set(6+i*2, 0, -8+i*2); v.rotation.y=Math.PI;
      scene.add(v); victims.push(v);
    }

    // Timeline controller
    let startTime = performance.now();
    let running = true;
    let lastShot=0;

    const clock = new THREE.Clock();
    function animate(){
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = (performance.now()-startTime)/1000;
      setT(elapsed);
      if(elapsed>=TOTAL){if(running){running=false;}}

      // Shot subtitle update
      let cur=SHOTS[0];
      for(const s of SHOTS) if(elapsed>=s.t) cur=s;
      setCap(cur.cap); setSub(cur.sub);

      // Camera path (slow dolly + orbit)
      const k = elapsed/TOTAL;
      camera.position.x = Math.sin(elapsed*0.08)*6 + (k*2);
      camera.position.y = 3 + Math.sin(elapsed*0.2)*0.8;
      camera.position.z = 12 - k*18;
      const look = new THREE.Vector3(k*4,1.5,-k*12);
      camera.lookAt(look);

      // Meteor rotation
      meteors.forEach((m,i)=>{
        m.rotation.x += 0.005+i*0.002;
        m.rotation.y += 0.008-i*0.002;
        // Bullets fly at t=46..54
        if(elapsed>46 && elapsed<56 && i===0){
          const f = (elapsed-46)/10;
          m.position.lerpVectors(m.userData.basePos, new THREE.Vector3(7+i*0.6, 1.5, -7+i*2), f);
        }
      });
      // Bullet trails
      if(elapsed>46 && elapsed<47 && lastShot<46.2){
        meteors.forEach((m,i)=>spawnTrail(new THREE.Vector3(-1,1.6,3.5), new THREE.Vector3(7+i*0.6,1.5,-7+i*2)));
        lastShot=47;
      }
      // Victims fall
      if(elapsed>60){
        victims.forEach((v,i)=>{
          v.rotation.z = THREE.MathUtils.lerp(v.rotation.z, Math.PI/2, 0.02);
          v.position.y = Math.max(-0.2, v.position.y-dt*0.5);
        });
      }
      // Stars slow rotation
      stars.rotation.y += dt*0.01;
      // Warm light flicker
      warm.intensity = 1.4 + Math.sin(elapsed*3)*0.2;

      renderer.render(scene,camera);
    }
    animate();

    const onResize=()=>{camera.aspect=c.clientWidth/c.clientHeight;camera.updateProjectionMatrix();renderer.setSize(c.clientWidth,c.clientHeight);};
    addEventListener('resize',onResize);
    return ()=>{c.removeChild(renderer.domElement);removeEventListener('resize',onResize);};
  },[]);

  return (
    <div style={{width:'100%',height:'100vh',background:'#000',position:'relative',overflow:'hidden',fontFamily:'-apple-system,"PingFang SC",sans-serif'}}>
      <div ref={containerRef} style={{width:'100%',height:'100%'}}/>
      <div style={{position:'fixed',top:'60%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',color:'#fff',textShadow:'0 2px 12px rgba(0,0,0,0.9)',pointerEvents:'none'}}>
        <div style={{fontSize:36,letterSpacing:8,fontWeight:300,marginBottom:14}}>{cap}</div>
        <div style={{fontSize:14,letterSpacing:3,opacity:0.75}}>{sub}</div>
      </div>
      <div style={{position:'fixed',bottom:20,left:20,color:'#fff',fontSize:11,opacity:0.6,fontFamily:'monospace'}}>
        {Math.floor(t)}s / {TOTAL}s · 体素短篇 · 非官方改编
      </div>
      <div style={{position:'fixed',top:20,right:20,color:'#fff',fontSize:11,opacity:0.6,fontFamily:'monospace'}}>
        BEIHAI · METEORITE
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Film />
  </React.StrictMode>
);
