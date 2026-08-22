import type { Rarity, WeaponType } from '../data/types';

/**
 * weapon_instance —— wiki 04-稀有度与合成 §〇 两层模型：
 * 刀种（weapon_type）静态定义基础属性；玩家拥有的刀（本模块）带稀有度与词缀。
 */

/**
 * 稀有度攻击乘数。
 * 推导自 wiki 04-稀有度与合成 §三（合成收益逐档累乘）：
 * 白→绿 +25%、绿→蓝 +25%、蓝→紫 +20%、紫→橙 +20%。
 */
export const RARITY_ATK_MULT: Record<Rarity, number> = {
  白: 1.0,
  绿: 1.25,
  蓝: 1.5625,
  紫: 1.875,
  橙: 2.25,
};

/** 词缀数上限（wiki 04 §一：白1/绿1/蓝2/紫2/橙3） */
export const RARITY_AFFIX_COUNT: Record<Rarity, number> = {
  白: 1,
  绿: 1,
  蓝: 2,
  紫: 2,
  橙: 3,
};

export interface WeaponInstance {
  type: WeaponType;
  rarity: Rarity;
  /** 词缀短 ID 列表（M1 仅占位，效果 M3 生效） */
  affixes: string[];
  /** 实例攻击面板 A_dao = type.atk × 稀有度乘数（词缀/羁绊加成 M3 接入） */
  atk: number;
}

/** 构造刀实例（掉落/锻造/合成的统一入口） */
export function makeWeapon(type: WeaponType, rarity: Rarity, affixes: string[] = []): WeaponInstance {
  return {
    type,
    rarity,
    affixes,
    atk: type.atk * RARITY_ATK_MULT[rarity],
  };
}
