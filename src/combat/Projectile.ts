import type { Sys } from '../data/types';
import { ARENA, BUDGET } from '../data/constants';
import { clamp } from '../core/math';

/**
 * 敌方飞行物（wiki 03-敌人AI与行为 §二 / 03-战斗总纲 性能预算 ≤60）：
 * - circle：T5 鱼叉（直线弹，可被刀摧毁）
 * - rect：T10 剑气（长矩形、穿透、可躲不可挡——不可被刀摧毁）
 */
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shape: 'circle' | 'rect';
  /** circle：半径；rect：半宽（横向） */
  radius: number;
  /** rect：半长（沿运动方向） */
  halfLen: number;
  /** rect：朝向（弧度，= atan2(vy,vx)） */
  angle: number;
  damage: number;
  /** 是否可被刀摧毁（T5 true / T10 false） */
  destructible: boolean;
  life: number;
  ownerUid: number;
  sys: Sys;
  alive: boolean;
  /** 已命中玩家标记（穿透弹防同帧重复判定） */
  hitPlayer: boolean;
}

export function spawnCircleProjectile(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  speed: number,
  radius: number,
  damage: number,
  ownerUid: number,
  sys: Sys,
): Projectile {
  const d = Math.hypot(dirX, dirY) || 1;
  return {
    x,
    y,
    vx: (dirX / d) * speed,
    vy: (dirY / d) * speed,
    shape: 'circle',
    radius,
    halfLen: 0,
    angle: 0,
    damage,
    destructible: true,
    life: 4,
    ownerUid,
    sys,
    alive: true,
    hitPlayer: false,
  };
}

export function spawnSwordWave(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  speed: number,
  halfLen: number,
  halfWidth: number,
  damage: number,
  ownerUid: number,
  sys: Sys,
): Projectile {
  const d = Math.hypot(dirX, dirY) || 1;
  const angle = Math.atan2(dirY / d, dirX / d);
  return {
    x,
    y,
    vx: (dirX / d) * speed,
    vy: (dirY / d) * speed,
    shape: 'rect',
    radius: halfWidth,
    halfLen,
    angle,
    damage,
    destructible: false,
    life: 3,
    ownerUid,
    sys,
    alive: true,
    hitPlayer: false,
  };
}

/** 弹幕推进 + 出界回收；返回仍存活 */
export function updateProjectile(p: Projectile, dt: number): boolean {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.life -= dt;
  // 竞技场外扩 3u 回收（长矩形剑气按半长外扩）
  const pad = 3 + p.halfLen;
  if (p.life <= 0 || p.x < -pad || p.x > ARENA.w + pad || p.y < -pad || p.y > ARENA.h + pad) {
    p.alive = false;
    return false;
  }
  return true;
}

/** 玩家圆 vs 弹幕命中（circle：圆-圆；rect：点转局部系的矩形-圆） */
export function projectileHitsPlayer(p: Projectile, px: number, py: number, pr: number): boolean {
  if (p.shape === 'circle') {
    const dx = p.x - px;
    const dy = p.y - py;
    return dx * dx + dy * dy < (p.radius + pr) ** 2;
  }
  // rect：玩家点转到弹幕局部系（长轴 = 运动方向）
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const dx = px - p.x;
  const dy = py - p.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return Math.abs(lx) < p.halfLen + pr && Math.abs(ly) < p.radius + pr;
}

/** 弹幕飞行预算检查（wiki 60fps 预算：飞行物 ≤60） */
export function projectileBudgetReached(count: number): boolean {
  return count >= BUDGET.maxProjectiles;
}

/** 弹幕朝玩家方向单位向量（供 AI 生成） */
export function aimAt(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

/** 出界 clamp 工具（冲锋/移动复用） */
export function clampArena(x: number, y: number, r: number): { x: number; y: number } {
  return { x: clamp(x, r, ARENA.w - r), y: clamp(y, r, ARENA.h - r) };
}
