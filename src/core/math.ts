export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 角度差归一到 (−π, π]（格挡扇形判定用） */
export function normAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= TAU;
  while (x <= -Math.PI) x += TAU;
  return x;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 点到线段的最近点（刀身线段-圆碰撞用，wiki 03-转刀机制 §二） */
export function closestPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay };
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return { x: ax + t * dx, y: ay + t * dy };
}
