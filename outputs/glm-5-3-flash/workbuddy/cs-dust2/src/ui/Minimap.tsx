import { useEffect, useRef } from 'react'
import { Snapshot } from '../game/engine'
import { minimapWalls, A_SITE, B_SITE, MAP_W, MAP_D, T_SPAWNS, CT_SPAWNS } from '../game/map'

// 常驻小地图: 俯视轮廓 + 自己/队友/可见敌人 + C4 位置
export function Minimap({ snap }: { snap: Snapshot }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const g = cv.getContext('2d')!
    const S = 2.6
    const W = MAP_W * S, H = MAP_D * S
    cv.width = W; cv.height = H
    g.clearRect(0, 0, W, H)
    g.fillStyle = 'rgba(10,14,18,0.72)'
    g.fillRect(0, 0, W, H)

    // 墙体轮廓
    g.fillStyle = '#8a7a5c'
    for (const b of minimapWalls()) {
      g.fillRect(b.minX * S, b.minZ * S, (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S)
    }
    // 包点
    g.strokeStyle = '#ff5533'
    g.lineWidth = 1.5
    for (const site of [A_SITE, B_SITE]) {
      g.beginPath()
      g.arc(site.x * S, site.z * S, site.r * S, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#ff5533'
      g.font = '10px sans-serif'
      g.fillText(site === A_SITE ? 'A' : 'B', site.x * S - 3, site.z * S + 3)
    }
    // 出生点淡标记
    g.fillStyle = '#ffffff22'
    for (const [x, z] of T_SPAWNS) g.fillRect(x * S - 2, z * S - 2, 4, 4)
    for (const [x, z] of CT_SPAWNS) g.fillRect(x * S - 2, z * S - 2, 4, 4)

    // 单位点: 自己(白框) / 队友(绿) / 敌人(红, 引擎已按可见性过滤时同样适用)
    for (const d of snap.dots) {
      const dx = d.x * S, dz = d.z * S
      g.fillStyle = d.you ? '#ffffff' : d.team === 'CT' ? '#6fa8ff' : '#ffcf5a'
      g.beginPath(); g.arc(dx, dz, d.you ? 4 : 3.2, 0, Math.PI * 2); g.fill()
      if (d.you) {
        g.strokeStyle = '#4dff6a'; g.lineWidth = 1.5
        g.beginPath(); g.arc(dx, dz, 5.5, 0, Math.PI * 2); g.stroke()
      }
    }

    // C4
    if (snap.c4Planted) {
      const bx = (snap.bombA ? A_SITE.x : snap.bombB ? B_SITE.x : 48) * S
      const bz = (snap.bombA ? A_SITE.z : snap.bombB ? B_SITE.z : 33) * S
      g.fillStyle = '#ff2200'
      g.beginPath(); g.arc(bx, bz, 4, 0, Math.PI * 2); g.fill()
    }
  }, [snap])

  return (
    <div className="minimap">
      <canvas ref={ref} />
      <div className="minimap-label">
        CT {snap.aliveCT} — {snap.aliveT} T
      </div>
    </div>
  )
}
