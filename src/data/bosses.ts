import type { BossType } from './types';

/**
 * 全 Boss 清单（代码数据源）
 * Wiki 源：docs-wiki/07-content/02-全Boss清单.md（v1.3，5 个）
 * 同步日期：2026-08-21
 */

/** Boss 技能定义（wiki §三 技能定义表） */
export interface BossMove {
  id: string;
  name: string;
  /** 所属 Boss·阶段（描述用） */
  owner: string;
  /** 前摇秒数；null = 无前摇（姿态/被动） */
  windup: number | null;
  /** 判定形状描述 */
  judgement: string;
  /** 伤害系数（×atk）；null = 无伤害 */
  mult: number | null;
  note: string;
}

export const MOVES: Readonly<Record<string, BossMove>> = {
  slash: { id: 'slash', name: '砍山双斩', owner: '呼延豹P1', windup: 0.6, judgement: '近战扇形', mult: 1.0, note: '基础平A' },
  summon_minion: { id: 'summon_minion', name: '呼喝聚匪', owner: '呼延豹P1', windup: 1.0, judgement: '—', mult: null, note: '召 2 喽啰（≤4 在场）' },
  jump_slam: { id: 'jump_slam', name: '跳劈震地', owner: '呼延豹P2', windup: 0.8, judgement: '落点大圈', mult: 1.5, note: '落点红圈预警' },
  rage: { id: 'rage', name: '狂暴', owner: '呼延豹P2', windup: null, judgement: '—', mult: null, note: '移速/攻速 +30%，可被冰缓' },

  sword_beam: { id: 'sword_beam', name: '剑气斩', owner: '白鹤真人P1', windup: 0.7, judgement: '直线穿透', mult: 1.2, note: '可走位躲' },
  guard_stance: { id: 'guard_stance', name: '拔刀式', owner: '白鹤真人P1', windup: null, judgement: '—', mult: null, note: '正面 120° 格挡 3s' },
  swallow_dash: { id: 'swallow_dash', name: '燕返', owner: '白鹤真人P2', windup: 0.5, judgement: '突进两段', mult: 1.0, note: '每段独立预警' },
  qi_wall: { id: 'qi_wall', name: '气墙', owner: '白鹤真人P2', windup: 1.2, judgement: '—', mult: null, note: '圆形护罩 4s，刀被弹开，背面无防护' },
  sword_rain: { id: 'sword_rain', name: '万剑归宗', owner: '白鹤真人P3', windup: 1.5, judgement: '全屏 8 向', mult: 0.8, note: '间隙走位' },

  water_barrage: { id: 'water_barrage', name: '水弹幕', owner: '敖十三P1', windup: 1.0, judgement: '环形弹幕', mult: 0.8, note: '慢速可穿缝' },
  poison_ring: { id: 'poison_ring', name: '毒环', owner: '敖十三P1', windup: 0.8, judgement: '地面圈×3', mult: null, note: 'DoT 10%/s 3s' },
  vortex_pull: { id: 'vortex_pull', name: '龙吸水', owner: '敖十三P2', windup: 1.0, judgement: '牵引', mult: null, note: '1.5s 反向走位挣脱' },
  summon_pirate: { id: 'summon_pirate', name: '召唤水贼', owner: '敖十三P2', windup: 1.0, judgement: '—', mult: null, note: '×2' },
  tidal_wave: { id: 'tidal_wave', name: '惊涛', owner: '敖十三P3', windup: 1.5, judgement: '全屏三连', mult: 1.0, note: '安全区随机' },

  great_slash: { id: 'great_slash', name: '巨刃横扫', owner: '赫连霸P1', windup: 0.8, judgement: '半屏扇形', mult: 1.5, note: '—' },
  charge: { id: 'charge', name: '冲锋', owner: '赫连霸P1', windup: 0.8, judgement: '直线', mult: 1.8, note: '撞墙自晕 2s' },
  stomp: { id: 'stomp', name: '跺地冲击', owner: '赫连霸P2', windup: 1.0, judgement: '全屏波', mult: 1.0, note: '走位至落点边缘' },
  armor_field: { id: 'armor_field', name: '重甲领域', owner: '赫连霸P2', windup: null, judgement: '—', mult: null, note: '周身 DR 80%' },
  triple_charge: { id: 'triple_charge', name: '暴走三连冲', owner: '赫连霸P3', windup: 0.6, judgement: '直线×3', mult: 1.5, note: '撞墙才停（0.6s×3）' },
  armor_break: { id: 'armor_break', name: '甲碎', owner: '赫连霸P3', windup: null, judgement: '—', mult: null, note: '护甲归零、攻击 +60%' },

  blade_clash: { id: 'blade_clash', name: '刀阵对拼', owner: '剑无极P1', windup: null, judgement: '—', mult: null, note: '敌方刀阵演出碰撞' },
  chase_slash: { id: 'chase_slash', name: '追身斩', owner: '剑无极P1', windup: 0.5, judgement: '突进平A', mult: 1.0, note: '—' },
  mirror_style: { id: 'mirror_style', name: '镜像流派', owner: '剑无极P2', windup: 1.5, judgement: '—', mult: null, note: '复制玩家主系强化' },
  clash_burst: { id: 'clash_burst', name: '收势对轰', owner: '剑无极P2', windup: 2.0, judgement: '大圈', mult: 2.0, note: '红圈预警，走出炸点' },
  ultimate_field: { id: 'ultimate_field', name: '无极领域', owner: '剑无极P3', windup: null, judgement: '—', mult: null, note: '全屏减速 20%，中央安全' },
  blade_tomb: { id: 'blade_tomb', name: '刀冢万鸣', owner: '剑无极P3', windup: 1.5, judgement: '—', mult: null, note: '召 4 把敌方野刀绕体' },
};

