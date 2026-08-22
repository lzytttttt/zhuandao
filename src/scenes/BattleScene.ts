import type { Game } from '../core/Game';
import type { Scene } from './Scene';
import { CombatWorld } from '../combat/CombatWorld';
import { WaveDirector } from '../combat/WaveDirector';
import type { NodeKind } from '../combat/WaveDirector';
import { makeWeapon } from '../combat/WeaponInstance';
import type { WeaponInstance } from '../combat/WeaponInstance';
import { rollNodeRewards } from '../combat/Drops';
import type { NodeReward } from '../combat/Drops';
import { breakdownText } from '../combat/Damage';
import type { Enemy } from '../combat/Enemy';
import type { Projectile } from '../combat/Projectile';
import { TEST_LOADOUTS, RARITY_COLOR } from '../combat/testLoadouts';
import { WEAPONS } from '../data/knives';
import { ENEMIES } from '../data/enemies';
import { ARENA, ENEMY_AI, PLAYER, SYS_COLOR, WAVE } from '../data/constants';
import { MATERIAL_NAMES } from '../data/types';
import type { MaterialId } from '../data/types';
import { FxPool } from '../render/Fx';
import { TAU, clamp } from '../core/math';
import { SandboxScene } from './SandboxScene';

/** 左下按钮组（CSS 像素；≥48×48 触屏合规） */
const BTN = {
  loadout: { x: 12, y: 104, w: 232, h: 48 },
  kind: { x: 12, y: 160, w: 232, h: 48 },
  sandbox: { x: 12, y: 216, w: 232, h: 48 },
};

/** 提示大字时长 */
const ANNOUNCE_TIME = 1.6;

/**
 * M2 战斗节点（wiki 03-敌人AI与行为 / 07-全敌人清单 §四）：
 * 流程：入场演出 → 波次（WAVES 表 + 精英词条）→ 全灭 → 波间间隔 → 节点结算（金币/刀/材料）。
 * 验收：域 1 波次可完整战斗，节点结算掉落。
 */
export class BattleScene implements Scene {
  private world: CombatWorld;
  private director: WaveDirector;
  private fx = new FxPool();
  private loadoutIndex = 0;
  private kind: NodeKind = 'normal';
  /** 节点结算（done 时 roll 一次） */
  private reward: NodeReward | null = null;
  /** 战斗计时（结算统计） */
  private battleT = 0;
  /** 承伤统计 */
  private damageTaken = 0;
  /** 大字提示 */
  private announce = '';
  private announceSub = '';
  private announceT = ANNOUNCE_TIME;
  private prevPhase: string = 'enter';
  private prevWaveIndex = -1;
  /** 刀尖拖尾（与 world.knives 索引对齐） */
  private trails: Array<Array<{ x: number; y: number }>> = [];
  /** 最近命中日志（最新在下） */
  private hitLog: string[] = [];

  constructor(private readonly game: Game) {
    this.world = this.createWorld();
    this.director = new WaveDirector(1, this.kind, this.game.rng);
  }

  enter(): void {
    this.restart();
  }

  exit(): void {}

