import { Enemy } from './Enemy';
import { Knife } from './Knife';
import { rollDamage } from './Damage';
import type { DamageBreakdown, HitPart } from './Damage';
import type { WeaponInstance } from './WeaponInstance';
import { SpatialHash } from './SpatialHash';
import { updateEnemy } from './EnemyAI';
import type { AIWorldView } from './EnemyAI';
import { Projectile, projectileBudgetReached, projectileHitsPlayer, updateProjectile } from './Projectile';
import type { Hazard } from './Hazard';
import { updateHazard } from './Hazard';
import { rollMaterialDrop } from './Drops';
import type { MaterialBag } from './Drops';
import { ARENA, BUDGET, DAMAGE, ELITE, PLAYER, PLAYER_HIT } from '../data/constants';
import type { EnemyType, MaterialId, Sys } from '../data/types';
import type { Rng } from '../core/Rng';
import { clamp, closestPointOnSegment } from '../core/math';

/** 走位输入（仅左键按住 + 指针世界坐标；UI 命中时由场景置 active=false） */
export interface MoveInput {
  active: boolean;
  worldX: number;
  worldY: number;
}

export interface HitEvent {
  enemy: Enemy;
  knife: Knife;
  breakdown: DamageBreakdown;
  /** 命中点（特效定位） */
  x: number;
  y: number;
  killed: boolean;
  /** T4 盾卫正面格挡（伤害归零，演出"格挡"） */
  blocked?: boolean;
}

/** 弹幕被刀摧毁事件（特效定位） */
export interface DeflectEvent {
  x: number;
  y: number;
  sys: Sys;
}

export interface CombatPlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
}

export interface CombatWorldOptions {
  /**
   * 敌人 AI 开关。
   * M1 木桩沙盒与一次性 DPS 模拟用 false（静态桩）；
   * M2+ 战斗节点用 true（默认）。
   */
  ai?: boolean;
}

/**
 * 战斗世界：玩家 / 刀阵 / 敌人 / 碰撞 / 伤害结算 / hit-stop / 敌 AI / 飞行物 / 危险区。
 * 纯逻辑模块（无渲染依赖）——tools 模拟器与游戏场景共用。
 */
export class CombatWorld implements AIWorldView {
  readonly player: CombatPlayerState;
  knives: Knife[] = [];
  enemies: Enemy[] = [];
  /** 飞行物（wiki 60fps 预算 ≤60） */
  projectiles: Projectile[] = [];
  /** 地面危险区（毒圈等） */
  hazards: Hazard[] = [];
  /** 战斗时间（s，hit-stop 期间冻结） */
  time = 0;

  /** 击杀触发的全局命中停顿（≤0.05s，wiki 可访问性·命中停顿） */
  hitStop = 0;

  /** 本帧命中事件（场景消费后清空） */
  hits: HitEvent[] = [];
  /** 本帧弹幕被摧毁事件（场景消费后清空） */
  deflections: DeflectEvent[] = [];

  /** 局内材料累积（按怪结算；金币/刀为节点结算，见 Drops.rollNodeRewards） */
  loot: MaterialBag = {};

  /** 玩家受击无敌帧/红闪剩余 */
  playerInvulnT = 0;
  playerFlashT = 0;
  /** 玩家静止持续时长（T3 防挂机判定） */
  playerStillT = 0;

  /** 统计：DPS 滚动窗口（近 10s）与累计 */
  damageLog: { t: number; dmg: number }[] = [];
  totalDamage = 0;
  kills = 0;

  readonly aiEnabled: boolean;

  private hash = new SpatialHash<Enemy>(BUDGET.hashCell);

  constructor(
    readonly rng: Rng,
    spawnX = ARENA.w / 2,
    spawnY = ARENA.h / 2,
    opts?: CombatWorldOptions,
  ) {
    this.player = {
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      hp: PLAYER.baseHp,
      maxHp: PLAYER.baseHp,
    };
    this.aiEnabled = opts?.ai ?? true;
  }

