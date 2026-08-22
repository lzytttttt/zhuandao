import { Camera } from './Camera';
import { Input } from './Input';
import { Rng } from './Rng';
import { ARENA } from '../data/constants';
import type { Scene } from '../scenes/Scene';
import { BattleScene } from '../scenes/BattleScene';

/** 固定时间步长（秒）——目标 60fps（wiki 03-战斗总纲·性能预算） */
export const FIXED_DT = 1 / 60;

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input = new Input();
  readonly rng = new Rng(20260821);
  readonly camera: Camera;

  private scene: Scene;
  private lastTime = 0;
  private accumulator = 0;
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 上下文不可用');
    this.ctx = ctx;

    this.camera = new Camera(canvas, ARENA.w, ARENA.h);
    this.input.attach(canvas, this.camera);
    this.scene = new BattleScene(this);
    this.scene.enter();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  /** 切换场景（M1+ 使用；当前仅沙盒） */
  switchScene(next: Scene): void {
    this.scene.exit();
    this.scene = next;
    next.enter();
  }

  private tick = (now: number): void => {
    const frameTime = Math.min(0.25, (now - this.lastTime) / 1000); // 兜底防螺旋
    this.lastTime = now;
    if (frameTime > 0) this.fps += (1 / frameTime - this.fps) * 0.08;

    this.accumulator += frameTime;
    while (this.accumulator >= FIXED_DT) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.render();
    requestAnimationFrame(this.tick);
  };

  private step(dt: number): void {
    this.input.frameUpdate();
    this.scene.update(dt);
    this.input.drainClicks(); // 清掉未被场景消费的点击，防累积
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.camera.applyWorld(ctx);
    this.scene.render(ctx);

    this.camera.applyScreen(ctx);
    this.scene.renderOverlay(ctx);
    this.renderHud();
  }

  private renderHud(): void {
    const ctx = this.ctx;
    ctx.font = '13px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = [`FPS ${this.fps.toFixed(0)}`, ...this.scene.hudLines()];
    let y = 10;
    for (const line of lines) {
      ctx.fillStyle = 'rgba(226, 230, 240, 0.82)';
      ctx.fillText(line, 12, y);
      y += 19;
    }
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.camera.refresh();
  }
}
