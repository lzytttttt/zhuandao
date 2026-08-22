import { KNIFE_LIST } from '../data/knives';
import { NODE_REWARDS } from '../data/enemies';
import type { MaterialId, Rarity, WeaponType } from '../data/types';
import type { Rng } from '../core/Rng';

type RarityLiteral = Rarity;

/**
 * 掉落结算（wiki 03-敌人AI与行为 §六 / 04-稀有度与合成 §四 节点结算奖励模型 v1.3）：
 * - 材料：按怪结算（死亡时 roll，精英 ×2）；
 * - 金币/刀：按战斗节点结算（NODE_REWARDS）。
 */

/** 材料累积容器 */
export type MaterialBag = Partial<Record<MaterialId, number>>;

/**
 * 解析材料掉落描述并 roll 一次。
 * 描述格式（07-全敌人清单 §五）：
 * - "steel 30%"  → 30% 概率 1 个
 * - "gang×1"     → 必得 1 个
 * - "steel/gang" → 随机其一（必得 1 个）
 * - "gang"       → 必得 1 个
 * 中文括号注释（如刀傀的剑气变体说明）会被剥除。
 */
export function rollMaterialDrop(desc: string, rng: Rng): MaterialBag {
  const out: MaterialBag = {};
  const trimmed = desc.split('（')[0]!.trim();

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map((s) => s.trim());
    const picked = parts[rng.int(0, parts.length - 1)]!;
    addOne(out, picked);
    return out;
  }

  const pct = /^([a-z]+)\s+(\d+(?:\.\d+)?)%$/.exec(trimmed);
  if (pct) {
    if (rng.chance(parseFloat(pct[2]!) / 100)) out[pct[1]! as MaterialId] = 1;
    return out;
  }

  const mult = /^([a-z]+)×(\d+)$/.exec(trimmed);
  if (mult) {
    out[mult[1]! as MaterialId] = parseInt(mult[2]!, 10);
    return out;
  }

  addOne(out, trimmed);
  return out;
}

function addOne(out: MaterialBag, id: string): void {
  out[id as MaterialId] = (out[id as MaterialId] ?? 0) + 1;
}

/** 节点结算奖励 */
export interface NodeReward {
  gold: number;
  /** 掉落的刀（null = 未掉） */
  knife: { type: WeaponType; rarity: Rarity } | null;
}

/**
 * 节点结算 roll（金币固定值；刀按掉率表逐档 roll，低档先判、命中即止——
 * 域4 "15% 蓝 / 5% 紫" 实际 ≈ 15% 蓝 + 4.25% 紫，接近字面语义）。
 */
export function rollNodeRewards(domain: number, kind: 'normal' | 'elite', rng: Rng): NodeReward {
  const model = NODE_REWARDS.find((n) => n.domain === domain);
  if (!model) return { gold: 0, knife: null };
  const gold = kind === 'elite' ? model.eliteGold : model.normalGold;
  const table = kind === 'elite' ? model.eliteKnife : model.normalKnife;
  let knife: NodeReward['knife'] = null;
  for (const [rarity, p] of table) {
    if (rng.chance(p)) {
      const type = rollKnifeType(domain, rarity as RarityLiteral, rng);
      if (type) {
        knife = { type, rarity: rarity as RarityLiteral };
        break;
      }
    }
  }
  return { gold, knife };
}

/** 从「可掉落域含 domain 且常见品质匹配」的刀种中随机 */
export function rollKnifeType(domain: number, rarity: Rarity, rng: Rng): WeaponType | null {
  const pool = KNIFE_LIST.filter((k) => k.dropDomain.includes(domain) && k.rarity === rarity);
  if (pool.length === 0) return null;
  return rng.pick(pool);
}
