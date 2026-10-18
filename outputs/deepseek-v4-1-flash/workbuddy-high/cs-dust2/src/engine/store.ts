import type { HudState } from './types';

/**
 * 引擎到 React 的单向状态通道。引擎每帧写入快照（引用不变则跳过），
 * React 侧用 useSyncExternalStore 订阅，从而把 3D 渲染循环与组件生命周期解耦。
 */
export type Listener = () => void;

let snapshot: HudState | null = null;
const listeners = new Set<Listener>();

export function publish(next: HudState): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): HudState | null {
  return snapshot;
}
