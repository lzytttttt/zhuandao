import type { EnemyType } from '../data/types';
import { DAMAGE, ELITE, ENEMY_AI, ENEMY_HIT, ENEMY_SPEED_CAP } from '../data/constants';
import { normAngle } from '../core/math';

let nextUid = 1;

/** AI 相位（wiki 03-敌人AI与行为 §一 通用行为树 + §二 模板特化） */
export type EnemyPhase =
  | 'enter' // 入场淡入（波次演出）
  | 'chase' // 追击/走位（含远程拉扯）
  | 'windup' // 攻击前摇（红色警示演出）
  | 'recover' // 攻击后摇
  | 'chargeWindup' // T3 冲锋蓄力（0.8s）
  | 'charging' // T3 直线冲刺中
  | 'stunned' // T3 撞墙硬直
  | 'fusing' // T9 自爆引信（1s 红圈）
  | 'combo'; // T8 三连斩连击中

/**
 * 敌人实体（wiki 03-战斗总纲 / 03-敌人AI与行为 / 07-全敌人清单）。
 * M1：静态木桩（aiEnabled=false 的世界）；M2：行为模板 T1-T10（EnemyAI 驱动）。
 */
export class Enemy {
  readonly uid: number = nextUid++;
  readonly type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  armor: number;
  /**
   * 碰撞体半径。
   * TODO(wiki)：敌人清单未定标半径列，暂定 0.5（登记 10-dev 日志遗留问题 #4）；
   * 精英体型 ×1.2（wiki 03-敌人AI §三）。
   */
  radius: number;
  alive = true;

  /** 精英词条 ID（ELITE_AFFIXES；null = 普通敌） */
  eliteAffix: string | null = null;
  /** 有效攻击力（普通 = type.atk；精英 ×1.5） */
  atk: number;
  /** 有效移速（含迅捷词条 ×1.4） */
  speed: number;
  /** 朝向（弧度，追击时朝玩家；T4 盾卫格挡基准） */
  facing = 0;

  // ---- AI 运行时状态 ----
  phase: EnemyPhase = 'enter';
  /** 当前相位累计计时（s） */
  phaseT = 0;
  /** 攻击冷却剩余 */
  atkCd = 0;
  /** 决策节流（wiki §一：每 0.2s 决策一次） */
  decisionT = 0;
  /** 松散包围槽位角（wiki §四） */
  slotAngle = 0;
  /** 远程环绕方向 */
  strafeDir: 1 | -1 = 1;
  /** T8：平A 计数（达 comboToB 切三连斩） */
  comboCount = 0;
  /** T8：当前攻击模式（进入 windup 时决定） */
  attackMode: 'a' | 'b' = 'a';
  /** T3：本段冲锋是否已命中玩家（防多次判定） */
  chargeHit = false;
  /** 当前前摇总时长（渲染预警进度用；进入 windup 时由 AI 写入） */
  windupTotal = 0;
  /** T8：三连斩剩余段数 / 段间隔计时 */
  comboLeft = 0;
  comboT = 0;
  /** T3：冲刺方向与剩余时间 */
  chargeDirX = 0;
  chargeDirY = 0;
  chargeLeft = 0;
  /** 入场淡入剩余 */
  fadeT = 0;
  /** 受击停顿剩余（受击反应·硬直） */
  staggerT = 0;
  /** 硬直内在免疫剩余（防连续硬直锁死） */
  staggerImmuneT = 0;
  /** 击退速度（衰减） */
  kx = 0;
  ky = 0;
  /** 屏障词条护盾 */
  shield = 0;
  shieldT = 0;
  /** 自爆死亡标记（区分被击杀：自爆不掉落） */
  selfDestructed = false;