  update(dt: number): void {
    this.handleClicks();

    const settled = this.director.phase === 'done' || this.director.phase === 'fail';
    if (settled) {
      this.fx.update(dt);
      this.announceT += dt;
      return;
    }

    // UI 命中区域抑制走位
    const input = this.game.input;
    const overUI = this.isOverAnyButton(input.cssX, input.cssY);
    const hpBefore = this.world.player.hp;
    this.world.update(dt, {
      active: input.leftDown && input.inside && !overUI,
      worldX: input.worldX,
      worldY: input.worldY,
    });
    this.damageTaken += Math.max(0, hpBefore - this.world.player.hp);

    this.director.update(dt, this.world);
    if (this.world.player.hp <= 0) this.director.forceFail();
    this.battleT += dt;

    // 节点胜利 → 结算 roll（一次）
    if (this.director.phase === 'done' && this.reward === null) {
      this.reward = rollNodeRewards(this.director.domain, this.kind, this.game.rng);
    }

    this.updateAnnounce();

    // 消费命中事件 → 特效与日志
    for (const hit of this.world.hits) {
      const bd = hit.breakdown;
      if (hit.blocked) {
        this.fx.addDamageText(hit.x, hit.y, 0, 'blocked');
        this.fx.addSpark(hit.x, hit.y, '#cfd6e4', () => this.game.rng.next());
        this.hitLog.push(`${hit.enemy.type.name} 格挡了 ${hit.knife.inst.type.name}`);
      } else {
        const kind = bd.crit
          ? 'crit'
          : bd.counterLabel === '克'
            ? 'counter'
            : bd.counterLabel === '被克'
              ? 'countered'
              : 'normal';
        this.fx.addDamageText(hit.x, hit.y, bd.damage, kind);
        this.fx.addSpark(hit.x, hit.y, SYS_COLOR[hit.knife.inst.type.sys], () => this.game.rng.next());
        this.hitLog.push(
          `${hit.knife.inst.type.name} ${bd.part === 'tip' ? '尖' : '身'} ${Math.round(bd.damage)} │ ${breakdownText(bd)}`,
        );
      }
      if (hit.killed) {
        this.fx.addDeathBurst(hit.enemy.x, hit.enemy.y, hit.enemy.radius, SYS_COLOR[hit.enemy.type.sys], () =>
          this.game.rng.next(),
        );
        this.fx.addSpark(hit.enemy.x, hit.enemy.y, '#ffd94d', () => this.game.rng.next());
        const dropText = hit.enemy.isElite ? '（精英）' : '';
        this.hitLog.push(`击杀 ${hit.enemy.type.name}${dropText}`);
      }
      if (this.hitLog.length > 6) this.hitLog.shift();
    }

    // 弹幕被刀摧毁 → 火花
    for (const d of this.world.deflections) {
      this.fx.addSpark(d.x, d.y, SYS_COLOR[d.sys], () => this.game.rng.next());
      this.hitLog.push(`刀光击落飞行物`);
      if (this.hitLog.length > 6) this.hitLog.shift();
    }

    // 刀尖拖尾采样
    while (this.trails.length < this.world.knives.length) this.trails.push([]);
    for (let i = 0; i < this.world.knives.length; i++) {
      const k = this.world.knives[i]!;
      const trail = this.trails[i]!;
      if (k.hasTrail) {
        trail.push({ x: k.tipX, y: k.tipY });
        if (trail.length > 14) trail.shift();
      } else if (trail.length > 0) {
        trail.shift();
      }
    }

    this.fx.update(dt);
    this.announceT += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawArena(ctx);
    this.drawOrbitGuides(ctx);
    for (const h of this.world.hazards) this.drawHazard(ctx, h);
    for (const e of this.world.enemies) this.drawEnemy(ctx, e);
    for (const p of this.world.projectiles) this.drawProjectile(ctx, p);
    for (let i = 0; i < this.world.knives.length; i++) {
      this.drawTrail(ctx, this.trails[i] ?? []);
      this.drawKnife(ctx, this.world.knives[i]!);
    }
    this.drawPlayer(ctx);
    this.fx.renderWorld(ctx);
  }

  renderOverlay(ctx: CanvasRenderingContext2D): void {
    this.drawHitFlash(ctx);
    this.drawHpBar(ctx);
    if (this.director.phase === 'done' || this.director.phase === 'fail') {
      this.drawResultPanel(ctx);
    } else {
      this.drawButtons(ctx);
    }
    this.drawAnnounce(ctx);
    this.drawHitLog(ctx);
    this.drawEnemyLabels(ctx);
  }

  hudLines(): string[] {
    const lo = TEST_LOADOUTS[this.loadoutIndex]!;
    const d = this.director;
    const phaseText =
      d.phase === 'enter'
        ? '入场'
        : d.phase === 'wave'
          ? `第 ${d.waveIndex + 1}/${d.waveTotal} 波`
          : d.phase === 'gap'
            ? '下一波来袭'
            : d.phase === 'done'
              ? '肃清'
              : '失败';
    return [
      `M2 战斗节点 · 域1 ${this.kind === 'normal' ? '普通' : '精英'}节点 · ${phaseText} · 余敌 ${this.world.enemies.length}`,
      `DPS(10s) ${this.world.dps.toFixed(1)} │ 总伤 ${Math.round(this.world.totalDamage)} │ 击杀 ${this.world.kills} │ 承伤 ${Math.round(this.damageTaken)}`,
      `编队：${lo.name}（${lo.desc}）│ 按住左键走位，绕开红圈与弹幕`,
    ];
  }

  // ---------- 流程控制 ----------

