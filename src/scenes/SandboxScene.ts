import type { Game } from '../core/Game';
import type { Scene } from './Scene';
import { CombatWorld } from '../combat/CombatWorld';
import { makeWeapon } from '../combat/WeaponInstance';
import type { WeaponInstance } from '../combat/WeaponInstance';
import { breakdownText } from '../combat/Damage';
import type { Enemy } from '../combat/Enemy';
import type { Knife } from '../combat/Knife';
import { WEAPONS } from '../data/knives';
import { ENEMIES } from '../data/enemies';
import { ARENA, PLAYER, SYS_COLOR } from '../data/constants';
import { TEST_LOADOUTS, RARITY_COLOR } from '../combat/testLoadouts';
import { BattleScene } from './BattleScene';
import { FxPool } from '../render/Fx';
import { TAU } from '../core/math';

/** 木桩重生延时（s） */
const DUMMY_RESPAWN = 2;

/** 左下按钮组（CSS 像素；≥48×48 触屏合规） */
const BTN = { loadout: { x: 12, y: 104, w: 232, h: 48 }, battle: { x: 12, y: 160, w: 232, h: 48 } };

const LOADOUTS = TEST_LOADOUTS;

/**
 * M1 木桩测试场：
 * - 验证转刀碰撞（刀身/刀尖）、伤害公式全链、命中冷却
 * - 三套编队切换，DPS 滚动窗口对 wiki 自检表（学徒 18-25 / 铸师 30-45 / 名匠 55-80）
 * - 命中日志打印单次乘区分解
 */
export class SandboxScene implements Scene {
  private world: CombatWorld;
  private fx = new FxPool();
  /** 木桩（死亡后计时重生；正式敌人 M2 起死亡即移除） */
  private dummies: Enemy[] = [];
  private dummyTimers: number[] = [];
  private loadoutIndex = 0;
  /** 刀尖拖尾（与 world.knives 索引对齐） */
  private trails: Array<Array<{ x: number; y: number }>> = [];
  /** 最近命中日志（最新在下） */
  private hitLog: string[] = [];

  constructor(private readonly game: Game) {
    // M1 木桩测试场：关闭敌人 AI（静态桩，对表口径与 M1 一致）
    this.world = new CombatWorld(this.game.rng, ARENA.w / 2, 12, { ai: false });
  }

  enter(): void {
    this.world.enemies.length = 0;
    this.dummies = [];
    this.dummyTimers = [];
    this.hitLog = [];

    // 木桩配置（域1 实敌 + 高甲 + dev 极端桩；全部静置）
    const posts: Array<{ key: string; x: number; y: number; ov?: { hp?: number; armor?: number } }> = [
      { key: 'ey_yekedao', x: 4, y: 3.5 },
      { key: 'ey_yekedao', x: 11, y: 3 },
      { key: 'ey_yekedao', x: 18, y: 3.5 },
      { key: 'ey_loulou', x: 7, y: 10.5 },
      { key: 'ey_loulou', x: 15, y: 10.5 },
      { key: 'ey_zhongjia', x: 11, y: 7 },
      // dev 专用极端桩（armor 250 → DR 71%，验证弹开演出与高甲削伤；不入 wiki 清单）
      { key: 'ey_zhongjia', x: 17.5, y: 10, ov: { hp: 9999, armor: 250 } },
    ];
    for (const p of posts) {
      this.world.spawnEnemy(ENEMIES[p.key]!, p.x, p.y, p.ov);
      this.dummies.push(this.world.enemies[this.world.enemies.length - 1]!);
      this.dummyTimers.push(0);
    }

    this.applyLoadout(0);
  }

  exit(): void {}