  /** 设置上阵编队（weapon_instance 列表），相位重新均匀分布 */
  setLoadout(instances: readonly WeaponInstance[]): void {
    this.knives = instances.map(
      (inst, i) => new Knife(inst, i, instances.length, this.rng.range(0, Math.PI * 2)),
    );
    this.damageLog.length = 0;
    this.totalDamage = 0;
    this.kills = 0;
    this.time = 0;
  }

  spawnEnemy(type: EnemyType, x: number, y: number, overrides?: { hp?: number; armor?: number }): Enemy {
    const e = new Enemy(type, x, y, overrides);
    this.enemies.push(e);
    return e;
  }

  removeEnemy(enemy: Enemy): void {
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    for (const k of this.knives) k.forgetEnemy(enemy.uid);
  }

  update(dt: number, move: MoveInput): void {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return; // hit-stop：世界冻结（演出顿挫）
    }

    this.time += dt;
    this.updatePlayer(dt, move);
    for (const k of this.knives) {
      k.update(dt, this.player.x, this.player.y);
    }

    // 空间哈希每帧全量刷新（仅活敌）
    this.hash.clear();
    for (const e of this.enemies) {
      if (e.alive) this.hash.insert(e, e.x, e.y, e.radius);
    }

    this.hits.length = 0;
    this.deflections.length = 0;
    this.resolveKnifeHits();

    if (this.aiEnabled) {
      // 快照遍历：本帧分裂/召唤的新敌下一帧才行动
      for (const e of [...this.enemies]) {
        updateEnemy(e, this, dt);
      }
      this.updateProjectiles(dt);
      this.updateHazards(dt);
      this.removeDeadEnemies();
    }

