import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import type { HudState, WeaponId } from './game/types';

const initial: HudState = {
  phase:'准备', timer:115, playerHp:100, weapon:'rifle', ammo:30, reserve:90,
  scoreT:0, scoreCT:0, bombPlanted:false, bombTimer:40, bombSite:null,
  canPlant:false, canDefuse:false, feed:[], soldiers:[], message:''
};
const weaponName: Record<WeaponId,string> = { rifle:'AK-47', pistol:'USP-S', knife:'Knife' };

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hud,setHud] = useState<HudState>(initial);
  const [started,setStarted] = useState(() => new URLSearchParams(location.search).has('auto'));

  useEffect(() => {
    if (!started || !mountRef.current) return;
    const game = new Game(mountRef.current,setHud);
    return () => game.dispose();
  }, [started]);

  return (
    <div className="app">
      <div ref={mountRef} className="stage" />
      {!started && (
        <div className="start-screen">
          <div className="start-card">
            <h1>DUST II 战术模拟</h1>
            <p>React + TypeScript + Three.js 构建的 5v5 回合制战术样例。</p>
            <ul>
              <li>WASD 移动，鼠标瞄准，左键开火</li>
              <li>1/2/3 切换步枪、手枪、匕首，R 换弹</li>
              <li>在 A/B 包点按 F 安放 C4</li>
              <li>AI 队友与敌方会自动索敌、交火和转点</li>
            </ul>
            <button onClick={() => setStarted(true)}>开始回合</button>
          </div>
        </div>
      )}

      {started && <>
        <div className="topbar">
          <div className="score t">T {hud.scoreT}</div>
          <div className={`timer ${hud.bombPlanted?'bomb':''}`}>{hud.phase} · {hud.timer}s</div>
          <div className="score ct">CT {hud.scoreCT}</div>
        </div>
        <div className="message">{hud.message}</div>
        <div className="feed">{hud.feed.map((f,i)=><div key={i}>{f}</div>)}</div>
        <div className="bottom-hud">
          <div className="health"><span>HP</span><b>{hud.playerHp}</b></div>
          <div className="weapon"><b>{weaponName[hud.weapon]}</b><span>{hud.ammo === Infinity ? '∞' : hud.ammo} / {hud.reserve === Infinity ? '∞' : hud.reserve}</span></div>
          <div className="tips">WASD移动 · 鼠标射击 · R换弹 · F安放C4</div>
        </div>
        <Minimap hud={hud} />
      </>}
    </div>
  );
}

function Minimap({ hud }: { hud:HudState }) {
  return (
    <div className="minimap">
      <svg viewBox="-45 -39 90 78">
        <rect x="-45" y="-39" width="90" height="78" rx="4" fill="#b99262"/>
        <path d="M -38 -34 L 24 -18 L 32 -10" stroke="#d1ad7a" strokeWidth="5" fill="none"/>
        <path d="M 0 -2 L 0 20" stroke="#d1ad7a" strokeWidth="5" fill="none"/>
        <path d="M -28 8 L -34 21" stroke="#d1ad7a" strokeWidth="5" fill="none"/>
        <text x="32" y="-9" textAnchor="middle" fontSize="6" fill="#3b2b1d">A</text>
        <text x="-34" y="22" textAnchor="middle" fontSize="6" fill="#3b2b1d">B</text>
        <text x="-38" y="-31" textAnchor="middle" fontSize="5" fill="#3b2b1d">T</text>
        <text x="36" y="22" textAnchor="middle" fontSize="5" fill="#3b2b1d">CT</text>
        {hud.soldiers.map(s => s.alive && (
          <circle key={s.id} cx={s.x} cy={s.z} r={s.isPlayer?2.2:1.5}
            fill={s.team==='T' ? '#e6b25e' : '#5aa0d8'} stroke="#10151b" strokeWidth=".5"/>
        ))}
        {hud.bombPlanted && <rect x={hud.soldiers[0]?0:0} y="0" width="0" height="0"/>}
      </svg>
      <div className="map-title">DUST II</div>
    </div>
  );
}
