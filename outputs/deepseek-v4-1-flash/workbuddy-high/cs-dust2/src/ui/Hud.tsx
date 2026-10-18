import type { HudState } from '../engine/types';
import { Minimap } from './Minimap';

/** 准星间隙：换弹与开镜会改变间隙，开镜时改用 2D 遮罩。 */
const crosshairGap = (s: HudState): number => 8 + (s.reloading ? 7 : 0);

function Crosshair({ state }: { state: HudState }) {
  if (state.scoped) return null;
  const gap = crosshairGap(state);
  const len = 9;
  return (
    <div className="crosshair">
      <i style={{ left: -1, top: -gap - len, width: 2, height: len }} />
      <i style={{ left: -1, top: gap, width: 2, height: len }} />
      <i style={{ top: -1, left: -gap - len, height: 2, width: len }} />
      <i style={{ top: -1, left: gap, height: 2, width: len }} />
      <i style={{ left: -1, top: -1, width: 2, height: 2 }} />
    </div>
  );
}

function Scoreboard({ state }: { state: HudState }) {
  const bomb = state.phase === 'planted';
  return (
    <div className="panel scoreboard">
      <div className="team ct">
        CT <span className="num">{state.score.CT}</span> <span style={{ opacity: 0.6 }}>({state.aliveCT})</span>
      </div>
      <div className={`timer ${bomb ? 'bomb' : ''}`}>
        {Math.max(0, Math.ceil(state.timeLeft))}
      </div>
      <div className="team t">
        <span style={{ opacity: 0.6 }}>({state.aliveT})</span> <span className="num">{state.score.T}</span> T
      </div>
      {state.isPistolRound && <span className="badge">手枪局</span>}
    </div>
  );
}

function Vitals({ state }: { state: HudState }) {
  return (
    <div className="panel vitals">
      <div className="row">
        <span className="k">生命</span>
        <span className="v" style={{ color: state.health > 35 ? '#bfe8c4' : '#ff8a6a' }}>
          {state.health}
        </span>
      </div>
      <div className="row">
        <span className="k">护甲</span>
        <span className="v" style={{ color: state.armor > 0 ? '#9fc4ff' : '#6b7c8c' }}>
          {state.armor}
          {state.hasHelmet ? ' + 头盔' : ''}
        </span>
      </div>
    </div>
  );
}

function Ammo({ state }: { state: HudState }) {
  const active = state.weapons.find((w) => w.slot === state.activeSlot) ?? state.weapons[0];
  return (
    <div className="panel ammo">
      <div className="weapon">{active ? active.name : '空手'}</div>
      <div className="counts">
        {active ? active.mag : 0} <small>/ {active ? active.reserve : 0}</small>
      </div>
      <div className="slots">
        {state.weapons.map((w) => (
          <span key={w.id} className={`slot ${w.id === active?.id ? 'on' : ''}`}>
            {w.slot === 'primary' ? '主' : w.slot === 'secondary' ? '副' : '刀'} {w.name}
          </span>
        ))}
      </div>
      {state.reloading && <div className="weapon" style={{ color: '#ffd79a' }}>换弹中…</div>}
    </div>
  );
}

function KillFeed({ state }: { state: HudState }) {
  return (
    <div className="killfeed">
      {state.killFeed.map((k) => (
        <div className="item" key={k.id}>
          <span className={k.killerTeam === 'CT' ? 'ct' : 't'}>{k.killer}</span>
          <span style={{ opacity: 0.75 }}> [{k.weapon}{k.headshot ? ' · 爆头' : ''}] </span>
          <span className={k.victimTeam === 'CT' ? 'ct' : 't'}>{k.victim}</span>
        </div>
      ))}
    </div>
  );
}

function Progress({ state }: { state: HudState }) {
  const defusing = state.phase === 'planted' && state.defuseProgress > 0.01;
  const planting = state.phase === 'live' && state.plantProgress > 0.01;
  if (!defusing && !planting) return null;
  const v = defusing ? state.defuseProgress : state.plantProgress;
  return (
    <div className="progress">
      <div className="label">{defusing ? '拆除 C4' : '安放 C4'}</div>
      <div className="bar">
        <span style={{ width: `${Math.min(100, v * 100)}%` }} />
      </div>
    </div>
  );
}

export function Hud({ state }: { state: HudState | null }) {
  if (!state) return null;
  return (
    <div className="overlay">
      {state.scoped && <div className="scope" />}
      <Scoreboard state={state} />
      <Minimap state={state} />
      <KillFeed state={state} />
      <Crosshair state={state} />
      <Vitals state={state} />
      <Ammo state={state} />
      <Progress state={state} />
      {state.message && <div className="center-msg">{state.message}</div>}
      {state.spectating && (
        <div className="spectate-note">观察模式 · Q 切换队友 · F 接管操控</div>
      )}
    </div>
  );
}
