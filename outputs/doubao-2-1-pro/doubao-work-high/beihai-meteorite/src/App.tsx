import { useEffect, useRef, useState } from 'react';
import { CinematicEngine } from './game/CinematicEngine';
import { CUES, DURATION } from './game/cues';
import type { FilmState } from './game/types';

const fmt=(t:number)=>{const m=Math.floor(t/60),s=Math.floor(t%60);return `${m}:${String(s).padStart(2,'0')}`};
const initial:FilmState={time:0,duration:DURATION,playing:false,subtitle:CUES[0].subtitle,scene:CUES[0].scene,cueId:1,cues:CUES};

export default function App(){
  const mountRef=useRef<HTMLDivElement>(null);
  const engineRef=useRef<CinematicEngine|null>(null);
  const [film,setFilm]=useState<FilmState>(initial);
  useEffect(()=>{if(!mountRef.current)return;const engine=new CinematicEngine(mountRef.current,setFilm);engineRef.current=engine;const t=Number(new URLSearchParams(location.search).get('t'));if(!Number.isNaN(t))engine.seek(t);return()=>engine.dispose()},[]);
  return (
    <div className="film-app">
      <div ref={mountRef} className="stage"/>
      <header className="film-header">
        <div><h1>北海陨石</h1><span>体素3D程序化电影 · 180秒</span></div>
        <div className="scene-name">{film.scene}</div>
      </header>
      <div className="subtitle">{film.subtitle}</div>
      <aside className="cue-panel">
        <h2>Voice Cue 清单</h2>
        <div className="cue-list">
          {film.cues.map(c=>(
            <button key={c.id} className={film.cueId===c.id?'active':''} onClick={()=>engineRef.current?.seek(c.start)}>
              <b>{fmt(c.start)}–{fmt(c.end)} · {c.scene}</b>
              <span>{c.voice}</span>
              <small>{c.shot}</small>
              <em>{c.sound}</em>
            </button>
          ))}
        </div>
      </aside>
      <footer className="timeline-bar">
        <button className="play" onClick={()=>film.playing?engineRef.current?.pause():engineRef.current?.play()}>{film.playing?'暂停':'播放'}</button>
        <span>{fmt(film.time)}</span>
        <input type="range" min="0" max={DURATION} step="1" value={film.time} onChange={e=>engineRef.current?.seek(Number(e.target.value))}/>
        <span>{fmt(DURATION)}</span>
      </footer>
    </div>
  );
}
