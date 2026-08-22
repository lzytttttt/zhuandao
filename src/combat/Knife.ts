import type { WeaponInstance } from './WeaponInstance';
import { HIT } from '../data/constants';
import { TAU } from '../core/math';

/**
 * 运行时刀实体（wiki 03-转刀机制）。
 * 运动模型：θd = θd0 + ω_orbit·t（公转）；θs = θs0 + ω_spin·t（自旋）；
 * 刀刃朝向 φ = θs + 公转切向偏置（刀尖指向运动方向，"甩鞭"姿态）。
 * 碰撞几何：刀身线段 [P−0.3L·u, P+0.5L·u]，刀尖 = 线段端点（系数 1.6）。
 */
export class Knife {
  readonly inst: WeaponInstance;

  /** 公转角 θd（弧度） */
  orbitAngle: number;
  /** 自旋累积角 θs（弧度） */
  spinAngle: number;
  /** 当前公转速度（圈/s；词缀修正后，M1 = 基础值） */
  orbitSpeed: number;
  /** 当前自旋速度（圈/s） */
  spinSpeed: number;
  /** 当前公转半径（单位） */
  radius: number;
  /** 刀长（TODO：wiki 未定标，暂按重量推导，见 10-dev 日志遗留 #1） */
  readonly length: number;
  /** 刀宽（碰撞判定用，同上暂定） */
  readonly width: number;

  /** 演出：卡刀（击杀顿挫 0.2s，运动 ×0.3） */
  hitLag = 0;
  /** 演出：加速（弹开/弹射，公转 ×2） */
  boost = 0;

  /** 每帧缓存的几何状态 */
  x = 0;
  y = 0;
  phi = 0;
  tailX = 0;
  tailY = 0;
  tipX = 0;
  tipY = 0;

  /** 命中冷却：敌人 uid → 上次命中时刻（同刀同敌 ≥0.4s） */
  private lastHit = new Map<number, number>();

  constructor(inst: WeaponInstance, index: number, count: number, initialSpin: number) {
    this.inst = inst;
    // 相位均匀分布：θd0 = 2π·i/n（wiki 转刀机制 §一）
    this.orbitAngle = (TAU * index) / count;
    this.spinAngle = initialSpin;
    this.orbitSpeed = inst.type.orbit;
    this.spinSpeed = inst.type.spin;
    this.radius = inst.type.radius;
    this.length = 0.55 + 0.14 * inst.type.weight;
    this.width = 0.09 + inst.type.weight * 0.025;
  }

  /** 刀尖速度是否触发拖尾（ω_spin > 1.5 圈/s，wiki 物理表现层） */
  get hasTrail(): boolean {
    return this.spinSpeed > 1.5;
  }

  update(dt: number, px: number, py: number): void {
    if (this.hitLag > 0) this.hitLag -= dt;
    if (this.boost > 0) this.boost -= dt;

    const speedK = (this.hitLag > 0 ? 0.3 : 1) * (this.boost > 0 ? 2 : 1);
    this.orbitAngle += this.orbitSpeed * TAU * dt * speedK;
    this.spinAngle += this.spinSpeed * TAU * dt * speedK;

    this.x = px + this.radius * Math.cos(this.orbitAngle);
    this.y = py + this.radius * Math.sin(this.orbitAngle);
    this.phi = this.spinAngle + this.orbitAngle + Math.PI / 2;

    const ux = Math.cos(this.phi);
    const uy = Math.sin(this.phi);
    this.tailX = this.x - this.length * 0.3 * ux;
    this.tailY = this.y - this.length * 0.3 * uy;
    this.tipX = this.x + this.length * 0.5 * ux;
    this.tipY = this.y + this.length * 0.5 * uy;
  }

  /** 命中冷却判定（wiki：同刀同敌两次判定间隔 ≥ 0.4s） */
  canHit(enemyUid: number, time: number): boolean {
    const last = this.lastHit.get(enemyUid);
    return last === undefined || time - last >= HIT.cooldown;
  }

  registerHit(enemyUid: number, time: number): void {
    this.lastHit.set(enemyUid, time);
  }

  /** 敌人死亡时清除该敌的冷却记录 */
  forgetEnemy(enemyUid: number): void {
    this.lastHit.delete(enemyUid);
  }

  /** 卡刀：击杀顿挫（wiki 物理表现层） */
  applyHitLag(): void {
    this.hitLag = 0.2;
  }

  /** 弹开：刀瞬间偏转 30° 并短暂加速（命中 DR≥60% 敌；不改伤害） */
  applyBounce(rngRandom: number): void {
    const dir = rngRandom < 0.5 ? -1 : 1;
    this.orbitAngle += dir * (Math.PI / 6);
    this.boost = 0.15;
  }
}
