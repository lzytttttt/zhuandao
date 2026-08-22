import { ARENA, ENEMY_AI, PLAYER } from '../data/constants';
import type { EnemyTpl } from '../data/types';
import { clamp } from '../core/math';
import type { Rng } from '../core/Rng';
import type { Enemy } from './Enemy';
import type { Hazard, } from './Hazard';
import { createHazard } from './Hazard';
import type { Projectile } from './Projectile';
import { aimAt, spawnCircleProjectile, spawnSwordWave } from './Projectile';

/**
 * 敌人行为模板 T1-T10（wiki 03-敌人AI与行为 §一/§二/§四）。
 * 纯逻辑：由 CombatWorld 每帧驱动（tools 模拟器共用）。
 * 通用规则（wiki §一）：
 * - 所有攻击前摇 ≥0.5s（走位可躲）；
 * - 松散包围（近战目标点 = 玩家 + 槽位角度偏移，防死角挂机）；
 * - 远程主动保持射程（玩家逼近时后撤）；
 * - T3 在玩家静止超时优先冲锋（惩罚挂机）。
 */

/** AI 所需的世界视图（CombatWorld 结构化实现，避免循环依赖） */
export interface AIWorldView {
  readonly player: { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number };
  /** 玩家静止持续时长（速度 < 0.5 u/s 累计；T3 防挂机判定） */
  readonly playerStillT: number;
  readonly rng: Rng;
  /** 造成玩家伤害；返回是否实际命中（无敌帧闪避 = false） */
  damagePlayer(amount: number): boolean;
  spawnProjectile(p: Projectile): void;
  spawnHazard(h: Hazard): void;
}

export function updateEnemy(e: Enemy, w: AIWorldView, dt: number): void {
  if (!e.alive) return;
  e.tickFeedback(dt);
  e.updateBarrier(dt);
  if (e.atkCd > 0) e.atkCd -= dt;
  e.decisionT += dt;

  // 击退位移（独立于相位，衰减在 tickFeedback）
  e.x += e.kx * dt;
  e.y += e.ky * dt;

  e.phaseT += dt;

  switch (e.phase) {
    case 'enter':
      // 入场淡入（波次演出）：不再移动，淡入完进入追击
      facePlayer(e, w);
      if (e.fadeT <= 0) {
        e.phase = 'chase';
        e.phaseT = 0;
      }
      break;
    case 'chase':
      chaseTick(e, w, dt);
      break;
    case 'windup':
      windupTick(e, w, dt);
      break;
    case 'recover':
      facePlayer(e, w);
      if (e.phaseT >= 0.3) {
        e.phase = 'chase';
        e.phaseT = 0;
      }
      break;
    case 'chargeWindup':
      // 蓄力 0.8s：方向已锁定，演出抖动由渲染层表现
      if (e.phaseT >= ENEMY_AI.T3.windup) {
        e.phase = 'charging';
        e.phaseT = 0;
      }
      break;
    case 'charging':
      chargingTick(e, w, dt);
      break;
    case 'stunned':
      if (e.phaseT >= ENEMY_AI.T3.stun) {
        e.phase = 'chase';
        e.phaseT = 0;
      }
      break;
    case 'fusing':
      fusingTick(e, w);
      break;
    case 'combo':
      comboTick(e, w, dt);
      break;
  }
}

// ---------------- 相位实现 ----------------