const LIST: BossType[] = [
  {
    id: 'boss_huyan', name: '黑风寨主·呼延豹', sys: '刚', domain: 1,
    hp: 1400, atk: 20, armor: 0, phases: 2,
    moves: [['slash', 'summon_minion'], ['jump_slam', 'rage']],
    dropsFirst: '声望+60 + 蓝刀×1 + 玄铁矿×3 + 30金',
    dropsRepeat: '声望+20 + 玄铁矿×1 + 15金',
    quote: '又来一个送刀的！',
  },
  {
    id: 'boss_baihe', name: '衡岚掌门·白鹤真人', sys: '风', domain: 2,
    hp: 2000, atk: 28, armor: 40, phases: 3,
    moves: [['sword_beam', 'guard_stance'], ['swallow_dash', 'qi_wall'], ['sword_rain']],
    dropsFirst: '声望+90 + 蓝刀×1 + 玄铁矿×5 + 40金',
    dropsRepeat: '声望+30 + 玄铁矿×2 + 20金',
    quote: '刀剑无眼，阁下自重。',
  },
  {
    id: 'boss_aoshi', name: '沧澜龙王·敖十三', sys: '水', domain: 3,
    hp: 5000, atk: 32, armor: 30, phases: 3,
    moves: [['water_barrage', 'poison_ring'], ['vortex_pull', 'summon_pirate'], ['tidal_wave']],
    dropsFirst: '声望+150 + 紫刀×1 + 寒水玉×5 + 50金',
    dropsRepeat: '声望+50 + 寒水玉×2 + 25金',
    quote: '水里养的刀，见血才快。',
  },
  {
    id: 'boss_helian', name: '孤城刀魔·赫连霸', sys: '刚', domain: 4,
    hp: 6000, atk: 40, armor: 100, phases: 3,
    moves: [['great_slash', 'charge'], ['stomp', 'armor_field'], ['triple_charge', 'armor_break']],
    dropsFirst: '声望+250 + 紫刀×1 + 大漠金砂×5 + 60金',
    dropsRepeat: '声望+80 + 大漠金砂×2 + 30金',
    quote: '俺这把刀，劈过城门。',
  },
  {
    id: 'boss_jianwuji', name: '前任武林至尊·剑无极', sys: '玄', domain: 5,
    hp: 20000, atk: 45, armor: 60, phases: 3,
    moves: [['blade_clash', 'chase_slash'], ['mirror_style', 'clash_burst'], ['ultimate_field', 'blade_tomb']],
    dropsFirst: '声望+350 + 橙刀自选×1 + 黑崖陨铁×5 + 100金 + 称号"武林至尊"',
    dropsRepeat: '声望+120 + 黑崖陨铁×2 + 50金',
    quote: '等你很久了。来，取走我的名号。',
  },
];

/** Boss 查找表（id → BossType） */
export const BOSSES: Readonly<Record<string, BossType>> = Object.fromEntries(
  LIST.map((b) => [b.id, b]),
);

/** Boss 全量列表 */
export const BOSS_LIST: readonly BossType[] = LIST;
