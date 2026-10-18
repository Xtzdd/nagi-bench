import type { HudState } from '../engine/types';

interface Props {
  state: HudState | null;
  started: boolean;
  locked: boolean;
  onStart: () => void;
  onResume: () => void;
}

export function Menus({ state, started, locked, onStart, onResume }: Props) {
  if (!started) {
    return (
      <div className="menu">
        <div className="card">
          <h1>DUST2 · 5v5</h1>
          <p>程序化生成的地图、角色与武器 · 无任何外部模型或贴图 · 音效由 Web Audio 实时合成</p>
          <p style={{ marginTop: 14 }}>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> 移动 &nbsp; <kbd>空格</kbd> 跳跃 &nbsp; <kbd>Shift</kbd> 潜行 &nbsp;
            <kbd>鼠标</kbd> 环视
          </p>
          <p>
            <kbd>左键</kbd> 开火 &nbsp; <kbd>右键</kbd> AWP 开镜 &nbsp; <kbd>R</kbd> 换弹 &nbsp;
            <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd> 切换主/副/刀 &nbsp; <kbd>E</kbd> 安放或拆除 C4
          </p>
          <p>
            <kbd>Q</kbd> 切换队友视角 &nbsp; <kbd>F</kbd> 接管操控 &nbsp; <kbd>Esc</kbd> 释放鼠标
          </p>
          <button onClick={onStart}>开始对战</button>
        </div>
      </div>
    );
  }

  if (!locked) {
    const done = state?.phase === 'over';
    return (
      <div className="menu" onClick={onResume}>
        <div className="card">
          {done ? (
            <>
              <h2>{state?.message}</h2>
              <div className="score">
                <div>
                  CT <b className="ct">{state?.score.CT}</b>
                </div>
                <div>
                  T <b className="t">{state?.score.T}</b>
                </div>
              </div>
              <p>下一回合将在数秒后开始</p>
            </>
          ) : (
            <>
              <h1>已暂停</h1>
              <p>{state?.message ?? ''}</p>
            </>
          )}
          <button onClick={onResume}>点击继续</button>
        </div>
      </div>
    );
  }
  return null;
}