function chaseTick(e: Enemy, w: AIWorldView, dt: number): void {
  const p = w.player;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  facePlayer(e, w);

  switch (e.type.tpl) {
    case 'T1':
    case 'T2':
    case 'T4':
    case 'T7': {
      // 松散包围（wiki §四）：目标点 = 玩家 + 槽位角 × surroundRadius
      const tx = p.x + Math.cos(e.slotAngle) * ENEMY_AI.surroundRadius;
      const ty = p.y + Math.sin(e.slotAngle) * ENEMY_AI.surroundRadius;
      moveTo(e, w, tx, ty, dt);
      const cfg = meleeCfg(e.type.tpl);
      if (dist < cfg.range && e.atkCd <= 0) {
        e.phase = 'windup';
        e.phaseT = 0;
      }
      break;
    }
    case 'T3': {
      // 冲锋兵直奔玩家（不松散）；距离/挂机条件触发蓄力
      moveTo(e, w, p.x, p.y, dt);
      const t3 = ENEMY_AI.T3;
      const inRange = dist >= t3.chargeMinDist && dist <= t3.chargeMaxDist;
      const punishIdle = w.playerStillT >= t3.idleTrigger;
      if (e.atkCd <= 0 && (inRange || punishIdle) && dist > e.radius + PLAYER.radius + ENEMY_AI.contactPad) {
        const dir = aimAt(e.x, e.y, p.x, p.y);
        e.chargeDirX = dir.x;
        e.chargeDirY = dir.y;
        e.chargeLeft = t3.chargeTime;
        e.chargeHit = false;
        e.facing = Math.atan2(dir.y, dir.x);
        e.phase = 'chargeWindup';
        e.phaseT = 0;
      }
      break;
    }
    case 'T5':
    case 'T6':
    case 'T10': {
      rangedReposition(e, w, dt);
      const cfg = rangedCfg(e.type.tpl);
      if (e.atkCd <= 0 && dist <= cfg.keep + 2.5) {
        e.phase = 'windup';
        e.phaseT = 0;
      }
      break;
    }
    case 'T8': {
      const tx = p.x + Math.cos(e.slotAngle) * ENEMY_AI.surroundRadius;
      const ty = p.y + Math.sin(e.slotAngle) * ENEMY_AI.surroundRadius;
      moveTo(e, w, tx, ty, dt);
      if (dist < ENEMY_AI.T8.aRange && e.atkCd <= 0) {
        // 平A 计数达阈值 → 切三连斩（wiki §二 双模式）
        e.attackMode = e.comboCount >= ENEMY_AI.T8.comboToB ? 'b' : 'a';
        e.phase = 'windup';
        e.phaseT = 0;
      }
      break;
    }
    case 'T9': {
      moveTo(e, w, p.x, p.y, dt);
      if (dist < ENEMY_AI.T9.triggerRange) {
        e.phase = 'fusing';
        e.phaseT = 0;
      }
      break;
    }
  }
}

function windupTick(e: Enemy, w: AIWorldView, dt: number): void {
  const p = w.player;
  facePlayer(e, w);
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  const tpl = e.type.tpl;

  // 远程前摇期间缓慢后撤（wiki §四：玩家逼近时后撤）
  if (tpl === 'T5' || tpl === 'T6' || tpl === 'T10') {
    const away = aimAt(p.x, p.y, e.x, e.y);
    e.x = clamp(e.x + away.x * 1.2 * dt, e.radius, ARENA.w - e.radius);
    e.y = clamp(e.y + away.y * 1.2 * dt, e.radius, ARENA.h - e.radius);
  }

  let windup: number;
  if (tpl === 'T5' || tpl === 'T6' || tpl === 'T10') {
    windup = rangedCfg(tpl).windup;
  } else if (tpl === 'T8') {
    windup = e.attackMode === 'b' ? ENEMY_AI.T8.bWindup : ENEMY_AI.T8.aWindup;
  } else {
    windup = meleeCfg(tpl).windup;
  }
  e.windupTotal = windup;
  if (e.phaseT < windup) return;

  // ---- 判定时刻 ----
  switch (tpl) {
    case 'T5': {
      const dir = aimAt(e.x, e.y, p.x, p.y);
      w.spawnProjectile(
        spawnCircleProjectile(
          e.x + dir.x * (e.radius + 0.2),
          e.y + dir.y * (e.radius + 0.2),
          dir.x,
          dir.y,
          ENEMY_AI.T5.projSpeed,
          ENEMY_AI.T5.projRadius,
          e.atk,
          e.uid,
          e.type.sys,
        ),
      );
      e.atkCd = ENEMY_AI.T5.cooldown * e.cooldownMult;
      break;
    }
    case 'T6': {
      // 毒圈放在玩家移动路径前方（wiki §二：玩家路径上）
      const speed = Math.hypot(p.vx, p.vy);
      const t6 = ENEMY_AI.T6;
      const lx = speed > 0.5 ? (p.vx / speed) * t6.lead : 0;
      const ly = speed > 0.5 ? (p.vy / speed) * t6.lead : 0;
      w.spawnHazard(
        createHazard(p.x + lx, p.y + ly, t6.hazardRadius, e.atk * t6.hazardDpsMult, t6.hazardDuration),
      );
      e.atkCd = t6.cooldown * e.cooldownMult;
      break;
    }
    case 'T10': {
      const dir = aimAt(e.x, e.y, p.x, p.y);
      const t10 = ENEMY_AI.T10;
      w.spawnProjectile(
        spawnSwordWave(
          e.x + dir.x * (e.radius + 0.4),
          e.y + dir.y * (e.radius + 0.4),
          dir.x,
          dir.y,
          t10.swordSpeed,
          t10.swordLength / 2,
          t10.swordWidth / 2,
          e.atk,
          e.uid,
          e.type.sys,
        ),
      );
      e.atkCd = t10.cooldown * e.cooldownMult;
      break;
    }
    case 'T8': {
      if (e.attackMode === 'b') {
        e.comboLeft = ENEMY_AI.T8.bHits;
        e.comboT = 0;
        e.phase = 'combo';
        e.phaseT = 0;
        return;
      }
      if (dist < ENEMY_AI.T8.aRange + 0.35) w.damagePlayer(e.atk);
      e.comboCount++;
      e.atkCd = ENEMY_AI.T8.aCooldown * e.cooldownMult;
      break;
    }
    default: {
      const cfg = meleeCfg(tpl);
      if (dist < cfg.range + 0.35) w.damagePlayer(e.atk);
      e.atkCd = cfg.cooldown * e.cooldownMult;
    }
  }
  e.phase = 'recover';
  e.phaseT = 0;
}

