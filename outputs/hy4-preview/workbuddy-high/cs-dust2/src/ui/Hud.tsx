import type { Snapshot } from '../game/engine';
import { Minimap } from './Minimap';

const fmt = (s: number) => {
  const m = Math.floor(Math.max(0, s) / 60);
  const r = Math.floor(Math.max(0, s) % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export function Hud({ s, showScore }: { s: Snapshot; showScore: boolean }) {
  const cross = Math.max(3, Math.min(46, s.crosshairSpread));
  const bombLeft = s.bomb.left;
  const urgent = bombLeft > 0 && bombLeft < 12;

  return (
    <>
      {/* crosshair */}
      {!s.scoped && (
        <div className="cross" style={{ ['--gap' as any]: `${cross}px` }}>
          <i className="c-t" /><i className="c-b" /><i className="c-l" /><i className="c-r" />
          <i className="c-dot" />
        </div>
      )}
      {s.hitFlash > 0 && <div className="hitmark"><i /><i /><i /><i /></div>}

      {/* AWP scope overlay: 2D mask on top of the zoomed 3D view */}
      {s.scoped && (
        <div className="scope">
          <div className="scope-mask" />
          <div className="scope-ring" />
          <div className="scope-h" />
          <div className="scope-v" />
          <div className="scope-dot" />
        </div>
      )}

      {/* top bar: score, timer, bombsite status */}
      <div className="topbar">
        <div className="score t">{s.scoreT}</div>
        <div className="mid-info">
          <div className={'clock' + (s.bomb.planted ? ' hot' : '')}>{fmt(s.timeLeft)}</div>
          <div className="rnd">
            Round {s.round}
            {s.pistolRound && <span className="tag">PISTOL</span>}
          </div>
          {s.bomb.planted && (
            <div className={'cct' + (urgent ? ' urgent' : '')}>C4 {s.bomb.site} · {bombLeft.toFixed(1)}</div>
          )}
        </div>
        <div className="score ct">{s.scoreCT}</div>
        <div className="alive">
          <span className="ct-n">{5 - s.deadCount.CT}</span>
          <span className="sep">vs</span>
          <span className="t-n">{5 - s.deadCount.T}</span>
        </div>
      </div>

      {/* killfeed */}
      <div className="killfeed">
        {s.killfeed.map(k => (
          <div key={k.id} className="kf">
            <span className={'p ' + k.killerTeam.toLowerCase()}>{k.killer}</span>
            <span className="ico">{k.headshot ? 'HS' : k.weapon}</span>
            <span className={'p ' + k.victimTeam.toLowerCase()}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* banner */}
      {s.banner && <div className="banner">{s.banner}</div>}

      {/* bottom-left: health / armor */}
      <div className="vitals">
        <div className="hp">
          <span className="k">HP</span>
          <span className="v">{Math.max(0, s.hp)}</span>
        </div>
        <div className="ar">
          <span className="k">AR</span>
          <span className="v">{Math.max(0, s.armor)}{s.helmet ? ' ⬤' : ''}</span>
        </div>
        {s.bomb.carrying && <div className="carry">C4 携带中</div>}
      </div>

      {/* bottom-right: ammo + weapon */}
      <div className="ammo">
        <div className="wname">{s.weaponName}</div>
        <div className={'rounds' + (s.reloading ? ' reload' : '')}>
          {s.reloading ? '装弹中…' : s.weapon === 'knife' ? '—' : `${s.mag} / ${s.reserve}`}
        </div>
        <div className="slots">
          <span className={s.slot === 'primary' ? 'on' : ''}>1</span>
          <span className={s.slot === 'secondary' ? 'on' : ''}>2</span>
          <span className={s.slot === 'melee' ? 'on' : ''}>3</span>
        </div>
      </div>

      {/* progress bars for plant / defuse */}
      {(s.bomb.planting > 0 || s.bomb.defusing > 0) && (
        <div className="action">
          <div className="act-label">{s.bomb.planting > 0 ? '正在安放 C4' : '正在拆除 C4'}</div>
          <div className="act-bar"><i /></div>
          <div className="act-hint">保持位置，移动会中断</div>
        </div>
      )}

      <div className="mm-wrap"><Minimap /></div>

      {/* scoreboard */}
      {showScore && (
        <div className="board">
          <div className="bh">
            <span>TERRORIST ({s.scoreT})</span>
            <span>COUNTER-TERRORIST ({s.scoreCT})</span>
          </div>
          <div className="bcols">
            <div className="bcol">
              {s.actors.filter(a => a.team === 'T').map(a => (
                <div key={a.name} className={'brow' + (a.controlled ? ' me' : '') + (a.alive ? '' : ' dead')}>
                  <span className="bn">{a.name}</span><span className="bk">{a.kills}</span>
                  <span className="bd">{a.deaths}</span><span className="bh2">{a.hp}</span>
                </div>
              ))}
            </div>
            <div className="bcol">
              {s.actors.filter(a => a.team === 'CT').map(a => (
                <div key={a.name} className={'brow' + (a.controlled ? ' me' : '') + (a.alive ? '' : ' dead')}>
                  <span className="bn">{a.name}</span><span className="bk">{a.kills}</span>
                  <span className="bd">{a.deaths}</span><span className="bh2">{a.hp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* death / spectate */}
      {s.spectating && (
        <div className="dead">
          <div className="d-title">你已阵亡</div>
          <div className="d-sub">正在观战 <b>{s.spectating}</b> · 按空格切换队友</div>
        </div>
      )}
    </>
  );
}
