import { BUDGET } from '../data/constants';
import type { Camera } from '../core/Camera';

/**
 * 轻量特效池（wiki 性能预算：粒子 ≤200）：
 * - 伤害数字（上浮渐隐，屏幕系渲染）
 * - 命中火花（世界系渲染）
 */

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class FxPool {
  private texts: FloatText[] = [];
  private sparks: Spark[] = [];

  /** 伤害数字（命中事件 → 漂浮文字）；blocked = T4 格挡演出 */
  addDamageText(x: number, y: number, damage: number, kind: 'normal' | 'crit' | 'counter' | 'countered' | 'blocked'): void {
    if (kind === 'blocked') {
      this.addFloatText(x, y, '格挡', '#cfd6e4', 14);
      return;
    }
    let color = '#f0f2f8';
    let size = 15;
    let text = `${Math.round(damage)}`;
    if (kind === 'crit') {
      color = '#ffd94d';
      size = 20;
      text = `${text}!`;
    } else if (kind === 'counter') {
      color = '#ff8a5c';
    } else if (kind === 'countered') {
      color = '#7ca8ff';
    }
    this.addFloatText(x, y, text, color, size);
  }

  /** 通用漂浮文字（结算提示/格挡/材料等） */
  addFloatText(x: number, y: number, text: string, color: string, size = 14): void {
    this.texts.push({
      x,
      y: y - 0.3,
      vy: -0.9,
      life: 0.9,
      maxLife: 0.9,
      text,
      color,
      size,
    });
  }

  /** 命中火花 */
  addSpark(x: number, y: number, color: string, rng: () => number): void {
    const n = 4;
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= BUDGET.maxParticles) break;
      const a = rng() * Math.PI * 2;
      const sp = 1.5 + rng() * 2.5;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.25 + rng() * 0.15,
        maxLife: 0.4,
        color,
        size: 0.04 + rng() * 0.04,
      });
    }
  }

  /** 死亡消散：环状粒子 + 渐隐圆（wiki 受击反馈·死亡消散） */
  addDeathBurst(x: number, y: number, r: number, color: string, rng: () => number): void {
    const n = 10;
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= BUDGET.maxParticles) break;
      const a = (i / n) * Math.PI * 2 + rng() * 0.3;
      const sp = 2.2 + rng() * 1.6;
      this.sparks.push({
        x: x + Math.cos(a) * r * 0.6,
        y: y + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + rng() * 0.2,
        maxLife: 0.55,
        color,
        size: 0.06 + rng() * 0.05,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i] as FloatText;
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i] as Spark;
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy *= 0.9;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
  }

  /** 世界系渲染（火花；需在相机世界变换下调用） */
  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 屏幕系渲染（伤害数字；内部做世界→屏幕换算） */
  renderTexts(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const t of this.texts) {
      const p = camera.worldToScreen(t.x, t.y);
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${t.size}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = 'rgba(10,12,18,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, p.x, p.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }
}
