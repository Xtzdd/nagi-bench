import { useEffect, useRef } from 'react';
import { CELL, GRID, GRID_H, GRID_W, Cell, DOORS, AREAS, areaCenterWorld } from '../game/layout';
import type { HudState } from '../engine/types';

const SIZE = 208;

/** 静态地图层只画一次，之后每帧叠加实时点位。 */
function drawBase(ctx: CanvasRenderingContext2D): void {
  const s = SIZE / (GRID_W * CELL);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#141a22';
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const c = GRID[gx + gy * GRID_W];
      if (c === Cell.Wall) continue;
      ctx.fillStyle = c === Cell.Crate ? 'rgba(180,140,80,0.55)' : 'rgba(150,180,205,0.22)';
      ctx.fillRect(gx * CELL * s, gy * CELL * s, CELL * s, CELL * s);
    }
  }

  // 包点
  ctx.lineWidth = 1.2;
  for (const [name, color] of [
    ['aSite', 'rgba(226,88,58,0.85)'],
    ['bSite', 'rgba(226,88,58,0.85)']
  ] as const) {
    const r = AREAS[name];
    ctx.strokeStyle = color;
    ctx.strokeRect(r.x0 * CELL * s, r.y0 * CELL * s, (r.x1 - r.x0) * CELL * s, (r.y1 - r.y0) * CELL * s);
    const c = areaCenterWorld(r);
    ctx.fillStyle = color;
    ctx.font = `bold ${10}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(name === 'aSite' ? 'A' : 'B', c.x * s, c.z * s + 3);
  }

  // 中门
  ctx.strokeStyle = 'rgba(255,210,130,0.8)';
  for (const d of DOORS) {
    ctx.strokeRect(
      d.cells.x0 * CELL * s,
      d.cells.y0 * CELL * s,
      (d.cells.x1 - d.cells.x0) * CELL * s,
      (d.cells.y1 - d.cells.y0) * CELL * s
    );
  }
}

export function Minimap({ state }: { state: HudState | null }) {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = baseRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) drawBase(ctx);
  }, []);

  useEffect(() => {
    const c = liveRef.current;
    if (!c || !state) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const s = SIZE / (GRID_W * CELL);
    ctx.clearRect(0, 0, SIZE, SIZE);

    for (const b of state.blips) {
      const x = b.x * s;
      const y = b.z * s;
      if (b.kind === 'enemy') {
        ctx.fillStyle = '#ff6a4a';
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === 'mate') {
        ctx.fillStyle = '#7fd4ff';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.kind === 'c4') {
        ctx.fillStyle = '#ffd05a';
        ctx.fillRect(x - 3.2, y - 3.2, 6.4, 6.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 3.2, y - 3.2, 6.4, 6.4);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0b0f14';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
  }, [state]);

  return (
    <div className="minimap">
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <canvas ref={baseRef} width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0 }} />
        <canvas ref={liveRef} width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <div className="caption">Dust2 · 核心区域</div>
    </div>
  );
}