/** T3 冲锋：直线冲刺；撞墙/冲完硬直；途中撞玩家造成伤害 */
function chargingTick(e: Enemy, w: AIWorldView, dt: number): void {
  const t3 = ENEMY_AI.T3;
  const nextX = e.x + e.chargeDirX * t3.chargeSpeed * dt;
  const nextY = e.y + e.chargeDirY * t3.chargeSpeed * dt;
  const cx = clamp(nextX, e.radius, ARENA.w - e.radius);
  const cy = clamp(nextY, e.radius, ARENA.h - e.radius);
  const hitWall = Math.abs(cx - nextX) > 1e-6 || Math.abs(cy - nextY) > 1e-6;
  e.x = cx;
  e.y = cy;
  e.chargeLeft -= dt;

  const p = w.player;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  if (dist < e.radius + PLAYER.radius + ENEMY_AI.contactPad + 0.1) {
    // 命中才置位（无敌帧闪避成功则下帧仍有机会，直到冲锋结束）
    if (w.damagePlayer(e.atk)) e.chargeHit = true;
  }

  if (hitWall || e.chargeLeft <= 0) {
    e.phase = 'stunned';
    e.phaseT = 0;
    e.atkCd = t3.cooldown * e.cooldownMult;
  }
}

/** T9 自爆：引信结束 → AoE 判定 → 自毁（不掉落） */
function fusingTick(e: Enemy, w: AIWorldView): void {
  facePlayer(e, w);
  if (e.phaseT < ENEMY_AI.T9.fuse) return;
  const p = w.player;
  const dist = Math.hypot(p.x - e.x, p.y - e.y);
  if (dist < ENEMY_AI.T9.blastRadius + PLAYER.radius) {
    w.damagePlayer(e.atk * ENEMY_AI.T9.blastMult);
  }
  e.selfDestructed = true;
  e.alive = false;
}