  constructor(type: EnemyType, x: number, y: number, overrides?: { hp?: number; armor?: number }) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = overrides?.hp ?? type.hp;
    this.maxHp = this.hp;
    this.armor = overrides?.armor ?? type.armor;
    this.radius = 0.5;
    this.atk = type.atk;
    this.speed = type.speed;
  }

  get isElite(): boolean {
    return this.eliteAffix !== null;
  }

  /** 护甲减伤率 DR = A/(A+100)，上限 0.85 */
  get dr(): number {
    return Math.min(this.armor / (this.armor + DAMAGE.armorRef), DAMAGE.drCap);
  }

  /** 是否触发刀的弹开演出（DR ≥ 60%，wiki 物理表现层） */
  get causesBounce(): boolean {
    return this.dr >= 0.6;
  }

  /** 狂暴词条：血 <30% 时攻速 +50%（体现为冷却加速；wiki 03-敌人AI §三） */
  get cooldownMult(): number {
    if (this.eliteAffix === 'frenzy' && this.hp / this.maxHp < ELITE.frenzyThreshold) {
      return 1 / ELITE.frenzyAtkSpeedMult;
    }
    return 1;
  }

  /** 应用精英词条（wiki §三：血×3 / 攻×1.5 / 体型×1.2 + 1 条词条效果） */
  applyElite(affixId: string): void {
    this.eliteAffix = affixId;
    this.maxHp = Math.round(this.type.hp * ELITE.hpMult);
    this.hp = this.maxHp;
    this.atk = Math.round(this.type.atk * ELITE.atkMult);
    this.radius = 0.5 * ELITE.sizeMult;
    if (affixId === 'swift') {
      // 迅捷词条 +40% 后 clamp 到移速红线（wiki 03-敌人AI §一：敌速 < 玩家×0.9，走位永远可行——硬约定优先于词条数值）
      this.speed = Math.min(this.type.speed * ELITE.swiftSpeedMult, ENEMY_SPEED_CAP);
    } else if (affixId === 'stone') {
      this.armor = this.type.armor + ELITE.stoneArmor;
    }
  }

  /** T4 盾卫：来自 (fromX,fromY) 方向的攻击是否被正面格挡（wiki §二：正面 120° 刀伤归零） */
  blocksFrom(fromX: number, fromY: number): boolean {
    if (this.type.tpl !== 'T4') return false;
    const a = Math.atan2(fromY - this.y, fromX - this.x);
    return Math.abs(normAngle(a - this.facing)) <= ((ENEMY_AI.T4.blockAngleDeg / 2) * Math.PI) / 180;
  }

  /**
   * 受击反馈（wiki §一 受击反应：硬直/击退）。
   * 硬直仅暂停移动、不打断前摇（前摇是承诺演出；打断留给 M3 重击 trait）。
   */
  applyHitFeedback(fromX: number, fromY: number): void {
    if (this.staggerImmuneT > 0) return;
    this.staggerT = ENEMY_HIT.stagger;
    this.staggerImmuneT = ENEMY_HIT.staggerImmune;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    // 击退在 0.1s 内完成 → 初速 = 距离 / 0.1
    this.kx = (dx / d) * (ENEMY_HIT.knockback / 0.1);
    this.ky = (dy / d) * (ENEMY_HIT.knockback / 0.1);
  }

  /** 受击；返回是否致死（护盾词条先吸收） */
  takeDamage(dmg: number): boolean {
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0.0001) return false;
    }
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  /** 木桩复活（M1 测试场用；M2 起死亡即移除） */
  revive(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.selfDestructed = false;
  }

  /** 屏障词条：每 10s 获得一层 30 点护盾（由 AI 每帧驱动） */
  updateBarrier(dt: number): void {
    if (this.eliteAffix !== 'barrier') return;
    this.shieldT += dt;
    if (this.shieldT >= ELITE.barrierInterval) {
      this.shieldT -= ELITE.barrierInterval;
      this.shield += ELITE.barrierAmount;
    }
  }

  /** 帧内通用计时衰减（AI 之外的物理反馈，独立于相位） */
  tickFeedback(dt: number): void {
    if (this.staggerT > 0) this.staggerT -= dt;
    if (this.staggerImmuneT > 0) this.staggerImmuneT -= dt;
    if (this.fadeT > 0) this.fadeT -= dt;
    // 击退速度指数衰减（0.1s 量级）
    const k = Math.max(0, 1 - dt / 0.1);
    this.kx *= k;
    this.ky *= k;
    if (Math.abs(this.kx) < 0.01) this.kx = 0;
    if (Math.abs(this.ky) < 0.01) this.ky = 0;
  }
}