    // 修剪 DPS 窗口（10s）
    const cutoff = this.time - 10;
    while (this.damageLog.length > 0 && (this.damageLog[0] as { t: number }).t < cutoff) {
      this.damageLog.shift();
    }
  }

  /** 近 10s 滚动 DPS（前 10s 用已流逝时间） */
  get dps(): number {
    const window = Math.min(this.time, 10);
    if (window <= 0.5) return 0;
    let sum = 0;
    for (const e of this.damageLog) sum += e.dmg;
    return sum / window;
  }

  // ---------------- AIWorldView 实现 ----------------

  damagePlayer(amount: number, opts?: { ignoreInvuln?: boolean }): boolean {
    if (this.player.hp <= 0) return false;
    if (!opts?.ignoreInvuln) {
      if (this.playerInvulnT > 0) return false;
      this.playerInvulnT = PLAYER_HIT.invuln;
    }
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.playerFlashT = PLAYER_HIT.flash;
    return true;
  }

  spawnProjectile(p: Projectile): void {
    if (projectileBudgetReached(this.projectiles.length)) return; // 红线：≤60
    this.projectiles.push(p);
  }

  spawnHazard(h: Hazard): void {
    this.hazards.push(h);
  }

  // ---------------- 内部结算 ----------------

  /** 仅左键走位（wiki 05-操作方案）：按住→朝指针移动；<0.2u 贴齐；松开 0.1s 减速停 */
  private updatePlayer(dt: number, move: MoveInput): void {
    const p = this.player;
    if (move.active) {
      const dx = move.worldX - p.x;
      const dy = move.worldY - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.2) {
        p.x = move.worldX;
        p.y = move.worldY;
        p.vx = 0;
        p.vy = 0;
      } else {
        p.vx = (dx / d) * PLAYER.speed;
        p.vy = (dy / d) * PLAYER.speed;
      }
    } else {
      const k = Math.max(0, 1 - dt / 0.1);
      p.vx *= k;
      p.vy *= k;
      if (Math.abs(p.vx) < 0.01) p.vx = 0;
      if (Math.abs(p.vy) < 0.01) p.vy = 0;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 擂台空气墙
    const r = PLAYER.radius;
    p.x = clamp(p.x, r, ARENA.w - r);
    p.y = clamp(p.y, r, ARENA.h - r);

    // 玩家静止计时（T3 防挂机）
    this.playerStillT = Math.hypot(p.vx, p.vy) < 0.5 ? this.playerStillT + dt : 0;
    if (this.playerInvulnT > 0) this.playerInvulnT -= dt;
    if (this.playerFlashT > 0) this.playerFlashT -= dt;
  }

  /**
   * 刀-敌碰撞与伤害结算。
   * 判定优先级：刀尖（系数 1.6）> 刀身线段（系数 1.0）；
   * 刀尖：|P_tip − 敌心| < r + 0.1；刀身：线段-圆相交（含刀宽）。
   * T4 盾卫正面 120° 内刀伤归零（wiki 03-敌人AI §二；ignore_block 特性 M3 接入）。
   */
  private resolveKnifeHits(): void {
    const playerSpeed = Math.hypot(this.player.vx, this.player.vy);

    for (const knife of this.knives) {
      // 刀几何包围盒（外扩敌半径+刀宽）→ 哈希粗筛
      const pad = 0.6 + knife.width;
      const minX = Math.min(knife.tailX, knife.tipX) - pad;
      const maxX = Math.max(knife.tailX, knife.tipX) + pad;
      const minY = Math.min(knife.tailY, knife.tipY) - pad;
      const maxY = Math.max(knife.tailY, knife.tipY) + pad;
      const candidates = this.hash.queryRect(minX, minY, maxX, maxY);

      for (const enemy of candidates) {
        if (!enemy.alive) continue;
        if (!knife.canHit(enemy.uid, this.time)) continue;

        // 刀尖判定
        const tipDx = knife.tipX - enemy.x;
        const tipDy = knife.tipY - enemy.y;
        const tipHit = tipDx * tipDx + tipDy * tipDy < (enemy.radius + 0.1) ** 2;

        let part: HitPart;
        let hx: number;
        let hy: number;
        if (tipHit) {
          part = 'tip';
          hx = knife.tipX;
          hy = knife.tipY;
        } else {
          // 刀身线段-圆判定
          const c = closestPointOnSegment(
            enemy.x, enemy.y,
            knife.tailX, knife.tailY,
            knife.tipX, knife.tipY,
          );
          const dx = c.x - enemy.x;
          const dy = c.y - enemy.y;
          if (dx * dx + dy * dy >= (enemy.radius + knife.width / 2) ** 2) continue;
          part = 'body';
          hx = c.x;
          hy = c.y;
        }

        // T4 盾卫格挡：命中点在敌正面扇形内 → 伤害归零
        if (enemy.blocksFrom(hx, hy)) {
          knife.registerHit(enemy.uid, this.time);
          this.hits.push({ enemy, knife, breakdown: zeroBreakdown(part), x: hx, y: hy, killed: false, blocked: true });
          continue;
        }

        const bd = rollDamage(
          {
            atk: knife.inst.atk,
            part,
            spin: knife.spinSpeed,
            orbit: knife.orbitSpeed,
            playerSpeed,
            critChance: DAMAGE.critBase,
            critMult: DAMAGE.critMultBase,
            knifeSys: knife.inst.type.sys,
            enemySys: enemy.type.sys,
            enemyArmor: enemy.armor,
          },
          this.rng,
        );

        knife.registerHit(enemy.uid, this.time);
        const killed = enemy.takeDamage(bd.damage);
        enemy.applyHitFeedback(this.player.x, this.player.y); // 受击反馈：硬直 + 击退
        this.totalDamage += bd.damage;
        this.damageLog.push({ t: this.time, dmg: bd.damage });

        this.hits.push({ enemy, knife, breakdown: bd, x: hx, y: hy, killed });

        if (killed) {
          this.kills++;
          knife.applyHitLag(); // 卡刀顿挫
          this.hitStop = 0.05; // 命中停顿（≤0.05s 红线）
        } else if (enemy.causesBounce) {
          knife.applyBounce(this.rng.next()); // 弹开演出（不改伤害）
        }
      }
    }
  }

  /** 飞行物：推进 + 刀摧毁 + 玩家命中（无敌帧 = 穿过） */
  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      if (!updateProjectile(p, dt)) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // 刀摧毁（可摧毁弹：T5 鱼叉；T10 剑气可躲不可挡）
      if (p.destructible && this.destroyedByKnife(p)) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // 玩家命中
      if (!p.hitPlayer && projectileHitsPlayer(p, this.player.x, this.player.y, PLAYER.radius)) {
        p.hitPlayer = true; // 接触即标记（无敌帧闪避 = 穿过）
        if (this.damagePlayer(p.damage)) {
          this.healOwner(p.ownerUid, p.damage); // 吸血词条（弹幕命中）
          if (p.destructible) this.projectiles.splice(i, 1); // 剑气穿透继续飞
        }
      }
    }
  }

  /** 刀-弹碰撞：任一刀身线段（含刀尖）接触弹心 */
  private destroyedByKnife(p: Projectile): boolean {
    for (const k of this.knives) {
      // 刀尖点
      const tdx = k.tipX - p.x;
      const tdy = k.tipY - p.y;
      if (tdx * tdx + tdy * tdy < (p.radius + 0.12) ** 2) {
        this.deflections.push({ x: p.x, y: p.y, sys: p.sys });
        return true;
      }
      // 刀身线段
      const c = closestPointOnSegment(p.x, p.y, k.tailX, k.tailY, k.tipX, k.tipY);
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      if (dx * dx + dy * dy < (p.radius + k.width / 2) ** 2) {
        this.deflections.push({ x: p.x, y: p.y, sys: p.sys });
        return true;
      }
    }
    return false;
  }

  /** 危险区推进 + 玩家 DoT（毒圈不吃受击无敌帧） */
  private updateHazards(dt: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]!;
      const dmg = updateHazard(h, dt, this.player.x, this.player.y, PLAYER.radius);
      if (dmg > 0) this.damagePlayer(dmg, { ignoreInvuln: true });
      if (!h.alive) this.hazards.splice(i, 1);
    }
  }

  /** 死亡敌人清理：材料掉落（精英×2）+ 分裂词条 + 移除 */
  private removeDeadEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      if (e.alive) continue;
      if (e.selfDestructed) {
        // 自爆死亡：不掉落、不计击杀（非玩家击杀）
        this.removeEnemy(e);
        continue;
      }
      this.collectMaterials(e);
      if (e.eliteAffix === 'split') this.spawnSplits(e);
      this.removeEnemy(e);
    }
  }

  private collectMaterials(e: Enemy): void {
    const gained = rollMaterialDrop(e.type.materialDrop, this.rng);
    const mult = e.isElite ? ELITE.materialMult : 1;
    for (const [id, n] of Object.entries(gained)) {
      const key = id as MaterialId;
      this.loot[key] = (this.loot[key] ?? 0) + (n ?? 0) * mult;
    }
  }

  /** 分裂词条：死亡时分裂 2 只小体（血量 25%，无词条） */
  private spawnSplits(e: Enemy): void {
    const hp = Math.max(1, Math.round(e.maxHp * ELITE.splitHpPct));
    for (let i = 0; i < ELITE.splitCount; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const x = clamp(e.x + Math.cos(a) * 0.7, e.radius, ARENA.w - e.radius);
      const y = clamp(e.y + Math.sin(a) * 0.7, e.radius, ARENA.h - e.radius);
      const child = this.spawnEnemy(e.type, x, y, { hp });
      child.fadeT = 0.2;
      child.phase = 'enter';
      child.phaseT = 0;
      child.slotAngle = (child.uid * 2.399963) % (Math.PI * 2);
    }
  }

  /** 弹幕命中后为持有者回血（吸血词条） */
  private healOwner(ownerUid: number, dmg: number): void {
    for (const e of this.enemies) {
      if (e.uid === ownerUid && e.alive && e.eliteAffix === 'leech') {
        e.hp = Math.min(e.maxHp, e.hp + dmg * ELITE.leechPct);
        return;
      }
    }
  }
}

/** 格挡命中的零伤害分解（演出用） */
function zeroBreakdown(part: HitPart): DamageBreakdown {
  return {
    damage: 0,
    part,
    partMult: part === 'tip' ? DAMAGE.tipFactor : DAMAGE.bodyFactor,
    vBonus: 0,
    crit: false,
    critMult: 1,
    counterMult: 1,
    counterLabel: '—',
    dr: 0,
  };
}
