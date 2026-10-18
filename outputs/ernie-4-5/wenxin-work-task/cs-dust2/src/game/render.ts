import * as THREE from 'three';

export interface SceneAssets {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  wallMaterial: THREE.MeshLambertMaterial;
  groundMaterial: THREE.MeshLambertMaterial;
  metalCrateMaterial: THREE.MeshLambertMaterial;
  woodCrateMaterial: THREE.MeshLambertMaterial;
  doorMaterial: THREE.MeshLambertMaterial;
  skyMaterial: THREE.MeshBasicMaterial;
  gunMaterials: {
    ak: THREE.MeshLambertMaterial;
    m4: THREE.MeshLambertMaterial;
    awp: THREE.MeshLambertMaterial;
    pistol: THREE.MeshLambertMaterial;
    deagle: THREE.MeshLambertMaterial;
    knife: THREE.MeshLambertMaterial;
  };
}

function makeSandTexture(): THREE.CanvasTexture {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  // base sand color
  ctx.fillStyle = '#d9b382';
  ctx.fillRect(0, 0, size, size);
  // noise
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n));
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n * 0.8));
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n * 0.6));
  }
  ctx.putImageData(img, 0, 0);
  // Some darker splotches
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(120,90,60,${0.08 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 3 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 14);
  return tex;
}

function makeWoodTexture(): THREE.CanvasTexture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 4) {
    ctx.strokeStyle = `rgba(60,35,15,${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(0, i + Math.random() * 2);
    ctx.lineTo(size, i + Math.random() * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function makeMetalTexture(): THREE.CanvasTexture {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#4a5056';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = `rgba(100,110,120,${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

export function initRenderer(container: HTMLElement): SceneAssets {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec9e6);
  scene.fog = new THREE.Fog(0xc9ddec, 60, 150);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 500);
  camera.position.set(0, 1.6, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  // Sky dome - gradient using a large inverted sphere
  const skyGeo = new THREE.SphereGeometry(200, 16, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x4a90d9) },
      bottomColor: { value: new THREE.Color(0xd9e7f2) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position,1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h,0.0)),1.0);
      }`,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Lighting
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  const sandTex = makeSandTexture();
  const woodTex = makeWoodTexture();
  const metalTex = makeMetalTexture();

  const wallMaterial = new THREE.MeshLambertMaterial({ map: sandTex, color: 0xd9b382 });
  const groundMaterial = new THREE.MeshLambertMaterial({ map: sandTex });
  const metalCrateMaterial = new THREE.MeshLambertMaterial({ map: metalTex, color: 0x7a8088 });
  const woodCrateMaterial = new THREE.MeshLambertMaterial({ map: woodTex, color: 0xa06838 });
  const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });

  const gunMaterials = {
    ak: new THREE.MeshLambertMaterial({ color: 0x3a2a1a }),
    m4: new THREE.MeshLambertMaterial({ color: 0x222222 }),
    awp: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    pistol: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
    deagle: new THREE.MeshLambertMaterial({ color: 0x4a4a4a }),
    knife: new THREE.MeshLambertMaterial({ color: 0xcccccc }),
  };

  return {
    scene,
    camera,
    renderer,
    wallMaterial,
    groundMaterial,
    metalCrateMaterial,
    woodCrateMaterial,
    doorMaterial,
    skyMaterial: skyMat as any,
    gunMaterials,
  };
}

// Build first-person gun model attached to camera
export function buildGunModel(
  weaponId: string,
  gunMats: SceneAssets['gunMaterials']
): THREE.Group {
  const g = new THREE.Group();
  if (weaponId === 'ak47') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), gunMats.ak);
    body.position.set(0, -0.05, -0.25);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), gunMats.ak);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.02, -0.5);
    g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.08), gunMats.ak);
    mag.position.set(0, -0.15, -0.2);
    g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.2), gunMats.ak);
    stock.position.set(0, -0.04, -0.02);
    g.add(stock);
  } else if (weaponId === 'm4a4') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.5), gunMats.m4);
    body.position.set(0, -0.05, -0.25);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), gunMats.m4);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.02, -0.52);
    g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), gunMats.m4);
    mag.position.set(0, -0.14, -0.2);
    g.add(mag);
  } else if (weaponId === 'awp') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.7), gunMats.awp);
    body.position.set(0, -0.05, -0.35);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), gunMats.awp);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.02, -0.65);
    g.add(barrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), gunMats.awp);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.02, -0.3);
    g.add(scope);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.25), gunMats.awp);
    stock.position.set(0, -0.04, -0.02);
    g.add(stock);
  } else if (weaponId === 'glock' || weaponId === 'usp') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.2), gunMats.pistol);
    body.position.set(0, -0.08, -0.15);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), gunMats.pistol);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.06, -0.25);
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), gunMats.pistol);
    grip.position.set(0, -0.16, -0.12);
    g.add(grip);
  } else if (weaponId === 'deagle') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.24), gunMats.deagle);
    body.position.set(0, -0.08, -0.17);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), gunMats.deagle);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.05, -0.28);
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), gunMats.deagle);
    grip.position.set(0, -0.17, -0.13);
    g.add(grip);
  } else if (weaponId === 'knife') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.25), gunMats.knife);
    blade.position.set(0, -0.05, -0.2);
    g.add(blade);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), gunMats.ak);
    handle.position.set(0, -0.05, -0.05);
    g.add(handle);
  }
  return g;
}
