/**
 * 地面危险区（wiki 03-敌人AI §二 T6 毒雾师：在玩家路径上放毒圈，DoT 区域）。
 * 玩家站在圈内按 tick 周期受持续伤害（不吃受击无敌帧——与打击类伤害区分）。
 */
export interface Hazard {
  x: number;
  y: number;
  radius: number;
  /** 每秒伤害（= 敌 atk × hazardDpsMult） */
  dps: number;
  duration: number;
  /** 已存在时间 */
  t: number;
  /** DoT tick 计时 */
  tickAcc: number;
  alive: boolean;
}

export function createHazard(x: number, y: number, radius: number, dps: number, duration: number): Hazard {
  return { x, y, radius, dps, duration, t: 0, tickAcc: 0, alive: true };
}

export const HAZARD_TICK = 0.5;

/** 推进危险区；玩家在圈内时每 tick 结算一次 dps×tick 伤害（返回本帧伤害，0=未 tick） */
export function updateHazard(h: Hazard, dt: number, px: number, py: number, pr: number): number {
  h.t += dt;
  if (h.t >= h.duration) {
    h.alive = false;
    return 0;
  }
  const dx = px - h.x;
  const dy = py - h.y;
  if (dx * dx + dy * dy < (h.radius + pr) ** 2) {
    h.tickAcc += dt;
    if (h.tickAcc >= HAZARD_TICK) {
      h.tickAcc -= HAZARD_TICK;
      return h.dps * HAZARD_TICK;
    }
  } else {
    h.tickAcc = 0; // 离圈重置（边缘反复进出不清 tick，简单处理）
  }
  return 0;
}
