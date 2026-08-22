import type { TraitId, WeaponType } from './types';

/**
 * 全刀种清单（代码数据源）
 * Wiki 源：docs-wiki/07-content/00-全刀种清单.md（v1.3，20 把）
 * 同步日期：2026-08-21
 * 规则：改数值先改 wiki 清单，再同步此处；词缀池用短 ID（与清单一致）。
 */

/** 特性（trait）定义 —— wiki §三 */
export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  ricochet: { name: '弹射', desc: '命中后自旋偏转 ±40°，公转 +100% 持续 0.5s' },
  burn: { name: '点燃', desc: '命中附加灼烧 1 层（每层 A_dao×8%/s）' },
  chill: { name: '冰缓', desc: '命中附加冰缓：-30% 移速 2s' },
  stagger: { name: '重击', desc: '命中附加硬直 0.3s + 击退 0.5 单位' },
  poison_stack: { name: '叠毒', desc: '命中附加中毒 1 层（每层 A_dao×10%/s，上限随羁绊 5/7）' },
  thunder_chain: { name: '雷链', desc: '暴击触发雷链 3 跳（50%/40%/32%）' },
  burn_leech: { name: '汲血', desc: '灼烧伤害 30% 转玩家回血' },
  ignore_block: { name: '破格挡', desc: '无视格挡与弹开判定' },
  suppress: { name: '压制', desc: '以刀为心 r=2 内敌人造成伤害 -20%' },
  dual_phase: { name: '双刃', desc: '本体+镜像双刀身，各 60% 面板，占双相位' },
};