  update(dt: number): void {
    this.handleClicks();

    // UI 命中区域抑制走位（按住按钮不移动玩家）
    const input = this.game.input;
    const overUI = this.isOverAnyButton(input.cssX, input.cssY);
    this.world.update(dt, {
      active: input.leftDown && input.inside && !overUI,
      worldX: input.worldX,
      worldY: input.worldY,
    });

    // 木桩重生
    for (let i = 0; i < this.dummies.length; i++) {
      const d = this.dummies[i]!;
      if (!d.alive) {
        this.dummyTimers[i] = (this.dummyTimers[i] ?? 0) + dt;
        if (this.dummyTimers[i]! >= DUMMY_RESPAWN) {
          d.revive();
          this.dummyTimers[i] = 0;
        }
      }
    }

    // 消费命中事件 → 特效与日志
    for (const hit of this.world.hits) {
      const bd = hit.breakdown;
      const kind = bd.crit ? 'crit' : bd.counterLabel === '克' ? 'counter' : bd.counterLabel === '被克' ? 'countered' : 'normal';
      this.fx.addDamageText(hit.x, hit.y, bd.damage, kind);
      this.fx.addSpark(hit.x, hit.y, SYS_COLOR[hit.knife.inst.type.sys], () => this.game.rng.next());
      if (hit.killed) {
        this.fx.addSpark(hit.x, hit.y, '#ffd94d', () => this.game.rng.next());
      }
      this.hitLog.push(
        `${hit.knife.inst.type.name} ${bd.part === 'tip' ? '尖' : '身'} ${Math.round(bd.damage)} │ ${breakdownText(bd)}`,
      );
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
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawArena(ctx);
    this.drawOrbitGuides(ctx);
    for (const e of this.world.enemies) this.drawEnemy(ctx, e);
    for (let i = 0; i < this.world.knives.length; i++) {
      this.drawTrail(ctx, this.trails[i] ?? []);
      this.drawKnife(ctx, this.world.knives[i]!);
    }
    this.drawPlayer(ctx);
    this.drawPointerHint(ctx);
    this.fx.renderWorld(ctx);
  }

  renderOverlay(ctx: CanvasRenderingContext2D): void {
    this.drawButton(ctx);
    this.drawHitLog(ctx);
    this.drawEnemyLabels(ctx);
  }

  hudLines(): string[] {
    const lo = LOADOUTS[this.loadoutIndex]!;
    return [
      `M1 木桩测试场 · 编队：${lo.name}（${lo.desc}）`,
      `DPS(10s) ${this.world.dps.toFixed(1)} │ 总伤 ${Math.round(this.world.totalDamage)} │ 击杀 ${this.world.kills}`,
      '按住左键走位 · 桩死后 2s 重生 · 点左下按钮换编队',
    ];
  }

  // ---------- 装配 ----------

  private applyLoadout(index: number): void {
    this.loadoutIndex = index;
    const lo = LOADOUTS[index]!;
    const instances: WeaponInstance[] = lo.items.map(([id, rarity]) =>
      makeWeapon(WEAPONS[id]!, rarity),
    );
    this.world.setLoadout(instances);
    this.trails = instances.map(() => []);
    this.hitLog = [];
  }

  private handleClicks(): void {
    for (const click of this.game.input.drainClicks()) {
      if (this.isOverAnyButton(click.cssX, click.cssY)) {
        if (this.inRect(click.cssX, click.cssY, BTN.loadout)) {
          this.applyLoadout((this.loadoutIndex + 1) % LOADOUTS.length);
        } else if (this.inRect(click.cssX, click.cssY, BTN.battle)) {
          this.game.switchScene(new BattleScene(this.game));
        }
      }
    }
  }

  private isOverAnyButton(cssX: number, cssY: number): boolean {
    return this.inRect(cssX, cssY, BTN.loadout) || this.inRect(cssX, cssY, BTN.battle);
  }

  private inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
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

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.world.player;
    // 脚底锚点光圈（操作方案：俯视刀阵晃眼时的本体标识）
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.62, 0, TAU);
    ctx.strokeStyle = 'rgba(240,244,255,0.35)';
    ctx.lineWidth = 0.05;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, TAU);
    ctx.fillStyle = '#f2f4fa';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,33,0.6)';
    ctx.lineWidth = 0.04;
    ctx.stroke();
  }

  private drawKnife(ctx: CanvasRenderingContext2D, k: Knife): void {
    const color = SYS_COLOR[k.inst.type.sys];
    ctx.lineCap = 'round';
    // 拖影层
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = k.width * 2.6;
    ctx.beginPath();
    ctx.moveTo(k.tailX, k.tailY);
    ctx.lineTo(k.tipX, k.tipY);
    ctx.stroke();
    // 刀身
    ctx.globalAlpha = 1;
    ctx.lineWidth = k.width;
    ctx.beginPath();
    ctx.moveTo(k.tailX, k.tailY);
    ctx.lineTo(k.tipX, k.tipY);
    ctx.stroke();
    // 刀柄稀有度标记（小圆点）
    ctx.beginPath();
    ctx.arc(k.tailX, k.tailY, k.width * 0.7, 0, TAU);
    ctx.fillStyle = RARITY_COLOR[k.inst.rarity];
    ctx.fill();
    // 刀尖亮点
    ctx.beginPath();
    ctx.arc(k.tipX, k.tipY, k.width * 0.75, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /** 刀光拖尾（ω_spin > 1.5 圈/s 的刀，wiki 物理表现层） */
  private drawTrail(ctx: CanvasRenderingContext2D, trail: Array<{ x: number; y: number }>): void {
    if (trail.length < 2) return;
    const color = 'rgba(220,230,255,0.5)';
    for (let i = 1; i < trail.length; i++) {
      const a = i / trail.length;
      ctx.globalAlpha = a * 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.05 * a;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y);
      ctx.lineTo(trail[i]!.x, trail[i]!.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** 木桩（M1 静态：测试场显示血条便于数值观察；正式战斗普通敌无血条） */
  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    if (e.alive) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, TAU);
      ctx.fillStyle = '#232936';
      ctx.fill();
      ctx.strokeStyle = SYS_COLOR[e.type.sys];
      ctx.lineWidth = 0.07;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.35, 0, TAU);
      ctx.fillStyle = SYS_COLOR[e.type.sys];
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;

      // 血条
      const bw = 0.9;
      const bh = 0.1;
      const bx = e.x - bw / 2;
      const by = e.y - e.radius - 0.35;
      ctx.fillStyle = 'rgba(10,12,18,0.7)';
      ctx.fillRect(bx, by, bw, bh);
      const ratio = e.hp / e.maxHp;
      ctx.fillStyle = ratio > 0.5 ? '#5ecb6a' : ratio > 0.25 ? '#ffd94d' : '#ff6a5c';
      ctx.fillRect(bx, by, bw * ratio, bh);
    } else {
      // 重生倒计时灰圈
      const i = this.dummies.indexOf(e);
      const t = i >= 0 ? (this.dummyTimers[i] ?? 0) / DUMMY_RESPAWN : 0;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.8, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, t));
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.06;
      ctx.stroke();
    }
  }

  private drawPointerHint(ctx: CanvasRenderingContext2D): void {
    const input = this.game.input;
    if (!input.inside) return;
    const p = this.world.player;
    const dx = input.worldX - p.x;
    const dy = input.worldY - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= 6) return;
    const ax = dx / d;
    const ay = dy / d;

    ctx.save();
    ctx.translate(p.x + ax * 1.1, p.y + ay * 1.1);
    ctx.rotate(Math.atan2(ay, ax));
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(0.35, 0);
    ctx.lineTo(-0.15, 0.2);
    ctx.lineTo(-0.15, -0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- 屏幕系渲染（Overlay） ----------

  private drawButton(ctx: CanvasRenderingContext2D): void {
    const lo = LOADOUTS[this.loadoutIndex]!;
    this.drawBtn(ctx, BTN.loadout, `编队 ▸ ${lo.name}`, `${lo.desc}（点击切换）`);
    this.drawBtn(ctx, BTN.battle, '进入战斗 ▸', 'M2 战斗节点（域1 波次）');
  }

  private drawBtn(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, title: string, sub: string): void {
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
    ctx.fillText(title, r.x + 14, r.y + 18);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(200,204,216,0.65)';
    ctx.fillText(sub, r.x + 14, r.y + 36);
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

  /** 敌人名与血量文本（屏幕系小字） */
  private drawEnemyLabels(ctx: CanvasRenderingContext2D): void {
    const camera = this.game.camera;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const e of this.world.enemies) {
      if (!e.alive) continue;
      const p = camera.worldToScreen(e.x, e.y - e.radius - 0.55);
      ctx.fillStyle = 'rgba(226,230,240,0.55)';
      let label = e.type.name;
      if (e.armor >= 200) label += '（dev桩）';
      else if (e.armor !== e.type.armor) label += `（甲${e.armor}）`;
      ctx.fillText(label, p.x, p.y);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }
}
