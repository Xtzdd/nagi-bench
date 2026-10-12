import { useEffect, useRef, useState } from 'react';
import { FilmEngine } from './film/engine';
import { shotAt, DURATION } from './film/shots';
import type { Shot } from './film/shots';
import { Subtitle } from './ui/Subtitle';
import { Hud } from './ui/Hud';
import { VOICE_CUES } from './film/voices';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<FilmEngine | null>(null);
  const [t, setT] = useState(0);
  const [shot, setShot] = useState<Shot>(() => shotAt(0));
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let engine: FilmEngine;
    try {
      engine = new FilmEngine(canvasRef.current);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      return;
    }
    engineRef.current = engine;
    engine.renderStill();

    const id = window.setInterval(() => {
      const now = engine.time;
      setT(now);
      setShot(shotAt(now));
      setPlaying(engine.playing);
    }, 80);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); engine.toggle(); }
      if (e.code === 'ArrowLeft') engine.seek(engine.time - 5);
      if (e.code === 'ArrowRight') engine.seek(engine.time + 5);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.audio.setVolume(volume);
  }, [volume]);

  const showingTitles = t < 18;
  const showingCredits = t >= 312;

  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" />

      {err && <div className="fatal">无法启动 3D 渲染：{err}</div>}

      {/* title card */}
      <div className={'card titles' + (showingTitles ? ' on' : '')}>
        <div className="card-kicker">程序化 3D 短片 / A procedural 3D cinematic</div>
        <h1>章北海<span className="dot">·</span>陨石子弹</h1>
        <div className="card-en">ZHANG BEIHAI: METEORITE BULLET</div>
        <div className="card-meta">
          片长 {Math.floor(DURATION / 60)} 分 {DURATION % 60} 秒 &nbsp;·&nbsp;
          体素美术 &nbsp;·&nbsp; {VOICE_CUES.length} 条待配音语音 cue &nbsp;·&nbsp; 无人声合成
        </div>
      </div>

      {/* credits */}
      <div className={'card credits' + (showingCredits ? ' on' : '')}>
        <div className="cr-row"><span>导演 / 分镜 / 剪辑</span><span>程序化生成</span></div>
        <div className="cr-row"><span>美术</span><span>体素几何，全部由代码构建</span></div>
        <div className="cr-row"><span>声音</span><span>Web Audio 程序化合成</span></div>
        <div className="cr-row"><span>对白</span><span>字幕呈现，待配音</span></div>
        <div className="cr-note">
          依据《三体》相关片段改编，取舍与重构由本次生成自行决定，不代表原作立场。
        </div>
      </div>

      <Subtitle t={t} />
      <Hud
        t={t}
        shot={shot}
        playing={playing}
        volume={volume}
        onToggle={() => engineRef.current?.toggle()}
        onSeek={(v) => engineRef.current?.seek(v)}
        onVolume={setVolume}
      />

      {!playing && t === 0 && (
        <div className="start-hint">
          <div className="sh-title">章北海 · 陨石子弹</div>
          <div className="sh-sub">点击「播放」开始 · 空格播放/暂停 · 左右方向键跳转 5 秒</div>
          <button className="btn big" onClick={() => engineRef.current?.play()}>播放</button>
        </div>
      )}
    </div>
  );
}
