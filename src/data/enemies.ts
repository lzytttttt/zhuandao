import type { EnemyType } from './types';

/**
 * 全敌人清单（代码数据源）
 * Wiki 源：docs-wiki/07-content/01-全敌人清单.md（v1.3，10 种）
 * 同步日期：2026-08-21
 */

const LIST: EnemyType[] = [
  {
    id: 'ey_yekedao', name: '野刀客', sys: '刚', domain: [1], tpl: 'T1',
    hp: 40, atk: 10, armor: 5, speed: 3.5,
    materialDrop: 'steel 30%',
  },
  {
    id: 'ey_loulou', name: '山贼喽啰', sys: '刚', domain: [1, 2], tpl: 'T2',
    hp: 25, atk: 8, armor: 0, speed: 3.0,
    materialDrop: 'steel 15%',
  },
  {
    id: 'ey_heifengshou', name: '黑风寨刀手', sys: '火', domain: [1, 2], tpl: 'T8',
    hp: 180, atk: 16, armor: 20, speed: 4.0,
    materialDrop: 'gang×1',
  },
  {
    id: 'ey_hengdi', name: '衡岚剑弟子', sys: '风', domain: [2], tpl: 'T3',
    hp: 70, atk: 14, armor: 25, speed: 4.5,
    materialDrop: 'steel/gang',
  },
  {
    id: 'ey_hengzhifa', name: '衡岚执法', sys: '刚', domain: [2, 3], tpl: 'T4',
    hp: 100, atk: 12, armor: 40, speed: 3.5,
    materialDrop: 'gang',
  },
  {
    id: 'ey_shuizei', name: '沧澜水贼', sys: '水', domain: [3], tpl: 'T5',
    hp: 90, atk: 18, armor: 25, speed: 4.0,
    materialDrop: 'han 20%',
  },
  {
    id: 'ey_duji', name: '沧澜毒姬', sys: '毒', domain: [3, 4], tpl: 'T6',
    hp: 110, atk: 20, armor: 20, speed: 4.5,
    materialDrop: 'han/chi',
  },
  {
    id: 'ey_qibing', name: '大漠马贼骑', sys: '火', domain: [4], tpl: 'T3',
    hp: 160, atk: 26, armor: 50, speed: 5.2,
    materialDrop: 'chi/jin',
  },
  {
    id: 'ey_zhongjia', name: '大漠重甲卫', sys: '刚', domain: [4, 5], tpl: 'T7',
    hp: 220, atk: 30, armor: 100, speed: 3.0,
    materialDrop: 'jin',
  },
  {
    id: 'ey_daojui', name: '黑崖刀傀', sys: '玄', domain: [5], tpl: 'T9',
    hp: 300, atk: 38, armor: 60, speed: 3.8,
    materialDrop: 'yun 25%（剑气变体 tpl=T10，1:1 刷）',
  },
];

/** 敌人查找表（id → EnemyType） */
export const ENEMIES: Readonly<Record<string, EnemyType>> = Object.fromEntries(
  LIST.map((e) => [e.id, e]),
);

/** 敌人全量列表 */
export const ENEMY_LIST: readonly EnemyType[] = LIST;

/**
 * 波次组合表（wiki 07-全敌人清单 §四）。
 * 结构：域 → { normal: 普通节点波次方案, elite: 精英节点波次方案 }
 * 每个方案 = 一个波次 = [敌ID, 数量][]（节点可有 1-2 波，由 M2 生成器组合）。
 */
export const WAVES: Readonly<
  Record<number, { normal: ReadonlyArray<ReadonlyArray<[string, number]>>; elite: ReadonlyArray<ReadonlyArray<[string, number]>> }>
> = {
  1: {
    normal: [
      [['ey_yekedao', 6]],
      [['ey_loulou', 8]],
      [
        ['ey_yekedao', 4],
        ['ey_loulou', 4],
      ],
    ],
    elite: [
      [
        ['ey_heifengshou', 1],
        ['ey_loulou', 4],
      ],
    ],
  },
  2: {
    normal: [
      [['ey_hengdi', 5]],
      [
        ['ey_hengzhifa', 2],
        ['ey_hengdi', 4],
      ],
      [['ey_loulou', 10]],
    ],
    elite: [
      [
        ['ey_hengzhifa', 2],
        ['ey_hengdi', 5],
      ],
    ],
  },
  3: {
    normal: [
      [['ey_shuizei', 6]],
      [
        ['ey_duji', 2],
        ['ey_shuizei', 4],
      ],
    ],
    elite: [
      [
        ['ey_duji', 3],
        ['ey_shuizei', 6],
      ],
    ],
  },
  4: {
    normal: [
      [
        ['ey_qibing', 4],
        ['ey_zhongjia', 2],
      ],
      [['ey_zhongjia', 4]],
    ],
    elite: [
      [
        ['ey_qibing', 6],
        ['ey_zhongjia', 2],
      ],
    ],
  },
  5: {
    normal: [
      [['ey_daojui', 6]],
      [
        ['ey_zhongjia', 2],
        ['ey_daojui', 4],
      ],
    ],
    elite: [[['ey_daojui', 8]]],
  },
};

/** 精英词条池（wiki 03-敌人AI与行为 §三，MVP 6 个） */
export const ELITE_AFFIXES: ReadonlyArray<{
  id: string;
  name: string;
  desc: string;
}> = [
  { id: 'swift', name: '迅捷', desc: '移速 +40%' },
  { id: 'stone', name: '石肤', desc: '护甲 +60' },
  { id: 'frenzy', name: '狂暴', desc: '血量 <30% 时攻速 +50%' },
  { id: 'split', name: '分裂', desc: '死亡时分裂 2 只小体（血量 25%）' },
  { id: 'leech', name: '吸血', desc: '攻击回自身血 50%' },
  { id: 'barrier', name: '屏障', desc: '每 10s 获得一层 30 点护盾' },
];

/**
 * 节点结算奖励模型（wiki 04-稀有度与合成 §四，v1.3）。
 * 金币与刀掉落按战斗节点结算，不按怪结算。
 */
export const NODE_REWARDS: ReadonlyArray<{
  domain: number;
  normalGold: number;
  eliteGold: number;
  /** 普通节点刀掉落（品质 → 概率） */
  normalKnife: ReadonlyArray<[string, number]>;
  /** 精英节点刀掉落（品质 → 概率） */
  eliteKnife: ReadonlyArray<[string, number]>;
}> = [
  // 域1 精英奖励原表为空缺（与波次表域1 精英波次矛盾），按 普通8/域2精英18 插值补 12 金/15% 白（wiki 互动见 10-dev 日志 M2）
  { domain: 1, normalGold: 8, eliteGold: 12, normalKnife: [['白', 0.1]], eliteKnife: [['白', 0.15]] },
  { domain: 2, normalGold: 10, eliteGold: 18, normalKnife: [['绿', 0.12]], eliteKnife: [['绿', 0.25]] },
  { domain: 3, normalGold: 12, eliteGold: 22, normalKnife: [['蓝', 0.15]], eliteKnife: [['蓝', 0.3]] },
  {
    domain: 4, normalGold: 14, eliteGold: 26,
    normalKnife: [['蓝', 0.15], ['紫', 0.05]],
    eliteKnife: [['紫', 0.3]],
  },
  {
    domain: 5, normalGold: 16, eliteGold: 30,
    normalKnife: [['紫', 0.2], ['橙', 0.02]],
    eliteKnife: [['紫', 0.4], ['橙', 0.08]],
  },
];
