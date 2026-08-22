import type { Rarity } from '../data/types';

/** 测试编队（刀 ID + 实例稀有度；对 wiki 自检表三档境界——dev 工具，沙盒与战斗节点共用） */
export interface TestLoadout {
  name: string;
  desc: string;
  items: Array<[string, Rarity]>;
}

export const TEST_LOADOUTS: TestLoadout[] = [
  {
    name: '学徒·6斤',
    desc: '全白 1斤×6',
    items: [
      ['dao_liuye', '白'],
      ['dao_feihuang', '白'],
      ['dao_qingzhu', '白'],
      ['dao_hanbo', '白'],
      ['dao_duyan', '白'],
      ['dao_shandian', '白'],
    ],
  },
  {
    name: '铸师·10斤',
    desc: '绿为主混搭',
    items: [
      ['dao_yanling', '绿'],
      ['dao_huozhe', '绿'],
      ['dao_leiming', '绿'],
      ['dao_hanbo', '白'],
      ['dao_duyan', '白'],
      ['dao_shandian', '白'],
      ['dao_liuye', '白'],
    ],
  },
  {
    name: '名匠·15斤',
    desc: '蓝绿混搭',
    items: [
      ['dao_duangu', '蓝'],
      ['dao_wugong', '蓝'],
      ['dao_hanyue', '绿'],
      ['dao_liushui', '绿'],
      ['dao_huadu', '绿'],
      ['dao_hanbo', '白'],
      ['dao_duyan', '白'],
      ['dao_shandian', '白'],
    ],
  },
];

/** 稀有度配色（表现层） */
export const RARITY_COLOR: Record<Rarity, string> = {
  白: '#c9ccd4',
  绿: '#5ecb6a',
  蓝: '#4da6ff',
  紫: '#b06fd6',
  橙: '#ffa245',
};