/** T8 三连斩：每 bHitGap 一段判定，贴身追击 */
function comboTick(e: Enemy, w: AIWorldView, dt: number): void {
  const p = w.player;
  facePlayer(e, w);
  moveTo(e, w, p.x, p.y, dt);
  e.comboT += dt;
  if (e.comboT >= ENEMY_AI.T8.bHitGap) {
    e.comboT -= ENEMY_AI.T8.bHitGap;
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    if (dist < ENEMY_AI.T8.bRange + 0.3) w.damagePlayer(e.atk * ENEMY_AI.T8.bDmgMult);
    e.comboLeft--;
    if (e.comboLeft <= 0) {
      e.comboCount = 0;
      e.attackMode = 'a';
      e.atkCd = ENEMY_AI.T8.bCooldown * e.cooldownMult;
      e.phase = 'recover';
      e.phaseT = 0;
    }
  }
}

/** 远程拉扯（T5/T6/T10，wiki §四：主动保持射程） */
function rangedReposition(e: Enemy, w: AIWorldView, dt: number): void {
  const p = w.player;
  const cfg = rangedCfg(e.type.tpl);
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const dist = Math.hypot(dx, dy) || 1;

  // 环绕角缓慢推进（slotAngle 在远程模板中 = 环绕累积角）
  e.slotAngle += e.strafeDir * 0.5 * dt;
  // 决策节流：小概率换环绕方向（wiki §一 0.2s 决策循环）
  if (e.decisionT >= ENEMY_AI.decisionInterval) {
    e.decisionT = 0;
    if (w.rng.chance(0.15)) e.strafeDir = e.strafeDir === 1 ? -1 : 1;
  }

  if (dist > cfg.approach) {
    // 太远：追近（直奔）
    moveTo(e, w, p.x, p.y, dt);
  } else if (dist < cfg.retreat) {
    // 太近：后撤（沿径向远离）
    const ux = dx / dist;
    const uy = dy / dist;
    moveTo(e, w, e.x + ux * 3, e.y + uy * 3, dt);
  } else {
    // 射程带内：环绕走位
    const tx = p.x + Math.cos(e.slotAngle) * cfg.keep;
    const ty = p.y + Math.sin(e.slotAngle) * cfg.keep;
    moveTo(e, w, tx, ty, dt);
  }
}

// ---------------- 移动工具 ----------------

function moveTo(e: Enemy, w: AIWorldView, tx: number, ty: number, dt: number): void {
  if (e.staggerT > 0) return; // 受击硬直：移动暂停
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return;
  const step = Math.min(d, e.speed * dt);
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
  e.facing = Math.atan2(dy, dx);
  e.x = clamp(e.x, e.radius, ARENA.w - e.radius);
  e.y = clamp(e.y, e.radius, ARENA.h - e.radius);
  separateFromPlayer(e, w);
}

/** 敌-玩家接触推挤：敌不穿入玩家（wiki §一：敌人仅对玩家有推挤、彼此穿过） */
function separateFromPlayer(e: Enemy, w: AIWorldView): void {
  const p = w.player;
  const minD = e.radius + PLAYER.radius + ENEMY_AI.contactPad;
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < minD && d > 0.0001) {
    e.x = p.x + (dx / d) * minD;
    e.y = p.y + (dy / d) * minD;
    e.x = clamp(e.x, e.radius, ARENA.w - e.radius);
    e.y = clamp(e.y, e.radius, ARENA.h - e.radius);
  }
}

function facePlayer(e: Enemy, w: AIWorldView): void {
  const p = w.player;
  e.facing = Math.atan2(p.y - e.y, p.x - e.x);
}

// ---------------- 模板参数 ----------------

interface MeleeCfg {
  windup: number;
  range: number;
  cooldown: number;
}

function meleeCfg(tpl: EnemyTpl): MeleeCfg {
  switch (tpl) {
    case 'T2':
      return ENEMY_AI.T2;
    case 'T4':
      return ENEMY_AI.T4;
    case 'T7':
      return ENEMY_AI.T7;
    default:
      return ENEMY_AI.T1;
  }
}

interface RangedCfg {
  windup: number;
  cooldown: number;
  keep: number;
  retreat: number;
  approach: number;
}

function rangedCfg(tpl: EnemyTpl): RangedCfg {
  switch (tpl) {
    case 'T6':
      return ENEMY_AI.T6;
    case 'T10':
      return ENEMY_AI.T10;
    default:
      return ENEMY_AI.T5;
  }
}
