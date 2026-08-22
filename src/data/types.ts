/** 系别（INDEX 硬约定 · 七系） */
export type Sys = '风' | '火' | '水' | '毒' | '雷' | '刚' | '玄';

/** 稀有度五档（wiki 04-稀有度与合成） */
export type Rarity = '白' | '绿' | '蓝' | '紫' | '橙';

/** 材料六种（wiki 06-铁匠锻造系统） */
export type MaterialId = 'steel' | 'gang' | 'han' | 'chi' | 'jin' | 'yun';

export const MATERIAL_NAMES: Record<MaterialId, string> = {
  steel: '百炼钢',
  gang: '玄铁矿',
  han: '寒水玉',
  chi: '赤炎髓',
  jin: '大漠金砂',
  yun: '黑崖陨铁',
};

/** 刀特性 trait ID（wiki 07-全刀种清单 §三） */
export type TraitId =
  | 'ricochet'
  | 'burn'
  | 'chill'
  | 'stagger'
  | 'poison_stack'
  | 'thunder_chain'
  | 'burn_leech'
  | 'ignore_block'
  | 'suppress'
  | 'dual_phase';

/**
 * 刀种静态模板 weapon_type（wiki 04-稀有度与合成 §〇 两层模型）。
 * 稀有度与词缀属于 weapon_instance（玩家拥有的刀），M1 实现。
 */
export interface WeaponType {
  /** 全局唯一，前缀 dao_ */
  id: string;
  name: string;
  sys: Sys;
  /** 重量（斤）1-5：携带成本 */
  weight: number;
  /** 常见品质/解锁域参考（稀有度是实例属性） */
  rarity: Rarity;
  /** 基础攻击 A_dao */
  atk: number;
  /** 自旋速度（圈/s） */
  spin: number;
  /** 公转速度（圈/s） */
  orbit: number;
  /** 公转半径（单位） */
  radius: number;
  trait: TraitId | null;
  /** 词缀池（短 ID，与全刀种清单一致；词缀定义见 affixes.ts） */
  affixPool: string[];
  /** 可掉落域 */
  dropDomain: number[];
  /** 商店售价（金）；null = 不出售 */
  price: number | null;
  /** 锻造配方 */
  recipe: {
    materials: Partial<Record<MaterialId, number>>;
    gold: number;
    /** 配方备注（如"至尊专属谱"） */
    note?: string;
  };
}

/** 敌人行为模板（wiki 03-敌人AI与行为 §二） */
export type EnemyTpl = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10';

/** 敌人（wiki 07-全敌人清单） */
export interface EnemyType {
  id: string;
  name: string;
  sys: Sys;
  domain: number[];
  tpl: EnemyTpl;
  hp: number;
  atk: number;
  armor: number;
  /** 移速 u/s（红线：< 玩家移速×0.9） */
  speed: number;
  /** 材料掉落描述（按怪结算；金币/刀为节点结算） */
  materialDrop: string;
}

/** Boss（wiki 07-全Boss清单） */
export interface BossType {
  id: string;
  name: string;
  sys: Sys;
  domain: number;
  hp: number;
  atk: number;
  armor: number;
  phases: number;
  /** 按阶段分组的行为池（技能 ID → bosses.ts MOVES） */
  moves: string[][];
  dropsFirst: string;
  dropsRepeat: string;
  /** 战前对白（演出 2s） */
  quote: string;
}

/** 事件选项（wiki 07-全事件清单） */
export interface EventOption {
  label: string;
  cost: string;
  effect: string;
  risk: string;
}

/** 事件（wiki 07-全事件清单） */
export interface EventType {
  id: string;
  name: string;
  domain: number[];
  /** 抽取权重 */
  weight: number;
  /** 情景描述 */
  scene: string;
  options: EventOption[];
}

/** 词缀分类（wiki 04-刀词缀库） */
export type AffixCategory = '速度' | '范围' | '攻击' | '重心' | '特效' | '收势';

/** 词缀（wiki 04-刀词缀库；ID 用短 ID，与全刀种清单词缀池一致） */
export interface Affix {
  id: string;
  name: string;
  /** 档位 */
  tier: Rarity;
  category: AffixCategory;
  effect: string;
}
