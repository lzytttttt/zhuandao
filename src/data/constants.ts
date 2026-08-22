import type { Sys } from './types';

/**
 * 全局常量——数值唯一来源为 wiki 各章节（改数值先改 wiki 再同步此处）。
 * 源章节以注释标注。
 */

/** 玩家基础数值（wiki 03-战斗总纲·玩家基础数值） */
export const PLAYER = {
  baseHp: 100,
  /** 每境界 +30（wiki 06-境界与负重） */
  hpPerRealm: 30,
  /** 移速 6 u/s，不随境界增长 */
  speed: 6,
  /** 碰撞体圆半径 */
  radius: 0.4,
  /** 收势能量上限 */
  shoushiEnergyMax: 100,
};

/** 竞技场（wiki 03-战斗总纲） */
export const ARENA = {
  w: 22,
  h: 14,
  /** 1 单位 = 64px（待调参） */
  unitPx: 64,
};

/** 属性环：键克值（INDEX 硬约定：火→刚→风→毒→水→火；雷/玄不参与） */
export const COUNTER_RING: Partial<Record<Sys, Sys>> = {
  火: '刚',
  刚: '风',
  风: '毒',
  毒: '水',
  水: '火',
};

/** 克制系数（wiki 03-伤害公式 v1.3：1.20 / 0.85） */
export const ELEMENT = {
  counter: 1.2,
  countered: 0.85,
};

/** 伤害公式常量（wiki 03-伤害公式） */
export const DAMAGE = {
  /** 部位系数 */
  bodyFactor: 1.0,
  tipFactor: 1.6,
  /** 相对速度加成（v1.3 重写版，上限 +30%） */
  vDamage: {
    spinRef: 1.5,
    spinK: 0.16,
    orbitRef: 0.6,
    orbitK: 0.12,
    moveRef: 6,
    moveK: 0.08,
    min: -0.1,
    max: 0.3,
  },
  /** 暴击 */
  critBase: 0.05,
  critCap: 0.75,
  critMultBase: 1.5,
  /** 护甲减伤 DR = A / (A + 100) */
  armorRef: 100,
  drCap: 0.85,
  /** 压制（镇岳光环等）与 DR 相加后的上限 */
  drCapSuppressed: 0.9,
  /** 全局难度系数（普通/精英/Boss 均 1.0） */
  globalMult: 1.0,
};

/** 命中判定（wiki 03-转刀机制 §六 调参表） */
export const HIT = {
  /** 同刀同敌两次判定间隔 */
  cooldown: 0.4,
};

/** 收势（wiki 03-转刀机制 §四） */
export const SHOUSHI = {
  /** 充能速度（点/s） */
  chargeRate: 12.5,
  /** 演出总时长 */
  duration: 1.0,
  /** 无敌帧（收拢期间前段） */
  invulnTime: 0.3,
  /** 收拢段时长 */
  collapseTime: 0.5,
  /** 炸开冲击波半径（扩张） */
  radiusFrom: 3,
  radiusTo: 6,
  /** 伤害倍率（Σ刀尖伤害 × 2.0） */
  mult: 2.0,
  /** 击退距离 */
  knockback: 2,
  /** 附加眩晕 */
  stun: 0.3,
};

/** DoT 规则（wiki 03-伤害公式 §三） */
export const DOT = {
  burn: { maxStacks: 5, perLayerPct: 0.08, duration: 3 },
  poison: { maxStacks: 5, perLayerPct: 0.1, duration: 3 },
  chill: { moveSlow: 0.3, atkSlow: 0.2, duration: 2 },
};

/** 性能预算（wiki 03-战斗总纲·性能预算） */
export const BUDGET = {
  maxEnemies: 40,
  maxKnives: 8,
  maxProjectiles: 60,
  maxParticles: 200,
  /** 空间哈希网格边长（单位） */
  hashCell: 1.0,
};

/** 敌人移速红线：永远低于玩家移速的 90%（wiki 03-敌人AI §一） */
export const ENEMY_SPEED_CAP = PLAYER.speed * 0.9;

/**
 * 敌人 AI 行为参数（wiki 03-敌人AI与行为 §一/§二/§四）。
 * wiki 已定：决策间隔 0.2s、前摇 ≥0.5s、松散包围、远程保持射程、
 * T3 蓄力 0.8s、T5 保持 6 单位、T9 自爆红圈 1s。
 * 其余（攻击范围/冷却/弹速等）为本工程暂定值，待设计定标（10-dev 日志登记）。
 */
