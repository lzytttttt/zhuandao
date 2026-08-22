/**
 * 种子随机数（mulberry32）。
 * 战斗掉落 / 地图生成 / 平衡模拟（balance-harness）共用同一实现，
 * 保证同种子可复现。
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) 均匀随机 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 浮点 */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** [min, max] 整数（含两端） */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** 概率判定 */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 从数组随机取一个 */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** 按权重抽取（返回命中的下标） */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }
}