const LIST: WeaponType[] = [
  {
    id: 'dao_liuye', name: '柳叶刀', sys: '风', weight: 1, rarity: '白',
    atk: 6, spin: 2.0, orbit: 0.6, radius: 2.5, trait: null,
    affixPool: ['fengren_1', 'xunying_1', 'jianming'],
    dropDomain: [1, 2], price: 3,
    recipe: { materials: { steel: 2 }, gold: 5 },
  },
  {
    id: 'dao_feihuang', name: '飞蝗刀', sys: '风', weight: 1, rarity: '白',
    atk: 6, spin: 2.2, orbit: 0.7, radius: 2.5, trait: 'ricochet',
    affixPool: ['fengren_1', 'xunying_1', 'qianqing'],
    dropDomain: [1, 2, 3], price: 3,
    recipe: { materials: { steel: 2 }, gold: 5 },
  },
  {
    id: 'dao_qingzhu', name: '青竹刀', sys: '刚', weight: 1, rarity: '白',
    atk: 7, spin: 1.8, orbit: 0.6, radius: 2.5, trait: null,
    affixPool: ['fengren_1', 'fengren_2', 'poja_1'],
    dropDomain: [1, 2], price: 3,
    recipe: { materials: { steel: 2 }, gold: 5 },
  },
  {
    id: 'dao_hanbo', name: '寒波刀', sys: '水', weight: 1, rarity: '白',
    atk: 6, spin: 1.8, orbit: 0.6, radius: 2.5, trait: 'chill',
    affixPool: ['hanbing', 'fengren_1', 'changqu_1'],
    dropDomain: [1, 2], price: 3,
    recipe: { materials: { steel: 2 }, gold: 5 },
  },
  {
    id: 'dao_duyan', name: '毒烟刀', sys: '毒', weight: 1, rarity: '白',
    atk: 6, spin: 1.9, orbit: 0.6, radius: 2.5, trait: 'poison_stack',
    affixPool: ['dubu', 'fengren_1', 'xunying_1'],
    dropDomain: [1, 2], price: 3,
    recipe: { materials: { steel: 2 }, gold: 5 },
  },
  {
    id: 'dao_shandian', name: '闪电刀', sys: '雷', weight: 1, rarity: '白',
    atk: 6, spin: 2.0, orbit: 0.7, radius: 2.5, trait: 'thunder_chain',
    affixPool: ['leidian', 'fengren_1', 'jianming'],
    dropDomain: [1, 2], price: 3,
    recipe: { materials: { steel: 2 }, gold: 5 },
  },
  {
    id: 'dao_yanling', name: '燕翎刀', sys: '风', weight: 2, rarity: '绿',
    atk: 12, spin: 1.5, orbit: 0.7, radius: 3.2, trait: null,
    affixPool: ['fengren_2', 'xunying_2', 'changqu_1', 'jianming'],
    dropDomain: [1, 2, 3], price: 6,
    recipe: { materials: { gang: 2, steel: 2 }, gold: 10 },
  },
  {
    id: 'dao_huozhe', name: '火褶刀', sys: '火', weight: 2, rarity: '绿',
    atk: 11, spin: 1.4, orbit: 0.6, radius: 3.0, trait: 'burn',
    affixPool: ['zhuoshao', 'fengren_2', 'poja_1'],
    dropDomain: [2, 3], price: 6,
    recipe: { materials: { gang: 2, chi: 1 }, gold: 10 },
  },
  {
    id: 'dao_hanyue', name: '寒月刀', sys: '水', weight: 2, rarity: '绿',
    atk: 11, spin: 1.4, orbit: 0.6, radius: 3.0, trait: 'chill',
    affixPool: ['hanbing', 'fengren_2', 'changqu_1'],
    dropDomain: [2, 3, 4], price: 6,
    recipe: { materials: { gang: 2, han: 1 }, gold: 10 },
  },
  {
    id: 'dao_liushui', name: '流水刀', sys: '水', weight: 2, rarity: '绿',
    atk: 11, spin: 1.5, orbit: 0.7, radius: 3.0, trait: 'chill',
    affixPool: ['hanbing', 'fengren_2', 'changqu_1'],
    dropDomain: [2, 3], price: 6,
    recipe: { materials: { gang: 2, han: 1 }, gold: 10 },
  },
  {
    id: 'dao_huadu', name: '花毒刀', sys: '毒', weight: 2, rarity: '绿',
    atk: 11, spin: 1.5, orbit: 0.7, radius: 3.0, trait: 'poison_stack',
    affixPool: ['dubu', 'fengren_2', 'qianqing'],
    dropDomain: [2, 3], price: 6,
    recipe: { materials: { gang: 2, han: 1 }, gold: 10 },
  },
  {
    id: 'dao_leiming', name: '雷鸣刀', sys: '雷', weight: 2, rarity: '绿',
    atk: 12, spin: 1.6, orbit: 0.7, radius: 3.2, trait: 'thunder_chain',
    affixPool: ['leidian', 'fengren_2', 'jianming'],
    dropDomain: [2, 3], price: 6,
    recipe: { materials: { gang: 2, han: 1 }, gold: 10 },
  },
  {
    id: 'dao_duangu', name: '断骨刀', sys: '刚', weight: 3, rarity: '蓝',
    atk: 22, spin: 1.0, orbit: 0.6, radius: 4.0, trait: 'stagger',
    affixPool: ['fengren_2', 'houzuo', 'duanjin', 'poja_2'],
    dropDomain: [2, 3, 4], price: 12,
    recipe: { materials: { gang: 4, han: 1 }, gold: 20 },
  },
  {
    id: 'dao_wugong', name: '蜈蚣刀', sys: '毒', weight: 3, rarity: '蓝',
    atk: 20, spin: 1.2, orbit: 0.7, radius: 3.8, trait: 'poison_stack',
    affixPool: ['dubu', 'fengren_2', 'qianqing', 'jianming'],
    dropDomain: [3, 4], price: 12,
    recipe: { materials: { gang: 4, han: 1 }, gold: 20 },
  },
  {
    id: 'dao_leiting', name: '惊雷刃', sys: '雷', weight: 4, rarity: '紫',
    atk: 36, spin: 0.9, orbit: 0.6, radius: 5.0, trait: 'thunder_chain',
    affixPool: ['leidian', 'duanjin', 'jianming', 'fengren_3'],
    dropDomain: [3, 4, 5], price: 24,
    recipe: { materials: { han: 3, jin: 2 }, gold: 40 },
  },
  {
    id: 'dao_xueyin', name: '血饮刀', sys: '火', weight: 4, rarity: '紫',
    atk: 34, spin: 0.8, orbit: 0.6, radius: 4.8, trait: 'burn_leech',
    affixPool: ['zhuoshao', 'xixue', 'fengren_3', 'duanjin'],
    dropDomain: [3, 4, 5], price: 24,
    recipe: { materials: { han: 3, chi: 2 }, gold: 40 },
  },
  {
    id: 'dao_xuantie', name: '玄铁重刀', sys: '玄', weight: 4, rarity: '紫',
    atk: 32, spin: 0.6, orbit: 0.5, radius: 5.2, trait: 'ignore_block',
    affixPool: ['yazhong', 'fengren_3', 'houzuo', 'duanjin'],
    dropDomain: [4, 5], price: 24,
    recipe: { materials: { han: 3, jin: 2 }, gold: 40 },
  },
  {
    id: 'dao_zhenyue', name: '镇岳刀', sys: '刚', weight: 5, rarity: '橙',
    atk: 60, spin: 0.6, orbit: 0.5, radius: 6.0, trait: 'suppress',
    affixPool: ['yazhong', 'zhendang', 'fengren_3', 'houzuo'],
    dropDomain: [4, 5], price: null,
    recipe: { materials: { jin: 5, yun: 3 }, gold: 80 },
  },
  {
    id: 'dao_qingshuang', name: '百炼青霜', sys: '风', weight: 5, rarity: '橙',
    atk: 52, spin: 1.6, orbit: 0.9, radius: 6.0, trait: null,
    affixPool: ['xunying_2', 'changqu_2', 'jianming', 'duanjin'],
    dropDomain: [4, 5], price: null,
    recipe: { materials: { jin: 5, yun: 3 }, gold: 80 },
  },
  {
    id: 'dao_liangyi', name: '两仪刀', sys: '玄', weight: 5, rarity: '橙',
    atk: 55, spin: 1.0, orbit: 0.7, radius: 5.5, trait: 'dual_phase',
    affixPool: ['shunfa', 'xuneng', 'leidian', 'fengren_3'],
    dropDomain: [5], price: null,
    recipe: { materials: { yun: 6 }, gold: 120, note: '至尊专属谱' },
  },
];

/** 刀种查找表（id → WeaponType） */
export const WEAPONS: Readonly<Record<string, WeaponType>> = Object.fromEntries(
  LIST.map((k) => [k.id, k]),
);

/** 刀种全量列表 */
export const KNIFE_LIST: readonly WeaponType[] = LIST;
