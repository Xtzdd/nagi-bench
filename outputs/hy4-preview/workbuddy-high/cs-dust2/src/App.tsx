import { useEffect, useRef, useState } from 'react';
import { Game, type Snapshot } from './game/engine';
import { Hud } from './ui/Hud';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let game: Game;
    try {
      game = new Game(canvasRef.current);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      return;
    }
    gameRef.current = game;
    game.onSnapshot = (s) => setSnap(s);
    game.start();

    const tick = () => { (window as any).__radar = game.radar(); };
    const id = window.setInterval(tick, 90);

    const down = (e: KeyboardEvent) => {
      if (e.code === 'Tab') { e.preventDefault(); setShowScore(true); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Tab') setShowScore(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      game.dispose();
    };
  }, []);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="stage" />
      {err && <div className="fatal">无法启动：{err}<br />需要支持 WebGL2 的浏览器。</div>}
      {snap && <Hud s={snap} showScore={showScore} />}

      {!started && (
        <div className="splash">
          <div className="sp-box">
            <h1>DUST2 <span>5v5</span></h1>
            <div className="sp-sub">React + TypeScript + three.js 手写 3D FPS 原型</div>
            <ul className="sp-keys">
              <li><b>WASD</b> 移动 · <b>Space</b> 跳跃 · <b>Shift</b> 静步</li>
              <li><b>左键</b> 开火 · <b>右键</b> AWP 开镜 · <b>R</b> 换弹</li>
              <li><b>1 / 2 / 3</b> 主武器 / 副武器 / 匕首</li>
              <li><b>E</b> 安放或拆除 C4 · <b>Tab</b> 计分板</li>
              <li>阵亡后按 <b>Space</b> 切换并接管存活队友</li>
            </ul>
            <button className="sp-btn" onClick={() => {
              setStarted(true);
              gameRef.current?.audio.unlock();
              canvasRef.current?.requestPointerLock?.();
            }}>点击进入</button>
            <div className="sp-note">全员第一回合为手枪局；地图、角色、武器与音效全部由代码程序生成。</div>
          </div>
        </div>
      )}
    </div>
  );
}