  private createWorld(): CombatWorld {
    return new CombatWorld(this.game.rng, ARENA.w / 2, ARENA.h / 2, { ai: true });
  }

  private restart(): void {
    this.world = this.createWorld();
    this.director = new WaveDirector(1, this.kind, this.game.rng);
    this.applyLoadout(this.loadoutIndex);
    this.reward = null;
    this.battleT = 0;
    this.damageTaken = 0;
    this.trails = [];
    this.hitLog = [];
    this.setAnnounce('战斗开始', `域1 ${this.kind === 'normal' ? '普通' : '精英'}节点 · ${this.director.waveTotal} 波`);
    this.prevPhase = 'enter';
    this.prevWaveIndex = -1;
  }

  private applyLoadout(index: number): void {
    this.loadoutIndex = index;
    const lo = TEST_LOADOUTS[index]!;
    const instances: WeaponInstance[] = lo.items.map(([id, rarity]) => makeWeapon(WEAPONS[id]!, rarity));
    this.world.setLoadout(instances);
    this.trails = instances.map(() => []);
    this.hitLog = [];
  }

  private handleClicks(): void {
    for (const click of this.game.input.drainClicks()) {
      const settled = this.director.phase === 'done' || this.director.phase === 'fail';
      if (settled) {
        // 结算面板按钮（坐标在 drawResultPanel 中定义）
        const btn = this.resultPanelRects();
        if (this.inRect(click.cssX, click.cssY, btn.retry)) {
          this.restart();
          return;
        }
        if (this.inRect(click.cssX, click.cssY, btn.sandbox)) {
          this.game.switchScene(new SandboxScene(this.game));
          return;
        }
        continue;
      }
      if (this.inRect(click.cssX, click.cssY, BTN.loadout)) {
        this.applyLoadout((this.loadoutIndex + 1) % TEST_LOADOUTS.length);
      } else if (this.inRect(click.cssX, click.cssY, BTN.kind)) {
        this.kind = this.kind === 'normal' ? 'elite' : 'normal';
        this.restart();
      } else if (this.inRect(click.cssX, click.cssY, BTN.sandbox)) {
        this.game.switchScene(new SandboxScene(this.game));
      }
    }
  }

  private isOverAnyButton(cssX: number, cssY: number): boolean {
    return (
      this.inRect(cssX, cssY, BTN.loadout) ||
      this.inRect(cssX, cssY, BTN.kind) ||
      this.inRect(cssX, cssY, BTN.sandbox)
    );
  }

  private inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private updateAnnounce(): void {
    const d = this.director;
    if (d.phase !== this.prevPhase || d.waveIndex !== this.prevWaveIndex) {
      if (d.phase === 'wave' && d.waveIndex !== this.prevWaveIndex) {
        this.setAnnounce(`第 ${d.waveIndex + 1} / ${d.waveTotal} 波`, this.waveSummary(d.waves[d.waveIndex]));
      } else if (d.phase === 'gap') {
        this.setAnnounce('下一波来袭…', '把握走位间歇');
      } else if (d.phase === 'done') {
        this.setAnnounce('节点肃清！', '结算中');
      } else if (d.phase === 'fail') {
        this.setAnnounce('侠士陨落…', '节点失败');
      }
      this.prevPhase = d.phase;
      this.prevWaveIndex = d.waveIndex;
    }
  }

  private waveSummary(wave: { enemyId: string; count: number; eliteCount: number }[] | undefined): string {
    if (!wave) return '';
    return wave
      .map((e) => `${ENEMIES[e.enemyId]?.name ?? e.enemyId}×${e.count}${e.eliteCount > 0 ? `（精英×${e.eliteCount}）` : ''}`)
      .join(' · ');
  }

  private setAnnounce(main: string, sub: string): void {
    this.announce = main;
    this.announceSub = sub;
    this.announceT = 0;
  }

  // ---------- 世界系渲染 ----------

