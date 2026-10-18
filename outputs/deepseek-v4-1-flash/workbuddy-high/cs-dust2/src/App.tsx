import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from './game/game';
import { getSnapshot, subscribe } from './engine/store';
import { initAudio, resumeAudio, setVolume } from './audio/audio';
import { Hud } from './ui/Hud';
import { Menus } from './ui/Menus';
import './styles.css';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let game: Game | null = null;
    try {
      game = new Game(canvas);
      game.attach();
      gameRef.current = game;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    const onLock = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('error', (e) => setError(e.message));
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  const onStart = useCallback(() => {
    initAudio();
    resumeAudio();
    setVolume(0.5);
    gameRef.current?.start();
    gameRef.current?.requestLock();
    setStarted(true);
  }, []);

  const onResume = useCallback(() => {
    resumeAudio();
    gameRef.current?.requestLock();
  }, []);

  return (
    <div className="app">
      <canvas className="stage" ref={canvasRef} />
      <Hud state={state} />
      <Menus state={state} started={started} locked={locked} onStart={onStart} onResume={onResume} />
      {error && (
        <div className="menu">
          <div className="card">
            <h2 className="danger">运行失败</h2>
            <p>{error}</p>
            <p>请确认浏览器支持 WebGL2，并尝试刷新页面。</p>
          </div>
        </div>
      )}
    </div>
  );
}
