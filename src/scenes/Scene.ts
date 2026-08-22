/** 场景接口（沙盒/战斗/节点地图/铁匠铺共用） */
export interface Scene {
  /** 进入场景（初始化实体/重置状态） */
  enter(): void;
  /** 离开场景（清理） */
  exit(): void;
  /** 固定步长更新（dt = 1/60s） */
  update(dt: number): void;
  /** 世界坐标系下渲染（相机世界变换已就位） */
  render(ctx: CanvasRenderingContext2D): void;
  /** CSS 像素坐标系下的覆盖层渲染（按钮/文字类 UI，Game 在 HUD 前调用） */
  renderOverlay(ctx: CanvasRenderingContext2D): void;
  /** HUD 文本行（CSS 像素坐标系，由 Game 绘制） */
  hudLines(): string[];
}
