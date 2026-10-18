import React, { useEffect, useRef, useState } from 'react'
import { createFilm, FilmState, TOTAL_DURATION } from './film/engine'
import './styles.css'

type UIState = {
  started: boolean
  subtitle: string
  speaker: string
  progress: number
  ended: boolean
  showEndCard: boolean
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ReturnType<typeof createFilm> | null>(null)
  const [ui, setUi] = useState<UIState>({
    started: false, subtitle: '', speaker: '', progress: 0, ended: false, showEndCard: false
  })

  useEffect(() => {
    if (!containerRef.current) return
    const inst = createFilm(containerRef.current)
    engineRef.current = inst
    inst.engine.onUpdate = (s: FilmState) => {
      const sub = s.currentSubtitle
      setUi(prev => ({
        ...prev,
        subtitle: sub?.text || '',
        speaker: sub?.speaker || '',
        progress: s.time / TOTAL_DURATION,
        ended: s.ended,
        showEndCard: s.ended || s.time >= 100
      }))
    }
    return () => {
      inst.dispose()
      engineRef.current = null
    }
  }, [])

  const handleStart = async () => {
    if (!engineRef.current) return
    setUi(u => ({ ...u, started: true }))
    await engineRef.current.engine.play()
  }

  const handleRestart = () => {
    if (!engineRef.current) return
    engineRef.current.engine.seek(0)
    setUi(u => ({ ...u, ended: false, showEndCard: false }))
    engineRef.current.engine.play()
  }

  return (
    <div className="film-container" ref={containerRef}>
      {!ui.started && (
        <div className="start-overlay" onClick={handleStart}>
          <h1>章北海 · 陨石子弹</h1>
          <p>三体 · 黑暗森林</p>
          <button className="start-btn" onClick={handleStart}>开始播放</button>
        </div>
      )}

      {ui.subtitle && (
        <div className="subtitle-bar">
          <span className="speaker">【{ui.speaker}】</span>
          <span>{ui.subtitle}</span>
        </div>
      )}

      <div className={`end-card ${ui.showEndCard ? 'visible' : ''}`}>
        {ui.ended ? '自然选择号，前进四。' : ''}
      </div>

      {ui.ended && (
        <div className="start-overlay" onClick={handleRestart} style={{ background: 'rgba(0,0,0,0.6)' }}>
          <button className="start-btn" onClick={handleRestart}>重新播放</button>
        </div>
      )}

      <div className="progress-wrap">
        <div className="progress-fill" style={{ width: `${Math.min(100, ui.progress * 100)}%` }} />
      </div>
    </div>
  )
}
