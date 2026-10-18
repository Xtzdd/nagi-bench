import type { Team } from '../engine/types';

export type Phase = 'freeze' | 'live' | 'planted' | 'over';
export type C4State = 'carried' | 'dropped' | 'planted' | 'none';

export const FREEZE_TIME = 4;
export const ROUND_TIME = 115;
export const PLANT_TIME = 3.2;
export const BOMB_TIME = 40;
export const DEFUSE_TIME = 10;
export const DEFUSE_TIME_KIT = 5;

export interface RoundHooks {
  onPlant: (x: number, z: number) => void;
  onDefused: () => void;
  onExploded: () => void;
  onRoundEnd: (winner: Team, reason: string) => void;
  onPhase: (phase: Phase) => void;
  onTick: (phase: Phase, remaining: number) => void;
}

/**
 * 回合与 C4 状态机。只做规则判定，副作用通过 hooks 抛出，便于单独推演。
 *
 * 胜负：
 *  - T：清空 CT，或 C4 爆炸
 *  - CT：在未下包时清空 T，或成功拆包
 *  - 已下包后即使 T 全灭，回合仍继续（CT 必须拆包）
 */
export class RoundSystem {
  phase: Phase = 'freeze';
  round = 1;
  score: { CT: number; T: number } = { CT: 0, T: 0 };
  /** 冻结期倒计时 / 回合剩余时间 / 已下包的爆炸倒计时。 */
  timer = FREEZE_TIME;
  c4State: C4State = 'none';
  c4X = 0;
  c4Z = 0;
  c4Carrier: number | null = null;
  bombTimer = BOMB_TIME;
  plantProgress = 0;
  defuseProgress = 0;
  private ended = false;
  private readonly hooks: RoundHooks;

  constructor(hooks: RoundHooks) {
    this.hooks = hooks;
  }

  get isPistolRound(): boolean {
    return this.round === 1;
  }

  /** 新回合初始化。carrierId 为本回合的持包 T。 */
  startRound(carrierId: number | null): void {
    this.phase = 'freeze';
    this.timer = FREEZE_TIME;
    this.c4State = carrierId === null ? 'none' : 'carried';
    this.c4Carrier = carrierId;
    this.bombTimer = BOMB_TIME;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.ended = false;
    this.hooks.onPhase('freeze');
  }

  goLive(): void {
    this.phase = 'live';
    this.timer = ROUND_TIME;
    this.hooks.onPhase('live');
  }

  /** 持包者阵亡：掉包。 */
  dropC4(x: number, z: number): void {
    if (this.c4State === 'carried') {
      this.c4State = 'dropped';
      this.c4Carrier = null;
      this.c4X = x;
      this.c4Z = z;
    }
  }

  pickUpC4(id: number): void {
    if (this.c4State === 'dropped') {
      this.c4State = 'carried';
      this.c4Carrier = id;
    }
  }

  /** 推进安放进度；canPlant 为「持包且站在包点内」且按住安放键。 */
  tickPlant(dt: number, canPlant: boolean): boolean {
    if (this.phase !== 'live') {
      this.plantProgress = 0;
      return false;
    }
    if (!canPlant) {
      this.plantProgress = Math.max(0, this.plantProgress - dt * 2);
      return false;
    }
    this.plantProgress += dt;
    if (this.plantProgress >= PLANT_TIME) {
      this.plantProgress = PLANT_TIME;
      this.c4State = 'planted';
      this.c4Carrier = null;
      this.phase = 'planted';
      this.bombTimer = BOMB_TIME;
      this.timer = BOMB_TIME;
      this.hooks.onPlant(this.c4X, this.c4Z);
      this.hooks.onPhase('planted');
      return true;
    }
    return false;
  }

  /** 推进拆包进度；near 为「CT 站在已下包的 C4 处」且按住拆包键。 */
  tickDefuse(dt: number, near: boolean, hasKit: boolean): boolean {
    if (this.phase !== 'planted' || this.c4State !== 'planted') {
      this.defuseProgress = 0;
      return false;
    }
    if (!near) {
      this.defuseProgress = Math.max(0, this.defuseProgress - dt * 2.5);
      return false;
    }
    const need = hasKit ? DEFUSE_TIME_KIT : DEFUSE_TIME;
    this.defuseProgress += dt;
    if (this.defuseProgress >= need) {
      this.c4State = 'none';
      this.defuseProgress = need;
      this.finish('CT', '拆包成功');
      this.hooks.onDefused();
      return true;
    }
    return false;
  }

  /** 每帧推进计时与爆炸判定。 */
  tick(dt: number, aliveCT: number, aliveT: number): void {
    if (this.ended) return;

    if (this.phase === 'freeze') {
      this.timer -= dt;
      if (this.timer <= 0) this.goLive();
      this.hooks.onTick(this.phase, Math.max(0, this.timer));
      return;
    }

    if (this.phase === 'live') {
      this.timer -= dt;
      if (aliveT === 0) {
        this.finish('CT', '清空敌方');
        return;
      }
      if (aliveCT === 0) {
        this.finish('T', '清空敌方');
        return;
      }
      if (this.timer <= 0) this.finish('CT', '时间耗尽');
      this.hooks.onTick(this.phase, Math.max(0, this.timer));
      return;
    }

    if (this.phase === 'planted') {
      this.bombTimer -= dt;
      this.timer = this.bombTimer;
      // 已下包：CT 全灭即 T 胜（无需等爆炸）；T 全灭则回合继续，CT 必须拆包
      if (aliveCT === 0) {
        this.finish('T', 'C4 已安放 · 清空 CT');
        return;
      }
      if (this.bombTimer <= 0) {
        this.finish('T', 'C4 爆炸');
        this.hooks.onExploded();
        return;
      }
      this.hooks.onTick(this.phase, Math.max(0, this.bombTimer));
    }
  }

  private finish(winner: Team, reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'over';
    this.score[winner] += 1;
    this.hooks.onPhase('over');
    this.hooks.onRoundEnd(winner, reason);
  }
}
