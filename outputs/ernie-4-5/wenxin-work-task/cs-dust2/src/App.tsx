import React, { useEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import { HUDSnapshot, Team } from './game/types';

type MenuState = 'menu' | 'playing' | 'round_end';

const DEFAULT_HUD: HUDSnapshot = {
  hp: 100, armor: 0, hasHelmet: false,
  weaponName: 'USP-S', ammoInMag: 12, reserveAmmo: 24,
  reloading: false, scoped: false, money: 800, team: 'CT',
  alive: true,
  roundState: 'live', roundTimer: 115,
  tScore: 0, ctScore: 0,
  bombState: 'carried', bombTimer: 0, bombCarrier: null,
  kills: [],
  spectatorIndex: 0,
  spectatorList: [],
  playerPositions: [],
  bombPos: null,
  aSite: { x: 46, z: 7 }, bSite: { x: 13, z: 34 },
  roundNumber: 1,
};

function formatTime(sec: number) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [menuState, setMenuState] = useState<MenuState>('menu');
  const [hud, setHud] = useState<HUDSnapshot>(DEFAULT_HUD);
  const [roundEndInfo, setRoundEndInfo] = useState<{ winner: Team; reason: string } | null>(null);

  useEffect(() => {
    if (menuState !== 'playing') return;
    if (!containerRef.current || !minimapRef.current) return;

    const g = new Game(containerRef.current, minimapRef.current, {
      onHudUpdate: (snap) => {
        setHud(snap);
      },
      onRoundEnd: (winner, reason) => {
        setRoundEndInfo({ winner, reason });
        setTimeout(() => setRoundEndInfo(null), 4000);
      },
    });
    gameRef.current = g;
    g.start();

    return () => {
      g.stop();
      gameRef.current = null;
    };
  }, [menuState]);

  const startGame = () => {
    setMenuState('playing');
  };

  const returnToMenu = () => {
    setMenuState('menu');
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      {/* three.js container */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {menuState === 'menu' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at center, #1a2a1a 0%, #000 80%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <h1 style={{ color: '#e9c46a', fontSize: 64, letterSpacing: 8, margin: 0, textShadow: '4px 4px 0 #6b3f1f' }}>
            DUST II
          </h1>
          <h2 style={{ color: '#fff', fontSize: 22, letterSpacing: 4, marginTop: 8, opacity: 0.8 }}>
            5v5 BOMB DEFUSAL
          </h2>
          <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              onClick={startGame}
              style={{
                background: '#e9c46a', color: '#1a1a1a', border: 'none',
                padding: '14px 48px', fontSize: 20, cursor: 'pointer',
                fontFamily: 'monospace', letterSpacing: 3, fontWeight: 'bold',
              }}
            >
              START GAME
            </button>
          </div>
          <div style={{ marginTop: 60, color: '#aaa', fontSize: 14, fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.8 }}>
            <div>WASD — MOVE &nbsp; SHIFT — WALK &nbsp; SPACE — JUMP</div>
            <div>MOUSE — AIM &nbsp; LEFT CLICK — FIRE &nbsp; RIGHT CLICK — SCOPE (AWP)</div>
            <div>R — RELOAD &nbsp; E — PLANT/DEFUSE &nbsp; 1/2/3 — WEAPONS</div>
            <div>AFTER DEATH: 1-4 TO SPECTATE TEAMMATES</div>
            <div style={{ marginTop: 20, color: '#e76f51' }}>Click canvas to lock mouse. ESC to release.</div>
          </div>
        </div>
      )}

      {menuState === 'playing' && (
        <>
          {/* Crosshair */}
          {hud.alive && !hud.scoped && (
            <div
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 20, height: 20, marginLeft: -10, marginTop: -10,
                pointerEvents: 'none', zIndex: 5,
              }}
            >
              <div style={{ position: 'absolute', top: 9, left: 0, width: 6, height: 2, background: '#0f0' }} />
              <div style={{ position: 'absolute', top: 9, right: 0, width: 6, height: 2, background: '#0f0' }} />
              <div style={{ position: 'absolute', top: 0, left: 9, width: 2, height: 6, background: '#0f0' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 9, width: 2, height: 6, background: '#0f0' }} />
              <div style={{ position: 'absolute', top: 9, left: 9, width: 2, height: 2, background: '#0f0' }} />
            </div>
          )}

          {/* AWP Scope overlay */}
          {hud.scoped && (
            <div
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6,
              }}
            >
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <mask id="scopeMask">
                    <rect width="100%" height="100%" fill="white" />
                    <circle cx="50%" cy="50%" r="40%" fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="black" mask="url(#scopeMask)" />
                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="black" strokeWidth="1" />
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="black" strokeWidth="1" />
              </svg>
            </div>
          )}

          {/* Top center: round info + timer */}
          <div
            style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              color: '#fff', fontFamily: 'monospace', fontSize: 18,
              background: 'rgba(0,0,0,0.6)', padding: '6px 16px', zIndex: 5,
              border: '1px solid #555', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 2 }}>ROUND {hud.roundNumber}</div>
            <div>
              <span style={{ color: '#d4a855' }}>T {hud.tScore}</span>
              {' : '}
              <span style={{ color: '#4a7fd4' }}>{hud.ctScore} CT</span>
            </div>
            <div style={{ fontSize: 22, color: hud.roundTimer < 10 ? '#f55' : '#fff' }}>
              {hud.roundState === 'live' ? formatTime(hud.roundTimer) : hud.roundState === 'freeze' ? 'BUY TIME' : 'END'}
            </div>
          </div>

          {/* C4 status */}
          {(hud.bombState === 'active' || hud.bombState === 'planting' || hud.bombState === 'defusing') && (
            <div
              style={{
                position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
                color: hud.bombState === 'active' ? '#f33' : '#ff3',
                fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold',
                background: 'rgba(0,0,0,0.7)', padding: '6px 16px',
                border: `2px solid ${hud.bombState === 'active' ? '#f33' : '#ff3'}`,
                zIndex: 5, textAlign: 'center',
                animation: hud.bombState === 'active' && hud.bombTimer < 10 ? 'blink 0.4s infinite' : undefined,
              }}
            >
              {hud.bombState === 'planting' && `PLANTING... ${hud.bombTimer.toFixed(1)}s`}
              {hud.bombState === 'active' && `💣 ${hud.bombTimer.toFixed(1)}s`}
              {hud.bombState === 'defusing' && `DEFUSING...`}
            </div>
          )}

          {/* Bottom left: HP/Armor */}
          <div
            style={{
              position: 'absolute', bottom: 20, left: 20,
              color: '#fff', fontFamily: 'monospace', zIndex: 5,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7 }}>HEALTH</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: hud.hp > 30 ? '#fff' : '#f44' }}>
              {hud.hp}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {hud.hasHelmet ? 'HELMET' : ''} ARMOR
            </div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7af' }}>
              {hud.armor}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>$ {hud.money}</div>
          </div>

          {/* Bottom right: ammo & weapon */}
          <div
            style={{
              position: 'absolute', bottom: 20, right: 20,
              color: '#fff', fontFamily: 'monospace', textAlign: 'right', zIndex: 5,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.8 }}>{hud.weaponName}</div>
            <div style={{ fontSize: 42, fontWeight: 'bold', lineHeight: 1 }}>
              <span style={{ color: hud.ammoInMag === 0 ? '#f44' : '#fff' }}>{hud.ammoInMag}</span>
              <span style={{ fontSize: 20, opacity: 0.6 }}> / {hud.reserveAmmo}</span>
            </div>
            {hud.reloading && <div style={{ color: '#ff3', fontSize: 14 }}>RELOADING...</div>}
          </div>

          {/* Bottom center: weapon slots */}
          <div
            style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 6, fontFamily: 'monospace', zIndex: 5,
            }}
          >
            {['KNIFE', 'PISTOL', 'PRIMARY'].map((n, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid #555',
                  color: '#ccc',
                  fontSize: 12,
                }}
              >
                <span style={{ opacity: 0.6 }}>{i + 1}</span> {n}
              </div>
            ))}
          </div>

          {/* Top right: killfeed */}
          <div
            style={{
              position: 'absolute', top: 12, right: 12,
              fontFamily: 'monospace', fontSize: 13, zIndex: 5,
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end',
            }}
          >
            {hud.kills.map((k, i) => (
              <div
                key={`${k.time}-${i}`}
                style={{
                  background: 'rgba(0,0,0,0.5)', padding: '3px 10px',
                  display: 'flex', gap: 6, alignItems: 'center',
                  borderLeft: `3px solid ${k.killerTeam === 'T' ? '#d4a855' : '#4a7fd4'}`,
                }}
              >
                <span style={{ color: k.killerTeam === 'T' ? '#d4a855' : '#4a7fd4' }}>{k.killer}</span>
                <span style={{ opacity: 0.6 }}>[{k.weapon === 'c4' ? 'C4' : k.weapon.toUpperCase()}]</span>
                {k.headshot && <span style={{ color: '#f44' }}>HS</span>}
                <span style={{ color: k.victimTeam === 'T' ? '#d4a855' : '#4a7fd4' }}>{k.victim}</span>
              </div>
            ))}
          </div>

          {/* Minimap (corner) */}
          <div
            style={{
              position: 'absolute', top: 12, left: 12,
              background: 'rgba(0,0,0,0.6)', border: '1px solid #555',
              zIndex: 5, padding: 4,
            }}
          >
            <canvas ref={minimapRef} width={180} height={120} style={{ display: 'block' }} />
            <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 2, fontFamily: 'monospace' }}>
              RADAR
            </div>
          </div>

          {/* Death overlay + spectator */}
          {!hud.alive && (
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(80,0,0,0.3)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 4, pointerEvents: 'none',
              }}
            >
              <div style={{ color: '#f44', fontSize: 48, fontFamily: 'monospace', fontWeight: 'bold', textShadow: '2px 2px 0 #000' }}>
                YOU DIED
              </div>
              <div style={{ color: '#fff', fontSize: 14, fontFamily: 'monospace', marginTop: 10 }}>
                Press 1-4 to spectate teammates
              </div>
            </div>
          )}

          {/* Round end banner */}
          {roundEndInfo && (
            <div
              style={{
                position: 'absolute', top: '30%', left: 0, right: 0,
                textAlign: 'center', zIndex: 8, pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  background: 'rgba(0,0,0,0.8)',
                  padding: '20px 48px',
                  border: `3px solid ${roundEndInfo.winner === 'T' ? '#d4a855' : '#4a7fd4'}`,
                }}
              >
                <div style={{ fontSize: 42, color: roundEndInfo.winner === 'T' ? '#d4a855' : '#4a7fd4', fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {roundEndInfo.winner === 'T' ? 'TERRORISTS WIN' : 'COUNTER-TERRORISTS WIN'}
                </div>
                <div style={{ fontSize: 18, color: '#fff', fontFamily: 'monospace', marginTop: 8 }}>
                  {roundEndInfo.reason}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={returnToMenu}
            style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              background: 'transparent', color: '#888', border: '1px solid #555',
              padding: '4px 12px', fontFamily: 'monospace', fontSize: 11,
              cursor: 'pointer', zIndex: 9, marginTop: 60,
            }}
          >
            DISCONNECT (MENU)
          </button>
        </>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default App;
