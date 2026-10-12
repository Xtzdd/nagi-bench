import { Snapshot } from '../game/engine'
import { WEAPONS } from '../game/weapons'

export function HUD({ snap }: { snap: Snapshot }) {
  const w = WEAPONS[snap.weapon] ?? WEAPONS.usp
  const spread = 6 + snap.spreadUI * 26
  return (
    <>
      {/* 准星: 动态扩散 */}
      {!snap.playerAlive ? null : snap.scoped ? (
        <div className="scope-overlay">
          <div className="scope-circle" />
          <div className="scope-line v" /><div className="scope-line h" />
        </div>
      ) : (
        <div className="crosshair">
          <span className="ch t" style={{ transform: `translate(-50%, ${-spread - 8}px)` }} />
          <span className="ch b" style={{ transform: `translate(-50%, ${spread}px)` }} />
          <span className="ch l" style={{ transform: `translate(${-spread - 8}px, -50%)` }} />
          <span className="ch r" style={{ transform: `translate(${spread}px, -50%)` }} />
        </div>
      )}

      {/* 顶部: 比分与回合 */}
      <div className="topbar">
        <div className="score ct">{snap.scoreCT}</div>
        <div className="round-info">
          <div>回合 {snap.roundNo}{snap.pistolRound ? ' · 手枪局' : ''}</div>
          <div className="phase">{snap.phase === 'freeze' ? '准备阶段' : snap.phase === 'end' ? snap.roundMsg : `${Math.ceil(snap.phaseEnd)}s`}</div>
        </div>
        <div className="score t">{snap.scoreT}</div>
        <div className="alive ct">{snap.aliveCT}</div>
        <div className="alive t">{snap.aliveT}</div>
      </div>

      {/* 击杀播报 */}
      <div className="killfeed">
        {snap.killfeed.map(k => (
          <div key={k.id} className="kf-row">
            <span className="kf-killer">{k.killer}</span>
            <span className="kf-weapon">{WEAPONS[k.weapon]?.name ?? k.weapon}{k.head ? ' · 爆头' : ''}</span>
            <span className="kf-victim">{k.victim}</span>
          </div>
        ))}
      </div>

      {/* C4 状态 */}
      {snap.c4Planted && (
        <div className="c4-banner">C4 已安放 · {snap.c4Timer.toFixed(1)}s{(snap.bombA ? ' · A 点' : '')}{(snap.bombB ? ' · B 点' : '')}</div>
      )}
      {snap.hasC4 && snap.playerAlive && <div className="c4-carry">携带 C4 — 前往包点按 E 安放</div>}
      {snap.canPlant && <div className="action-hint">按 E 安放 C4</div>}
      {snap.canDefuse && <div className="action-hint defuse">按住 E 拆除 C4</div>}
      {snap.roundMsg && snap.phase === 'end' && <div className="round-msg">{snap.roundMsg}</div>}

      {/* 底部: 血甲 + 弹药 */}
      <div className="bottombar">
        <div className="health">
          <span className="num">{snap.hp}</span>
          <span className="bar"><i style={{ width: `${snap.hp}%` }} /></span>
          <span className="armor-num">{snap.armor}</span>
        </div>
        <div className="ammo">
          <span className="wname">{w.name}</span>
          {w.mag > 0 ? (
            <span className="ammo-num">{snap.mag}<small> / {snap.reserve}</small></span>
          ) : (
            <span className="ammo-num">∞</span>
          )}
        </div>
      </div>
    </>
  )
}
