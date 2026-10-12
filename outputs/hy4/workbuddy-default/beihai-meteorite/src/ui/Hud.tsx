import { DURATION } from '../film/shots';
import type { Shot } from '../film/shots';

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

interface Props {
  t: number;
  shot: Shot;
  playing: boolean;
  volume: number;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
}

export function Hud({ t, shot, playing, volume, onToggle, onSeek, onVolume }: Props) {
  const pct = (t / DURATION) * 100;
  return (
    <div className="hud">
      <div className="hud-left">
        <button className="btn" onClick={onToggle}>{playing ? '暂停' : '播放'}</button>
        <button className="btn ghost" onClick={() => onSeek(0)}>回到开头</button>
      </div>

      <div className="hud-mid">
        <div className="shot-label">{shot.label}</div>
        <div className="track" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onSeek(((e.clientX - r.left) / r.width) * DURATION);
        }}>
          <div className="track-fill" style={{ width: `${pct}%` }} />
          <div className="track-head" style={{ left: `${pct}%` }} />
        </div>
        <div className="time">{fmt(t)} / {fmt(DURATION)}</div>
      </div>

      <div className="hud-right">
        <span className="vol-label">音量</span>
        <input
          className="vol"
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