export const ENEMY_AI = {
  /** 行为循环决策间隔（wiki §一） */
  decisionInterval: 0.2,
  /** 前摇红线：所有攻击前摇 ≥0.5s（wiki §一，validate 校验） */
  minWindup: 0.5,
  /** 松散包围：贴身环半径（目标点 = 玩家 + 槽位角度 × 该半径，wiki §四） */
  surroundRadius: 0.9,
  /** 敌-玩家接触间距（敌人不穿入玩家，仅对玩家有推挤 wiki §一） */
  contactPad: 0.1,
  T1: { windup: 0.6, range: 1.2, cooldown: 1.5 },
  T2: { windup: 0.5, range: 1.1, cooldown: 1.2 },
  T3: {
    windup: 0.8, cooldown: 4,
    chargeMinDist: 2, chargeMaxDist: 6,
    chargeSpeed: 9, chargeTime: 1.2,
    /** 撞墙/冲完硬直（wiki：撞墙硬直；马贼骑撞墙自晕） */
    stun: 1,
    /** 玩家静止超过该值时优先冲锋（wiki §四 防挂机） */
    idleTrigger: 2,
  },
  T4: {
    /** 正面格挡角（wiki：正面 120° 刀伤归零） */
    blockAngleDeg: 120,
    windup: 0.6, range: 1.2, cooldown: 1.8,
  },
  T5: {
    windup: 0.7, cooldown: 2.5,
    /** 保持 6 单位距离（wiki §二）；<retreat 后撤，>approach 追近 */
    keep: 6, retreat: 5, approach: 7,
    projSpeed: 7, projRadius: 0.18,
  },
  T6: {
    windup: 0.8, cooldown: 3.5,
    keep: 6.5, retreat: 5.5, approach: 7.5,
    /** 毒圈放置在玩家移动方向前方 lead 单位（wiki：玩家路径上） */
    lead: 2, hazardRadius: 1.5, hazardDuration: 4,
    /** 毒圈每秒伤害 = 敌 atk × 该系数（wiki 未定标，暂定） */
    hazardDpsMult: 0.5,
  },
  T7: { windup: 0.9, range: 1.6, cooldown: 2.5 },
  T8: {
    /** 模式A 平A：连 comboToB 次后切换模式B 三连斩（wiki §二 双模式） */
    aWindup: 0.5, aRange: 1.2, aCooldown: 1, comboToB: 3,
    bWindup: 0.7, bRange: 1.4, bHits: 3, bHitGap: 0.2, bDmgMult: 0.7, bCooldown: 2.2,
  },
  T9: {
    /** 贴近该距离 → 触发引信（wiki：缓慢贴近 → 1s 红圈 → 自爆） */
    triggerRange: 1.8, fuse: 1, blastRadius: 2.2,
    /** 自爆伤害 = atk × 该系数（wiki 未定标，暂定 1.0） */
    blastMult: 1,
  },
  T10: {
    windup: 1, cooldown: 3,
    keep: 7.5, retreat: 6, approach: 8.5,
    swordSpeed: 10, swordLength: 8, swordWidth: 0.8,
  },
};

/** 敌人受击反馈（wiki 03-敌人AI §一 受击反应：硬直/击退；重击 trait 为刀特性 M3） */
export const ENEMY_HIT = {
  /** 受击硬直时长 */
  stagger: 0.12,
  /** 硬直内在免疫（防多刀连续硬直锁死敌人） */
  staggerImmune: 0.6,
  /** 击退距离（单位，沿玩家→敌方向） */
  knockback: 0.25,
};

/** 玩家受击（wiki 03-伤害公式 §六：玩家 TTK ≥8s；无敌帧为达成该红线的工程手段） */
export const PLAYER_HIT = {
  /** 受击无敌帧 */
  invuln: 0.8,
  /** 受击红闪时长 */
  flash: 0.25,
};

/** 精英（wiki 03-敌人AI §三） */
export const ELITE = {
  hpMult: 3,
  atkMult: 1.5,
  sizeMult: 1.2,
  /** 精英材料 ×2（wiki 03-敌人AI §六） */
  materialMult: 2,
  /** 词条效果数值（wiki 词条池表） */
  swiftSpeedMult: 1.4,
  stoneArmor: 60,
  frenzyThreshold: 0.3,
  frenzyAtkSpeedMult: 1.5,
  splitCount: 2,
  splitHpPct: 0.25,
  leechPct: 0.5,
  barrierInterval: 10,
  barrierAmount: 30,
};

/** 波次编排（wiki 07-全敌人清单 §四 波次组合表；间隔/演出为工程暂定） */
export const WAVE = {
  /** 入场演出时长 */
  enterDelay: 1,
  /** 波间间隔 */
  gap: 2.5,
  /** 普通节点波数（从 normal 池随机取） */
  normalWaves: 2,
  /** 精英节点前置普通波数 */
  eliteLeadWaves: 1,
  /** 精英化数量上限（取波次中最少种类） */
  eliteMaxCount: 2,
  /** 出生点离墙距离 */
  spawnPad: 0.6,
  /** 敌人入场淡入时长 */
  spawnFade: 0.35,
};

/** 系别配色（工程表现层，非设计数值） */
export const SYS_COLOR: Record<Sys, string> = {
  风: '#6fd6b0',
  火: '#ff7a45',
  水: '#4da6ff',
  毒: '#8ee04d',
  雷: '#ffd94d',
  刚: '#c9ccd4',
  玄: '#9d8cf0',
};
