import type { EventType } from './types';

/**
 * 全事件清单（代码数据源）
 * Wiki 源：docs-wiki/07-content/03-全事件清单.md（v1.3，8 个）
 * 同步日期：2026-08-21
 * 选项 effect 为描述文本；M4 事件系统落地时再结构化（cost/effect 字段化）。
 */

const LIST: EventType[] = [
  {
    id: 'evt_yizhong', name: '铁匠遗冢', domain: [1, 2, 3], weight: 20,
    scene: '老铁匠之坟，碑上刻着配方残页',
    options: [
      { label: '祭拜', cost: '—', effect: 'steel×2', risk: '无' },
      { label: '掘坟', cost: '生命 -20%', effect: '词缀"锋锐 II"×1', risk: '无' },
      { label: '抄录残页', cost: '—', effect: '随机解锁 1 张刀谱（永久）', risk: '无' },
    ],
  },
  {
    id: 'evt_youyi', name: '江湖游医', domain: [1, 2, 3, 4, 5], weight: 15,
    scene: '悬壶游方郎中，药箱半开',
    options: [
      { label: '医治', cost: '—', effect: '回血 50%', risk: '无' },
      { label: '买药', cost: '12 金', effect: '生命上限 +15（本局）', risk: '无' },
      { label: '拒之', cost: '—', effect: '无（本域不再出现）', risk: '无' },
    ],
  },
  {
    id: 'evt_zuxia', name: '醉侠赌局', domain: [2, 3, 4, 5], weight: 15,
    scene: '醉卧的独行侠邀你掷骰',
    options: [
      { label: '押 10 金', cost: '10 金', effect: '50% 得 20 金', risk: '50% 归零' },
      { label: '押一把刀', cost: '1 把上阵刀', effect: '50% 刀升 1 阶', risk: '50% 刀消失' },
      { label: '不赌', cost: '—', effect: '无', risk: '无' },
    ],
  },
  {
    id: 'evt_daozhong', name: '神秘刀冢', domain: [3, 4, 5], weight: 10,
    scene: '荒冢插满锈刀，中央一柄嗡鸣',
    options: [
      { label: '取鸣刀', cost: '—', effect: '橙刀（域 4-5 池随机）', risk: '下场战斗 +1 波' },
      { label: '取锈刀', cost: '—', effect: '紫刀随机 + steel×3', risk: '无' },
      { label: '拜别', cost: '—', effect: '声望 +50', risk: '无' },
    ],
  },
  {
    id: 'evt_jitan', name: '山神祭坛', domain: [2, 3, 4, 5], weight: 10,
    scene: '苔痕斑驳的石坛，香火未冷',
    options: [
      { label: '献血', cost: '生命 -30%', effect: '随机 1 条词缀升 1 档', risk: '无' },
      { label: '献刀', cost: '1 把上阵刀', effect: '其余上阵刀攻击 +15%（本局）', risk: '无' },
      { label: '上香', cost: '5 金', effect: '回血 20%', risk: '无' },
    ],
  },
  {
    id: 'evt_shangdui', name: '商队遇袭', domain: [3, 4, 5], weight: 15,
    scene: '商队被劫，护卫且战且退',
    options: [
      { label: '拔刀相助', cost: '战斗', effect: '30 金 + 材料×3 + 声望 100', risk: '战斗失败=事件失败' },
      { label: '趁乱打劫', cost: '战斗（vs 护卫）', effect: '50 金 + 声望 -100', risk: '同上' },
      { label: '绕道', cost: '—', effect: '无', risk: '无' },
    ],
  },
  {
    id: 'evt_jinghu', name: '镜湖水月', domain: [4, 5], weight: 15,
    scene: '月下镜湖，湖中倒映着你的刀',
    options: [
      { label: '入镜取刀', cost: '—', effect: '复制 1 把上阵刀（含词缀，本局）', risk: '无' },
      { label: '碎镜', cost: '—', effect: '全上阵刀词缀随机重掷', risk: '可能变差' },
      { label: '观湖', cost: '—', effect: '回血 30% + 下场战斗首波敌血 -50%', risk: '无' },
    ],
  },
  {
    id: 'evt_duandao', name: '断刀老人', domain: [5], weight: 5,
    scene: '断崖边老人摩挲半截断刀（彩蛋级）',
    options: [
      { label: '修刀', cost: '选 1 把刀', effect: '该刀词缀上限 3→4（永久强化）', risk: '无' },
      { label: '听故事', cost: '—', effect: '声望 +200', risk: '无' },
      { label: '离去', cost: '—', effect: '无', risk: '无' },
    ],
  },
];

/** 事件查找表（id → EventType） */
export const EVENTS: Readonly<Record<string, EventType>> = Object.fromEntries(
  LIST.map((e) => [e.id, e]),
);

/** 事件全量列表 */
export const EVENT_LIST: readonly EventType[] = LIST;
