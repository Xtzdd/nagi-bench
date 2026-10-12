import { useEffect, useRef, useState } from 'react'
import { Director, FrameState } from './film/director'
import { FILM_DURATION, VOICE_CUES } from './film/timeline'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const directorRef = useRef<Director | null>(null)
  const [state, setState] = useState<FrameState | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!started || !hostRef.current || directorRef.current) return
    directorRef.current = new Director(hostRef.current, setState)
    return () => { directorRef.current?.dispose(); directorRef.current = null }
  }, [started])

  const t = state?.time ?? 0
  const toggle = () => directorRef.current?.toggle()
  const seek = (ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect()
    directorRef.current?.seek(((ev.clientX - rect.left) / rect.width) * FILM_DURATION)
  }

  if (!started) {
    return (
      <div className="cinema-start" onClick={() => setStarted(true)}>
        <div className="cs-inner">
          <h1>章北海 · 陨石子弹</h1>
          <p className="sub">程序化 3D 短片 · 体素叙事 · 总时长 3 分 36 秒</p>
          <p className="desc">改编自《三体》中章北海在太空中狙杀「老航天」的片段。<br />
            全片无配音，所有待配音内容以字幕呈现；音效由 Web Audio 程序化合成。</p>
          <button>开始放映</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cinema">
      <div ref={hostRef} className="cinema-host" />

      {/* 字幕: 统一【说话者】文本, 底部居中 */}
      {state?.cue && (
        <div className="subtitle">
          <span className="sub-speaker">【{state.cue.speaker}】</span>
          <span className="sub-text">{state.cue.text}</span>
          {state.cue.kind === 'inner' && <span className="sub-kind">（内心独白）</span>}
        </div>
      )}

      {/* 场景标题卡 */}
      {state?.shot?.title && (
        <div className="scene-title">{state.shot.title}</div>
      )}

      {/* 控制条 */}
      <div className="cinema-bar">
        <button onClick={toggle}>{state?.playing ? '暂停' : '播放'}</button>
        <div className="timeline" onClick={seek}>
          {VOICE_CUES.map(c => (
            <span key={c.id} className="cue-tick" style={{ left: `${(c.start / FILM_DURATION) * 100}%` }} title={c.text} />
          ))}
          <div className="progress" style={{ width: `${(t / FILM_DURATION) * 100}%` }} />
        </div>
        <span className="timecode">{fmt(t)} / {fmt(FILM_DURATION)}</span>
      </div>
    </div>
  )
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}
