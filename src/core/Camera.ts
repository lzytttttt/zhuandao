/**
 * 正交相机：固定单屏竞技场（无卷轴，wiki 03-战斗总纲）。
 * 职责：等比缩放居中、世界↔屏幕坐标换算、DPR 适配。
 */
export class Camera {
  /** 世界单位 → 设备像素 */
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  /** 设备像素 / CSS 像素 */
  dpr = 1;
  /** 视口尺寸（CSS 像素） */
  viewW = 0;
  viewH = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    public readonly worldW: number,
    public readonly worldH: number,
  ) {}

  /** 画布尺寸变化后刷新（Game 在 resize 时调用） */
  refresh(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = this.canvas.width / Math.max(1, rect.width);
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.scale = Math.min(
      this.canvas.width / this.worldW,
      this.canvas.height / this.worldH,
    );
    this.offsetX = (this.canvas.width - this.worldW * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.worldH * this.scale) / 2;
  }

  /** 设备像素 → 世界坐标 */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  /** 世界坐标 → 设备像素 */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: this.offsetX + wx * this.scale,
      y: this.offsetY + wy * this.scale,
    };
  }

  /** 应用世界坐标系变换（场景渲染用） */
  applyWorld(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  /** 应用 CSS 像素坐标系变换（HUD 用） */
  applyScreen(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
