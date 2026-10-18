import { PathFollower } from './nav';
import { weaponOf } from './entity';
import type { AiWorld, Entity } from './entity';
import type { Team } from '../engine/types';

/**
 * AI 状态机：巡逻 → 索敌交战 → 执行目标（进攻方推包安放 / 防守方回防拆除）。
 * 视野判定基于地图遮挡（被墙挡住看不见就被挡住），寻路使用网格 A*，卡住时会重算路径。
 */
export type BotState = 'patrol' | 'engage' | 'advance' | 'plant' | 'defuse' | 'hold' | 'dead';

const VIEW_RANGE = 62;
const FOV = Math.PI * 0.42;

export class BotBrain {
  state: BotState = 'patrol';
  readonly team: Team;
  private readonly follow = new PathFollower();
  private targetId = -1;
  private lostSightFor = 0;
  private readonly reaction: number;
  private aimError = { x: 0, y: 0 };
  private aimTimer = 0;
  private readonly skill: number;
  private advanceTimer = 0;
  private holdPoint: { x: number; z: number } | null = null;
  private strafeSign = 1;
  private strafeTimer = 0;
  /** 进入当前交战目标后的累计时间，用于反应延迟。 */
  private engageTime = 0;
  private burstLeft = 0;
  private burstPause = 0;
  private lastPos = { x: 0, z: 0 };
  private stuckTimer = 0;
  private readonly seed: number;

  constructor(team: Team, skillSeed: number) {
    this.team = team;
    this.seed = skillSeed;
    this.skill = 0.55 + (skillSeed % 100) / 100 * 0.4;
    this.reaction = 0.42 - this.skill * 0.26;
  }

  reset(): void {
    this.state = 'patrol';
    this.follow.clear();
    this.targetId = -1;
    this.lostSightFor = 0;
    this.holdPoint = null;
    this.advanceTimer = 0;
  }

  /** 每帧由引擎调用。bot 自己负责瞄准、移动意图与开火节奏。 */
  tick(bot: Entity, dt: number, world: AiWorld): void {
    if (!bot.alive) {
      this.state = 'dead';
      return;
    }
    this.follow.tick(dt);
    this.aimTimer -= dt;
    this.strafeTimer -= dt;
    this.advanceTimer -= dt;
    this.trackStuck(bot, dt);

    const enemy = this.acquire(bot, world);
    if (enemy) {
      if (this.targetId !== enemy.id) this.engageTime = 0;
      this.targetId = enemy.id;
      this.lostSightFor = 0;
      this.state = 'engage';
      this.engage(bot, dt, world, enemy);
      return;
    }
    if (this.targetId >= 0) {
      this.lostSightFor += dt;
      if (this.lostSightFor > 1.1) this.targetId = -1;
    }
    this.patrol(bot, dt, world);
  }

