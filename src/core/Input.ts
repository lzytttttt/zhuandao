import type { Camera } from './Camera';

/** 左键点击事件（世界坐标 + CSS 像素屏幕坐标，供 UI 命中检测） */
export interface ClickEvent {
  worldX: number;
  worldY: number;
  cssX: number;
  cssY: number;
}

/**
 * 输入层（设计红线：全游戏仅鼠标左键 / 触摸屏单指）。
 * 只暴露：左键按住状态、指针世界坐标、左键点击队列。
 * 右键/中键/滚轮/键盘一律不采集；contextmenu 被吞掉。
 */
export class Input {
  /** 左键是否按住（战斗内 = 移动指令） */
  leftDown = false;
  /** 指针是否在画布内 */
  inside = false;
  /** 指针世界坐标（每帧刷新） */
  worldX = 0;
  worldY = 0;
  /** 指针屏幕坐标（CSS 像素，每帧刷新；供 UI 命中检测） */
  cssX = 0;
  cssY = 0;

  private devX = 0;
  private devY = 0;
  private clicks: ClickEvent[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private camera: Camera | null = null;

  attach(canvas: HTMLCanvasElement, camera: Camera): void {
    this.detach();
    this.canvas = canvas;
    this.camera = camera;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas = null;
    this.camera = null;
  }

  /** 每固定步由 Game 调用：刷新指针世界坐标与 CSS 屏幕坐标 */
  frameUpdate(): void {
    this.syncWorld();
  }

  /** 取走当前累计的左键点击（场景消费；未消费的由 Game 清空） */
  drainClicks(): ClickEvent[] {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  /** PointerEvent 坐标 → 画布设备像素（兼容 DPR 与 CSS 缩放） */
  private toScreen(e: PointerEvent): { x: number; y: number } {
    const canvas = this.canvas;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / Math.max(1, rect.width),
      y: ((e.clientY - rect.top) * canvas.height) / Math.max(1, rect.height),
    };
  }

  private syncWorld(): void {
    if (!this.camera) return;
    const w = this.camera.screenToWorld(this.devX, this.devY);
    this.worldX = w.x;
    this.worldY = w.y;
    this.cssX = this.devX / Math.max(0.0001, this.camera.dpr);
    this.cssY = this.devY / Math.max(0.0001, this.camera.dpr);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // 红线：仅左键 / 单指
    const p = this.toScreen(e);
    this.devX = p.x;
    this.devY = p.y;
    this.leftDown = true;
    this.inside = true;
    this.syncWorld();
    this.clicks.push({
      worldX: this.worldX,
      worldY: this.worldY,
      cssX: this.cssX,
      cssY: this.cssY,
    });
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.toScreen(e);
    this.devX = p.x;
    this.devY = p.y;
    this.inside = true;
    this.syncWorld();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.leftDown = false;
  };

  private onPointerLeave = (): void => {
    this.inside = false;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault(); // 红线：右键零响应
  };

  private onBlur = (): void => {
    this.leftDown = false;
    this.inside = false;
  };
}
