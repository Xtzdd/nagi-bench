import { useEffect, useRef } from 'react';
import { walkableMap, GRID, SITES } from '../game/map';

export interface RadarData {
  self: { x: number; z: number; yaw: number; team: string } | null;
  mates: Array<{ x: number; z: number; name: string }>;
  enemies: Array<{ x: number; z: number }>;
  bomb: { x: number; z: number } | null;
}

// Canvas 2D top-down. The outline is derived from the same walkable grid the
// simulation uses, so the map can never drift out of sync with collision.
export function Minimap({ size = 190 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const map = walkableMap();
    const scale = size / GRID;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const d = (window as any).__radar as RadarData | undefined;
      if (!d) return;

      g.clearRect(0, 0, size, size);
      g.fillStyle = 'rgba(10,14,20,.72)';
      g.fillRect(0, 0, size, size);

      // walkable outline
      g.fillStyle = 'rgba(196,178,142,.30)';
      for (let cz = 0; cz < GRID; cz++) {
        let run = -1;
        for (let cx = 0; cx <= GRID; cx++) {
          const ok = cx < GRID && map[cz * GRID + cx] === 1;
          if (ok && run < 0) run = cx;
          if (!ok && run >= 0) {
            g.fillRect(run * scale, cz * scale, (cx - run) * scale, Math.ceil(scale));
            run = -1;
          }
        }
      }

      // bomb sites
      g.font = '9px system-ui';
      g.textAlign = 'center';
      for (const [key, s] of Object.entries(SITES)) {
        g.strokeStyle = 'rgba(255,190,90,.55)';
        g.lineWidth = 1;
        g.strokeRect(s.x0 * scale, s.z0 * scale, (s.x1 - s.x0) * scale, (s.z1 - s.z0) * scale);
        g.fillStyle = 'rgba(255,200,110,.85)';
        g.fillText(key, s.cx * scale, s.cz * scale + 3);
      }

      // teammates
      g.fillStyle = '#6fd3a0';
      for (const m of d.mates) {
        g.beginPath();
        g.arc(m.x * scale, m.z * scale, 2.4, 0, Math.PI * 2);
        g.fill();
      }

      // visible enemies
      g.fillStyle = '#ff5a4a';
      for (const e of d.enemies) {
        g.beginPath();
        g.arc(e.x * scale, e.z * scale, 2.8, 0, Math.PI * 2);
        g.fill();
      }

      // bomb
      if (d.bomb) {
        const pulse = 0.5 + Math.abs(Math.sin(performance.now() / 240)) * 0.5;
        g.fillStyle = `rgba(255,70,60,${pulse})`;
        g.beginPath();
        g.arc(d.bomb.x * scale, d.bomb.z * scale, 3.6, 0, Math.PI * 2);
        g.fill();
      }

      // self: a triangle pointing where we look
      if (d.self) {
        const px = d.self.x * scale, pz = d.self.z * scale;
        const a = d.self.yaw;
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(px + Math.sin(-a + Math.PI) * 4.4, pz + Math.cos(-a + Math.PI) * 4.4);
        g.lineTo(px + Math.sin(-a + Math.PI + 2.5) * 3.6, pz + Math.cos(-a + Math.PI + 2.5) * 3.6);
        g.lineTo(px + Math.sin(-a + Math.PI - 2.5) * 3.6, pz + Math.cos(-a + Math.PI - 2.5) * 3.6);
        g.closePath();
        g.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <div className="minimap">
      <canvas ref={ref} width={size} height={size} />
      <div className="mm-label">DUST2</div>
    </div>
  );
}