  private drawArena(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#141821';
    ctx.fillRect(0, 0, ARENA.w, ARENA.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let x = 2; x < ARENA.w; x += 2) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA.h);
    }
    for (let y = 2; y < ARENA.h; y += 2) {
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA.w, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,178,94,0.55)';
    ctx.lineWidth = 0.08;
    ctx.strokeRect(0, 0, ARENA.w, ARENA.h);
  }

  private drawOrbitGuides(ctx: CanvasRenderingContext2D): void {
    const p = this.world.player;
    const radii = new Set(this.world.knives.map((k) => k.radius));
    ctx.setLineDash([0.25, 0.35]);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.02;
    for (const r of radii) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  /** 毒圈（T6 毒雾师 DoT 区域） */
  private drawHazard(ctx: CanvasRenderingContext2D, h: { x: number; y: number; radius: number; duration: number; t: number }): void {
    const remain = 1 - h.t / h.duration;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, TAU);
    ctx.fillStyle = 'rgba(142,224,77,0.10)';
    ctx.fill();
    ctx.strokeStyle = `rgba(142,224,77,${0.2 + remain * 0.2})`;
    ctx.lineWidth = 0.05;
    ctx.stroke();
    // 剩余进度弧
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * remain);
    ctx.strokeStyle = 'rgba(142,224,77,0.5)';
    ctx.lineWidth = 0.04;
    ctx.stroke();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (!e.alive) return;
    const alpha = e.fadeT > 0 ? clamp(1 - e.fadeT / WAVE.spawnFade, 0.2, 1) : 1;

    // ---- 预警演出（前摇红圈 / 冲锋线 / 自爆红圈）----
    this.drawEnemyWarnings(ctx, e);

    ctx.globalAlpha = alpha;

    // 精英金圈（wiki 03-敌人AI §三）
    if (e.isElite) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 0.16, 0, TAU);
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 0.07;
      ctx.stroke();
    }

    // 本体
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, TAU);
    ctx.fillStyle = '#232936';
    ctx.fill();
    ctx.strokeStyle = SYS_COLOR[e.type.sys];
    ctx.lineWidth = 0.07;
    ctx.stroke();
    // 朝向"眉标"
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(e.facing) * e.radius * 0.55, e.y + Math.sin(e.facing) * e.radius * 0.55, e.radius * 0.22, 0, TAU);
    ctx.fillStyle = SYS_COLOR[e.type.sys];
    ctx.fill();

    // T4 盾卫：正面 120° 盾弧（亮色，绕背教学的可读性）
    if (e.type.tpl === 'T4') {
      const half = ((ENEMY_AI.T4.blockAngleDeg / 2) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 0.08, e.facing - half, e.facing + half);
      ctx.strokeStyle = 'rgba(240,244,255,0.85)';
      ctx.lineWidth = 0.1;
      ctx.stroke();
    }

    // 屏障护盾（词条）
    if (e.shield > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 0.26, 0, TAU);
      ctx.strokeStyle = 'rgba(125,196,255,0.6)';
      ctx.lineWidth = 0.04;
      ctx.stroke();
    }

    // 硬直演出：闪白
    if (e.staggerT > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /** 敌人攻击预警（wiki：前摇红色警示圈，保证走位可躲） */
  private drawEnemyWarnings(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const p = this.world.player;
    const red = (a: number) => `rgba(255,80,70,${a})`;

    if (e.phase === 'windup' && e.windupTotal > 0) {
      const t = clamp(e.phaseT / e.windupTotal, 0, 1);
      if (e.type.tpl === 'T10') {
        // 剑气矩形预警（朝玩家锁定方向）
        const len = ENEMY_AI.T10.swordLength;
        const w = ENEMY_AI.T10.swordWidth;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.facing);
        ctx.fillStyle = red(0.08 + t * 0.14);
        ctx.fillRect(e.radius * 0.5, -w / 2, len, w);
        ctx.strokeStyle = red(0.3 + t * 0.3);
        ctx.lineWidth = 0.03;
        ctx.strokeRect(e.radius * 0.5, -w / 2, len, w);
        ctx.restore();
      } else if (e.type.tpl === 'T5' || e.type.tpl === 'T6') {
        // 远程抬手：小警戒圈 + 朝向亮线
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 0.35, 0, TAU);
        ctx.strokeStyle = red(0.25 + t * 0.35);
        ctx.lineWidth = 0.05;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = red(0.1 + t * 0.15);
        ctx.lineWidth = 0.03;
        ctx.stroke();
      } else {
        // 近战范围红圈
        const r = attackRangeOf(e);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, TAU);
        ctx.fillStyle = red(t * 0.16);
        ctx.fill();
        ctx.strokeStyle = red(0.3 + t * 0.4);
        ctx.lineWidth = 0.05;
        ctx.stroke();
      }
    }

    if (e.phase === 'chargeWindup') {
      // 冲锋线预警
      const t = clamp(e.phaseT / ENEMY_AI.T3.windup, 0, 1);
      const len = ENEMY_AI.T3.chargeSpeed * ENEMY_AI.T3.chargeTime * 0.7;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(e.chargeDirY, e.chargeDirX));
      ctx.fillStyle = red(0.06 + t * 0.12);
      ctx.fillRect(0, -e.radius, len, e.radius * 2);
      ctx.strokeStyle = red(0.25 + t * 0.35);
      ctx.lineWidth = 0.03;
      ctx.strokeRect(0, -e.radius, len, e.radius * 2);
      ctx.restore();
    }

    if (e.phase === 'fusing') {
      // 自爆红圈（脉动渐强）
      const t = clamp(e.phaseT / ENEMY_AI.T9.fuse, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(e.phaseT * 18);
      const r = ENEMY_AI.T9.blastRadius;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fillStyle = red((0.1 + t * 0.18) * (0.7 + pulse * 0.3));
      ctx.fill();
      ctx.strokeStyle = red(0.45 + t * 0.4);
      ctx.lineWidth = 0.06;
      ctx.stroke();
    }
  }

  /** 飞行物：鱼叉（圆）+ 剑气（矩形） */
  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    const color = SYS_COLOR[p.sys];
    if (p.shape === 'circle') {
      // 尾迹
      const len = 0.5;
      const d = Math.hypot(p.vx, p.vy) || 1;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = p.radius * 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / d) * len, p.y - (p.vy / d) * len);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 弹体
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.03;
      ctx.stroke();
    } else {
      // 剑气：旋转矩形 + 中心亮线
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.fillRect(-p.halfLen, -p.radius, p.halfLen * 2, p.radius * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(-p.halfLen, -p.radius * 0.25, p.halfLen * 2, p.radius * 0.5);
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.world.player;
    // 脚底锚点光圈
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.62, 0, TAU);
    ctx.strokeStyle = 'rgba(240,244,255,0.35)';
    ctx.lineWidth = 0.05;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, TAU);
    ctx.fillStyle = '#f2f4fa';
    ctx.fill();
    ctx.strokeStyle = this.world.playerFlashT > 0 ? '#ff6a5c' : 'rgba(20,24,33,0.6)';
    ctx.lineWidth = 0.05;
    ctx.stroke();

    // 受击无敌帧：残影圈
    if (this.world.playerInvulnT > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 0.14, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${0.25 * (this.world.playerInvulnT / 0.8)})`;
      ctx.lineWidth = 0.03;
      ctx.stroke();
    }
  }

  private drawKnife(ctx: CanvasRenderingContext2D, k: { inst: { type: { sys: string }; rarity: string }; tailX: number; tailY: number; tipX: number; tipY: number; width: number }): void {
    const color = SYS_COLOR[k.inst.type.sys as keyof typeof SYS_COLOR];
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = k.width * 2.6;
    ctx.beginPath();
    ctx.moveTo(k.tailX, k.tailY);
    ctx.lineTo(k.tipX, k.tipY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = k.width;
    ctx.beginPath();
    ctx.moveTo(k.tailX, k.tailY);
    ctx.lineTo(k.tipX, k.tipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(k.tailX, k.tailY, k.width * 0.7, 0, TAU);
    ctx.fillStyle = RARITY_COLOR[k.inst.rarity as keyof typeof RARITY_COLOR];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(k.tipX, k.tipY, k.width * 0.75, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /** 刀光拖尾（ω_spin > 1.5 圈/s） */
  private drawTrail(ctx: CanvasRenderingContext2D, trail: Array<{ x: number; y: number }>): void {
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i++) {
      const a = i / trail.length;
      ctx.globalAlpha = a * 0.35;
      ctx.strokeStyle = 'rgba(220,230,255,0.5)';
      ctx.lineWidth = 0.05 * a;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y);
      ctx.lineTo(trail[i]!.x, trail[i]!.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 屏幕系渲染（Overlay） ----------

  /** 受击红闪（全屏 vignette） */
  private drawHitFlash(ctx: CanvasRenderingContext2D): void {
    if (this.world.playerFlashT <= 0) return;
    const a = (this.world.playerFlashT / 0.25) * 0.16;
    ctx.fillStyle = `rgba(255,60,50,${a})`;
    ctx.fillRect(0, 0, this.game.camera.viewW, this.game.camera.viewH);
  }

  /** 玩家 HP 条（顶部中央） */
  private drawHpBar(ctx: CanvasRenderingContext2D): void {
    const p = this.world.player;
    const w = 260;
    const h = 16;
    const x = this.game.camera.viewW / 2 - w / 2;
    const y = 10;
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 6);
    ctx.fill();
    const ratio = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = ratio > 0.5 ? '#5ecb6a' : ratio > 0.25 ? '#ffd94d' : '#ff6a5c';
    ctx.beginPath();
    ctx.roundRect(x, y, w * ratio, h, 4);
    ctx.fill();
    ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  private drawButtons(ctx: CanvasRenderingContext2D): void {
    const lo = TEST_LOADOUTS[this.loadoutIndex]!;
    this.drawButton(ctx, BTN.loadout, `编队 ▸ ${lo.name}`, `${lo.desc}（点击切换）`);
    this.drawButton(
      ctx,
      BTN.kind,
      `节点 ▸ 域1 ${this.kind === 'normal' ? '普通' : '精英'}`,
      this.kind === 'normal' ? '2 波（点击换精英节点）' : '普通波 + 精英波（含词条怪）',
    );
    this.drawButton(ctx, BTN.sandbox, '返回沙盒 ▸', 'M1 木桩测试场（对表）');
  }

  private drawButton(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, title: string, sub: string): void {
    const hover = this.inRect(this.game.input.cssX, this.game.input.cssY, r);
    ctx.fillStyle = hover ? 'rgba(46,54,70,0.92)' : 'rgba(30,35,46,0.88)';
    ctx.strokeStyle = hover ? '#d6b25e' : 'rgba(214,178,94,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8e4d8';
    ctx.fillText(title, r.x + 14, r.y + 17);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(200,204,216,0.65)';
    ctx.fillText(sub, r.x + 14, r.y + 35);
    ctx.textBaseline = 'top';
  }

  /** 结算面板（胜利：金币/刀/材料；失败：无奖励） */
  private drawResultPanel(ctx: CanvasRenderingContext2D): void {
    const viewW = this.game.camera.viewW;
    const viewH = this.game.camera.viewH;
    const w = 420;
    const h = 350;
    const x = viewW / 2 - w / 2;
    const y = Math.max(60, viewH / 2 - h / 2);
    const win = this.director.phase === 'done';

    // 遮罩 + 面板
    ctx.fillStyle = 'rgba(8,10,14,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = 'rgba(24,28,38,0.96)';
    ctx.strokeStyle = win ? '#d6b25e' : '#ff6a5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = win ? '#ffd94d' : '#ff6a5c';
    ctx.fillText(win ? '节点胜利' : '节点失败', x + w / 2, y + 34);
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(200,204,216,0.7)';
    ctx.fillText(`域1 ${this.kind === 'normal' ? '普通' : '精英'}节点 · 用时 ${this.battleT.toFixed(1)}s · 击杀 ${this.world.kills} · 承伤 ${Math.round(this.damageTaken)}`, x + w / 2, y + 62);

    // 掉落列表
    let ly = y + 100;
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#e8e4d8';
    ctx.fillText('节点结算', x + 28, ly);
    ly += 28;

    if (win && this.reward) {
      // 金币（wiki：金币按节点结算）
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(`金币 +${this.reward.gold}`, x + 36, ly);
      ly += 24;
      // 材料（按怪结算累积）
      const mats = Object.entries(this.world.loot);
      if (mats.length > 0) {
        ctx.fillStyle = '#b8c0d0';
        const matText = mats.map(([id, n]) => `${MATERIAL_NAMES[id as MaterialId] ?? id}×${n}`).join('　');
        ctx.fillText(`材料 ${matText}`, x + 36, ly);
        ly += 24;
      }
      // 刀（按节点结算掉率）
      if (this.reward.knife) {
        const k = this.reward.knife;
        ctx.fillStyle = RARITY_COLOR[k.rarity];
        ctx.fillText(`拾获 ${k.type.name}（${k.rarity}）　${k.type.sys}系 · ${k.type.weight}斤 · 攻${k.type.atk}`, x + 36, ly);
        ly += 24;
      } else {
        ctx.fillStyle = 'rgba(200,204,216,0.5)';
        ctx.fillText('本次未掉落刀（节点掉率结算）', x + 36, ly);
        ly += 24;
      }
    } else {
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(200,204,216,0.6)';
      ctx.fillText('失败：无节点奖励（金币/刀/材料均不结算）', x + 36, ly);
      ly += 24;
    }

    // 按钮
    const btn = this.resultPanelRects();
    this.drawButton(ctx, btn.retry, '再战一局 ▸', `域1 ${this.kind === 'normal' ? '普通' : '精英'}节点`);
    this.drawButton(ctx, btn.sandbox, '返回沙盒 ▸', 'M1 木桩测试场');

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  private resultPanelRects(): { retry: { x: number; y: number; w: number; h: number }; sandbox: { x: number; y: number; w: number; h: number } } {
    const viewW = this.game.camera.viewW;
    const viewH = this.game.camera.viewH;
    const w = 420;
    const h = 350;
    const x = viewW / 2 - w / 2;
    const y = Math.max(60, viewH / 2 - h / 2);
    const bw = 180;
    return {
      retry: { x: x + (w - bw * 2 - 16) / 2, y: y + h - 84, w: bw, h: 56 },
      sandbox: { x: x + (w - bw * 2 - 16) / 2 + bw + 16, y: y + h - 84, w: bw, h: 56 },
    };
  }

  /** 大字提示（波次开始/间隔/结算） */
  private drawAnnounce(ctx: CanvasRenderingContext2D): void {
    if (this.announceT >= ANNOUNCE_TIME || this.announce === '') return;
    const t = this.announceT / ANNOUNCE_TIME;
    const fadeIn = clamp(this.announceT / 0.18, 0, 1);
    const alpha = fadeIn * (1 - t * t);
    const viewW = this.game.camera.viewW;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 30px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#f2f4fa';
    ctx.strokeStyle = 'rgba(10,12,18,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(this.announce, viewW / 2, this.game.camera.viewH * 0.3);
    ctx.fillText(this.announce, viewW / 2, this.game.camera.viewH * 0.3);
    if (this.announceSub) {
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(214,178,94,0.9)';
      ctx.fillText(this.announceSub, viewW / 2, this.game.camera.viewH * 0.3 + 34);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  private drawHitLog(ctx: CanvasRenderingContext2D): void {
    if (this.hitLog.length === 0) return;
    const viewW = this.game.camera.viewW;
    ctx.font = '12px Consolas, "Microsoft YaHei", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    let y = 12;
    for (const line of this.hitLog) {
      ctx.fillStyle = 'rgba(226,230,240,0.75)';
      ctx.fillText(line, viewW - 14, y);
      y += 17;
    }
    ctx.textAlign = 'left';
  }

  /** 敌人名标签（精英显示词条；普通敌小字） */
  private drawEnemyLabels(ctx: CanvasRenderingContext2D): void {
    const camera = this.game.camera;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const e of this.world.enemies) {
      if (!e.alive) continue;
      const p = camera.worldToScreen(e.x, e.y - e.radius - 0.55);
      if (e.isElite) {
        ctx.fillStyle = '#ffd94d';
        const affixName = e.eliteAffix === 'swift' ? '迅捷'
          : e.eliteAffix === 'stone' ? '石肤'
          : e.eliteAffix === 'frenzy' ? '狂暴'
          : e.eliteAffix === 'split' ? '分裂'
          : e.eliteAffix === 'leech' ? '吸血'
          : e.eliteAffix === 'barrier' ? '屏障'
          : '';
        ctx.fillText(`精英·${e.type.name}【${affixName}】`, p.x, p.y);
        // 精英血条（wiki：普通敌无血条，精英/Boss 有）
        const bw = 64;
        const bh = 5;
        const bx = p.x - bw / 2;
        const by = p.y + 3;
        ctx.fillStyle = 'rgba(10,12,18,0.75)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#ffd94d';
        ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
      } else {
        ctx.fillStyle = 'rgba(226,230,240,0.5)';
        ctx.fillText(e.type.name, p.x, p.y);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }
}

/** 近战攻击范围（预警圈半径） */
function attackRangeOf(e: Enemy): number {
  switch (e.type.tpl) {
    case 'T2':
      return ENEMY_AI.T2.range;
    case 'T4':
      return ENEMY_AI.T4.range;
    case 'T7':
      return ENEMY_AI.T7.range;
    case 'T8':
      return e.attackMode === 'b' ? ENEMY_AI.T8.bRange : ENEMY_AI.T8.aRange;
    default:
      return ENEMY_AI.T1.range;
  }
}
