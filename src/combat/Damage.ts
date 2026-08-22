import type { Rng } from '../core/Rng';
import { COUNTER_RING, DAMAGE, ELEMENT } from '../data/constants';
import type { Sys } from '../data/types';
import { clamp } from '../core/math';

/**
 * 伤害公式（wiki 03-伤害公式，纯函数）：
 * 最终伤害 = 基础伤害 × 部位系数 × (1+速度加成) × 暴击 × 属性克制 × (1−DR) × 全局系数
 * 返回完整乘区分解，供测试场打印与数值对表。
 */

export type HitPart = 'body' | 'tip';

export interface DamageRollInput {
  /** A_dao（实例面板，词缀/羁绊加成后） */
  atk: number;
  part: HitPart;
  /** 该刀实际自旋/公转（圈/s，词缀修正后） */
  spin: number;
  orbit: number;
  /** 玩家有效移动速度（u/s，0~6） */
  playerSpeed: number;
  /** 暴击率（基础 0.05 + 词缀/羁绊） */
  critChance: number;
  /** 暴伤（基础 1.5 + 词缀） */
  critMult: number;
  knifeSys: Sys;
  enemySys: Sys;
  enemyArmor: number;
}

export interface DamageBreakdown {
  damage: number;
  part: HitPart;
  partMult: number;
  /** 相对速度加成（−0.10 ~ +0.30，v1.3 公式） */
  vBonus: number;
  crit: boolean;
  critMult: number;
  counterMult: number;
  /** 克制关系标记 */
  counterLabel: '克' | '被克' | '—';
  /** 敌方护甲减伤率 */
  dr: number;
}

export function rollDamage(input: DamageRollInput, rng: Rng): DamageBreakdown {
  // 1. 部位系数（刀身 1.0 / 刀尖 1.6）
  const partMult = input.part === 'tip' ? DAMAGE.tipFactor : DAMAGE.bodyFactor;

  // 2. 相对速度加成（v1.3：半径不参与；轻刀吃满）
  const v = DAMAGE.vDamage;
  const vBonus = clamp(
    (input.spin / v.spinRef - 1) * v.spinK +
      (input.orbit / v.orbitRef - 1) * v.orbitK +
      (input.playerSpeed / v.moveRef) * v.moveK,
    v.min,
    v.max,
  );

  // 3. 暴击（逐次结算二值）
  const crit = rng.chance(Math.min(input.critChance, DAMAGE.critCap));
  const critMult = crit ? input.critMult : 1;

  // 4. 属性克制（环：火→刚→风→毒→水→火；雷/玄无关）
  let counterMult = 1.0;
  let counterLabel: DamageBreakdown['counterLabel'] = '—';
  if (COUNTER_RING[input.knifeSys] === input.enemySys) {
    counterMult = ELEMENT.counter;
    counterLabel = '克';
  } else if (COUNTER_RING[input.enemySys] === input.knifeSys) {
    counterMult = ELEMENT.countered;
    counterLabel = '被克';
  }

  // 5. 敌方减伤 DR = A/(A+100)，上限 0.85（压制类 M3 接入 0.90）
  const dr = Math.min(input.enemyArmor / (input.enemyArmor + DAMAGE.armorRef), DAMAGE.drCap);

  // 6. 全局难度系数
  const damage =
    input.atk *
    partMult *
    (1 + vBonus) *
    critMult *
    counterMult *
    (1 - dr) *
    DAMAGE.globalMult;

  return {
    damage,
    part: input.part,
    partMult,
    vBonus,
    crit,
    critMult,
    counterMult,
    counterLabel,
    dr,
  };
}

/** 乘区分解 → 单行文本（测试场命中日志用） */
export function breakdownText(bd: DamageBreakdown): string {
  const parts: string[] = [];
  parts.push(bd.part === 'tip' ? `尖${bd.partMult.toFixed(1)}` : `身${bd.partMult.toFixed(1)}`);
  parts.push(`v${bd.vBonus >= 0 ? '+' : ''}${(bd.vBonus * 100).toFixed(0)}%`);
  if (bd.crit) parts.push(`暴×${bd.critMult.toFixed(1)}`);
  if (bd.counterLabel !== '—') parts.push(`${bd.counterLabel}${bd.counterMult.toFixed(2)}`);
  if (bd.dr > 0.001) parts.push(`甲−${(bd.dr * 100).toFixed(0)}%`);
  return parts.join(' ');
}