  private acquire(bot: Entity, world: AiWorld): Entity | null {
    const eye = { x: bot.pos.x, y: bot.pos.y + 1.6, z: bot.pos.z };
    let best: Entity | null = null;
    let bestScore = Infinity;
    // 已在交战中且目标仍可见 → 保持锁定，避免来回切换
    if (this.targetId >= 0) {
      const kept = world.enemiesOf(this.team).find((t) => t.id === this.targetId);
      if (kept && kept.alive) {
        const to = { x: kept.x, y: kept.y + 1.4, z: kept.z };
        if (this.canSee(bot, eye, to, world)) return world.byId(kept.id);
      }
    }
    for (const t of world.enemiesOf(this.team)) {
      if (!t.alive) continue;
      const dx = t.x - bot.pos.x;
      const dz = t.z - bot.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > VIEW_RANGE) continue;
      const ang = Math.abs(angleDiff(Math.atan2(-dx, -dz), bot.yaw));
      if (ang > FOV) continue;
      const to = { x: t.x, y: t.y + 1.4, z: t.z };
      if (!this.canSee(bot, eye, to, world)) continue;
      const score = dist + ang * 12;
      if (score < bestScore) {
        bestScore = score;
        best = world.byId(t.id);
      }
    }
    return best;
  }

  private canSee(
    bot: Entity,
    eye: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    world: AiWorld
  ): boolean {
    void bot;
    return world.hasLineOfSight(eye, to);
  }

  /** 交战：转向、走位、按武器节奏点射。 */
  private engage(bot: Entity, dt: number, world: AiWorld, enemy: Entity): void {
    this.engageTime += dt;
    const dx = enemy.pos.x - bot.pos.x;
    const dz = enemy.pos.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(-dx, -dz);
    const headY = enemy.pos.y + 1.72;
    const wantPitch = Math.atan2(headY - (bot.pos.y + 1.6), dist);

    if (this.aimTimer <= 0) {
      const jitter = (1 - this.skill) * 0.055;
      this.aimError.y = (Math.random() - 0.5) * jitter;
      this.aimError.x = (Math.random() - 0.5) * jitter * 0.6;
      this.aimTimer = 0.16;
    }
    bot.yaw = angleTowards(bot.yaw, wantYaw + this.aimError.y, dt * (5 + this.skill * 9));
    bot.pitch = clampPitch(angleTowards(bot.pitch, wantPitch + this.aimError.x, dt * (5 + this.skill * 9)));

    // 交战时横向走位，避免站桩
    if (this.strafeTimer <= 0) {
      this.strafeSign = Math.random() < 0.5 ? -1 : 1;
      this.strafeTimer = 0.5 + Math.random() * 0.8;
    }
    const w = weaponOf(bot);
    const holdStill = !w || w.id === 'awp' || dist > 34;
    const perpX = Math.cos(bot.yaw) * this.strafeSign;
    const perpZ = -Math.sin(bot.yaw) * this.strafeSign;
    const fwd = holdStill ? 0 : dist > 16 ? 0.6 : dist < 7 ? -0.5 : 0.12;
    bot.vel.x = (perpX * 3.1 + -Math.sin(bot.yaw) * fwd * 3.4);
    bot.vel.z = (perpZ * 3.1 + -Math.cos(bot.yaw) * fwd * 3.4);

    // 开火节奏
    if (this.engageTime < this.reaction) return;
    const t = world.now();
    if (t < bot.nextFireAt || bot.reloadLeft > 0 || bot.deployLeft > 0) return;
    const ammo = bot.ammo[bot.activeSlot === 'melee' ? 'knife' : bot.weapons[bot.activeSlot] ?? ''];
    if (!w || w.slot === 'melee' || dist < 2.4) {
      if (dist < 2.4) world.meleeAttack(bot);
      return;
    }
    if (!ammo || ammo.mag <= 0) {
      // 打空 → 换弹或切副武器
      if (ammo && ammo.reserve > 0) bot.reloadLeft = w.reloadTime;
      else if (bot.weapons.secondary) bot.activeSlot = 'secondary';
      return;
    }
    const rpmInterval = 60 / w.rpm;
    if (w.auto) {
      if (this.burstPause > 0) {
        this.burstPause -= dt;
        return;
      }
      if (this.burstLeft <= 0) {
        this.burstLeft = 3 + Math.floor(this.skill * 4);
      }
      this.burstLeft--;
      if (this.burstLeft <= 0) this.burstPause = 0.16 + Math.random() * 0.2;
      bot.nextFireAt = t + Math.max(rpmInterval, 0.075);
      world.fire(bot);
    } else {
      if (dist > 3 && Math.abs(angleDiff(bot.yaw, wantYaw)) < 0.045) {
        bot.nextFireAt = t + rpmInterval;
        world.fire(bot);
      }
    }
  }

  /** 巡逻 / 执行目标。 */
  private patrol(bot: Entity, dt: number, world: AiWorld): void {
    const objective = world.objectiveFor(this.team);
    const c4 = world.c4Target();

    // 防守方在已下包时前往拆包，进攻方持包且已在包点则安放
    if (c4 && this.team === 'CT') {
      this.state = 'defuse';
      this.moveTo(bot, dt, world, c4.x, c4.z, 8.4);
      return;
    }
    if (this.team === 'T' && bot.hasC4) {
      const site = world.objectiveFor('T');
      const d = Math.hypot(bot.pos.x - site.x, bot.pos.z - site.z);
      if (d < 8) {
        this.state = 'plant';
        bot.vel.set(0, 0, 0);
        return;
      }
      this.state = 'advance';
      this.moveTo(bot, dt, world, site.x, site.z, 6.4);
      return;
    }

    // 未接敌时按巡逻点推进：进攻方走向目标，防守方在目标附近站位
    this.state = this.team === 'T' ? 'advance' : 'hold';
    if (this.team === 'T') {
      if (this.follow.done || !this.follow.current) {
        this.follow.repath(bot.pos.x, bot.pos.z, objective.x, objective.z, 1.2);
      }
    } else {
      if (this.holdPoint && Math.hypot(bot.pos.x - this.holdPoint.x, bot.pos.z - this.holdPoint.z) > 6) {
        if (this.follow.done) this.follow.repath(bot.pos.x, bot.pos.z, this.holdPoint.x, this.holdPoint.z, 1.6);
      } else if (this.follow.done && this.advanceTimer <= 0) {
        const pts = world.patrolPoints();
        const near = pointsNear(pts, objective, 40);
        const pick = near[Math.floor(Math.random() * near.length)] ?? objective;
        this.holdPoint = pick;
        this.follow.repath(bot.pos.x, bot.pos.z, pick.x, pick.z, 1.6);
        this.advanceTimer = 3.5 + Math.random() * 3;
      }
    }
    this.followStep(bot, dt, this.team === 'T' ? 6.2 : 4.6);
  }

  private moveTo(bot: Entity, dt: number, world: AiWorld, x: number, z: number, speed: number): void {
    if (this.follow.done || !this.follow.current) {
      if (this.follow.canRepath()) this.follow.repath(bot.pos.x, bot.pos.z, x, z, 1.4);
    }
    this.followStep(bot, dt, speed);
    void world;
  }

  private followStep(bot: Entity, dt: number, speed: number): void {
    const p = this.follow.current;
    if (!p) {
      bot.vel.set(0, 0, 0);
      return;
    }
    const dx = p.x - bot.pos.x;
    const dz = p.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.2) {
      this.follow.advance();
      return;
    }
    const wantYaw = Math.atan2(-dx, -dz);
    bot.yaw = angleTowards(bot.yaw, wantYaw, dt * 6);
    bot.vel.x = (dx / dist) * speed;
    bot.vel.z = (dz / dist) * speed;
    bot.pitch = angleTowards(bot.pitch, 0, dt * 2);
  }

  private trackStuck(bot: Entity, dt: number): void {
    const moved = Math.hypot(bot.pos.x - this.lastPos.x, bot.pos.z - this.lastPos.z);
    this.lastPos = { x: bot.pos.x, z: bot.pos.z };
    if (moved < 0.012 && (bot.vel.x || bot.vel.z)) this.stuckTimer += dt;
    else this.stuckTimer = 0;
    if (this.stuckTimer > 0.6) {
      this.follow.clear();
      this.follow.repath(bot.pos.x, bot.pos.z, bot.pos.x + (Math.random() - 0.5) * 20, bot.pos.z + (Math.random() - 0.5) * 20, 0.5);
      this.stuckTimer = 0;
    }
  }

  get seedOf(): number {
    return this.seed;
  }
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function angleTowards(cur: number, target: number, maxStep: number): number {
  const d = angleDiff(target, cur);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

function clampPitch(p: number): number {
  const lim = Math.PI / 2 - 0.02;
  return Math.max(-lim, Math.min(lim, p));
}

function pointsNear(
  pts: { x: number; z: number }[],
  target: { x: number; z: number },
  radius: number
): { x: number; z: number }[] {
  const near = pts.filter((p) => Math.hypot(p.x - target.x, p.z - target.z) < radius);
  return near.length ? near : [target];
}
