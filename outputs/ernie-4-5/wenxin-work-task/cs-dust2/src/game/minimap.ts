import { MapData } from './map';
import { HUDSnapshot } from './types';

// Draw a top-down 2D minimap on a canvas.
export function drawMinimap(
  canvas: HTMLCanvasElement,
  map: MapData,
  data: HUDSnapshot
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  // background
  ctx.fillStyle = 'rgba(20,30,20,0.75)';
  ctx.fillRect(0, 0, w, h);

  const worldW = 60;
  const worldD = 40;
  const sx = w / worldW;
  const sz = h / worldD;
  const toX = (x: number) => x * sx;
  const toZ = (z: number) => z * sz;

  // Draw walls
  ctx.fillStyle = 'rgba(150,120,80,0.8)';
  for (const wall of map.walls) {
    ctx.fillRect(
      toX(wall.x - wall.w / 2),
      toZ(wall.z - wall.d / 2),
      wall.w * sx,
      wall.d * sz
    );
  }
  ctx.fillStyle = 'rgba(120,120,120,0.6)';
  for (const c of map.crates) {
    ctx.fillRect(
      toX(c.x - c.w / 2),
      toZ(c.z - c.d / 2),
      c.w * sx,
      c.d * sz
    );
  }

  // Bomb sites
  ctx.strokeStyle = 'rgba(255,80,80,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(toX(map.aSiteCenter.x - 4), toZ(map.aSiteCenter.z - 4), 8 * sx, 8 * sz);
  ctx.strokeStyle = 'rgba(80,120,255,0.8)';
  ctx.strokeRect(toX(map.bSiteCenter.x - 4), toZ(map.bSiteCenter.z - 4), 8 * sx, 8 * sz);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('A', toX(map.aSiteCenter.x) - 3, toZ(map.aSiteCenter.z) + 3);
  ctx.fillText('B', toX(map.bSiteCenter.x) - 3, toZ(map.bSiteCenter.z) + 3);

  // Bomb
  if (data.bombPos) {
    ctx.fillStyle = '#ff3';
    ctx.beginPath();
    ctx.arc(toX(data.bombPos.x), toZ(data.bombPos.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Players
  for (const p of data.playerPositions) {
    if (!p.alive) continue;
    ctx.fillStyle = p.team === 'T' ? '#d4a855' : '#4a7fd4';
    ctx.beginPath();
    ctx.arc(toX(p.x), toZ(p.z), p.isLocal ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (p.isBombCarrier) {
      ctx.fillStyle = '#ff3';
      ctx.fillRect(toX(p.x) - 1, toZ(p.z) - 6, 2, 2);
    }
  }
}
