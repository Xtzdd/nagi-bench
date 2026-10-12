import { useEffect, useRef, useState } from 'react'
import { Engine, Snapshot } from './game/engine'
import { HUD } from './ui/HUD'
import { Minimap } from './ui/Minimap'

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!started || !containerRef.current || engineRef.current) return
    const engine = new Engine(containerRef.current, setSnap)
    engineRef.current = engine
    return () => { engine.dispose(); engineRef.current = null }
  }, [started])

  if (!started) {
    return (
      <div className="start-menu" onClick={() => setStarted(true)}>
        <h1>DUST2 <span>5v5</span></h1>
        <p>React + TypeScript + three.js 第一人称射击原型</p>
        <ul>
          <li>WASD 移动 · 空格跳跃 · Shift 静步 · 鼠标射击</li>
          <li>R 换弹 · E 下包/拆包 · 1/2/3 切换武器 · 右键 AWP 开镜</li>
          <li>第 1 与第 13 回合为手枪局 · 阵亡后自动观战存活队友</li>
        </ul>
        <button>点击开始</button>
      </div>
    )
  }

  return (
    <div className="game-root">
      <div ref={containerRef} className="canvas-host" />
      {snap && <HUD snap={snap} />}
      {snap && <Minimap snap={snap} />}
      {snap && !snap.playerAlive && (
        <div className="spectator-hint">观战中 · 队友阵亡后自动切换视角</div>
      )}
    </div>
  )
}
