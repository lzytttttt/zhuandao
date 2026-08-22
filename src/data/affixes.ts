import type { Affix } from './types';

/**
 * 刀词缀库（代码数据源）
 * Wiki 源：docs-wiki/04-build/01-刀词缀库.md（v1.3，全量 25 条）
 * 同步日期：2026-08-21
 * ID 约定：短 ID（无 aff_ 前缀），与全刀种清单词缀池列一致
 * （wiki 词缀库表中带 aff_ 前缀——前缀双口径已登记 10-dev 日志遗留问题 #2）。
 */

const LIST: Affix[] = [
  // 速度类
  { id: 'jifeng_1', name: '疾风 I', tier: '蓝', category: '速度', effect: '自旋速度 +15%' },
  { id: 'jifeng_2', name: '疾风 II', tier: '紫', category: '速度', effect: '自旋速度 +30%' },
  { id: 'xunying_1', name: '迅影 I', tier: '蓝', category: '速度', effect: '公转速度 +15%' },
  { id: 'xunying_2', name: '迅影 II', tier: '紫', category: '速度', effect: '公转速度 +30%' },
  // 范围类
  { id: 'changqu_1', name: '长驱 I', tier: '蓝', category: '范围', effect: '公转半径 +15%' },
  { id: 'changqu_2', name: '长驱 II', tier: '紫', category: '范围', effect: '公转半径 +30%' },
  { id: 'yuankuo', name: '圆阔', tier: '紫', category: '范围', effect: '收势炸开半径 +30%' },
  // 攻击类
  { id: 'fengren_1', name: '锋锐 I', tier: '绿', category: '攻击', effect: '攻击 +10%' },
  { id: 'fengren_2', name: '锋锐 II', tier: '蓝', category: '攻击', effect: '攻击 +15%' },
  { id: 'fengren_3', name: '锋锐 III', tier: '紫', category: '攻击', effect: '攻击 +18%' },
  { id: 'duanjin', name: '断金', tier: '紫', category: '攻击', effect: '暴伤 +30%' },
  { id: 'jianming', name: '剑鸣', tier: '蓝', category: '攻击', effect: '暴击率 +8%' },
  { id: 'poja_1', name: '破甲 I', tier: '绿', category: '攻击', effect: '命中时 -5 敌护甲（3s，可叠 3）' },
  { id: 'poja_2', name: '破甲 II', tier: '紫', category: '攻击', effect: '命中时 -12 敌护甲（3s，可叠 3）' },
  // 重心类（本作特色：调整刀身/刀尖伤害占比）
  { id: 'qianqing', name: '前倾', tier: '蓝', category: '重心', effect: '刀尖系数 1.6→1.8，刀身 1.0→0.9' },
  { id: 'houzuo', name: '后坐', tier: '蓝', category: '重心', effect: '刀身系数 1.0→1.2，刀尖 1.6→1.4' },
  { id: 'yazhong', name: '压重', tier: '紫', category: '重心', effect: '攻击 +25%，自旋 -20%（重刀流）' },
  // 特效类
  { id: 'zhuoshao', name: '燃刃', tier: '蓝', category: '特效', effect: '命中附加灼烧 1 层' },
  { id: 'dubu', name: '淬毒', tier: '蓝', category: '特效', effect: '命中附加中毒 1 层' },
  { id: 'hanbing', name: '寒锋', tier: '蓝', category: '特效', effect: '命中附加冰缓' },
  { id: 'leidian', name: '引雷', tier: '紫', category: '特效', effect: '暴击触发雷链（伤害 40% 起跳）' },
  { id: 'xixue', name: '汲血', tier: '紫', category: '特效', effect: '本刀伤害 15% 转为玩家回血' },
  { id: 'zhendang', name: '震荡', tier: '紫', category: '特效', effect: '收势击退 +1 单位且附加 0.5s 眩晕' },
  // 收势类
  { id: 'xuneng', name: '蓄能', tier: '紫', category: '收势', effect: '收势充能速度 +25%' },
  { id: 'shunfa', name: '瞬发', tier: '橙', category: '收势', effect: '收势演出 -0.3s（更快炸）' },
];

/** 词缀查找表（短 ID → Affix） */
export const AFFIXES: Readonly<Record<string, Affix>> = Object.fromEntries(
  LIST.map((a) => [a.id, a]),
);

/** 词缀全量列表（25 条） */
export const AFFIX_LIST: readonly Affix[] = LIST;
