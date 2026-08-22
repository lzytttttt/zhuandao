import { ELITE_AFFIXES, ENEMIES, WAVES } from '../data/enemies';
import { ARENA, WAVE } from '../data/constants';
import type { Rng } from '../core/Rng';
import { TAU } from '../core/math';
import type { CombatWorld } from './CombatWorld';
import type { Enemy } from './Enemy';

/**
 * 波次导演（wiki 07-全敌人清单 §四 波次组合表）：
 * 节点流程 = 入场演出 → 波次（全灭）→ 波间间隔 → … → 结算。
 * 普通节点：normal 池随机取 WAVE.normalWaves 个方案；
 * 精英节点：1 波普通 + 1 波精英（波次中数量最少种类精英化，词条随机）。
 */

export type NodeKind = 'normal' | 'elite';
export type NodePhase = 'enter' | 'wave' | 'gap' | 'done' | 'fail';

export interface WaveEntry {
  enemyId: string;
  count: number;
  /** 精英化数量（该种类内前 eliteCount 只） */
  eliteCount: number;
}

export class WaveDirector {
  phase: NodePhase = 'enter';
  phaseT = 0;
  /** 当前波索引（-1 = 入场未开始） */
  waveIndex = -1;
  readonly waves: WaveEntry[][];

  constructor(
    readonly domain: number,
    readonly kind: NodeKind,
    private readonly rng: Rng,
  ) {
    this.waves = planWaves(domain, kind, rng);
  }

  get waveTotal(): number {
    return this.waves.length;
  }

  /** 玩家死亡（场景检测后调用） */
  forceFail(): void {
    if (this.phase !== 'done' && this.phase !== 'fail') {
      this.phase = 'fail';
      this.phaseT = 0;
    }
  }

  update(dt: number, world: CombatWorld): void {
    this.phaseT += dt;
    switch (this.phase) {
      case 'enter':
        if (this.phaseT >= WAVE.enterDelay) this.startNextWave(world);
        break;
      case 'wave':
        if (world.enemies.length === 0) {
          if (this.waveIndex + 1 >= this.waves.length) {
            this.phase = 'done';
            this.phaseT = 0;
          } else {
            this.phase = 'gap';
            this.phaseT = 0;
          }
        }
        break;
      case 'gap':
        if (this.phaseT >= WAVE.gap) this.startNextWave(world);
        break;
      case 'done':
      case 'fail':
        break;
    }
  }

  private startNextWave(world: CombatWorld): void {
    this.waveIndex++;
    this.phase = 'wave';
    this.phaseT = 0;
    const wave = this.waves[this.waveIndex];
    if (wave) spawnWave(wave, world, this.rng);
  }
}

// ---------------- 波次规划 ----------------

function planWaves(domain: number, kind: NodeKind, rng: Rng): WaveEntry[][] {
  const pool = WAVES[domain];
  if (!pool || pool.normal.length === 0) return [];
  const plans: WaveEntry[][] = [];

  if (kind === 'normal') {
    // 不放回抽取
    const idxs = shuffleRange(pool.normal.length, rng).slice(0, WAVE.normalWaves);
    for (const i of idxs) plans.push(toEntries(pool.normal[i]!, false));
  } else {
    const nIdx = rng.int(0, pool.normal.length - 1);
    plans.push(toEntries(pool.normal[nIdx]!, false));
    if (pool.elite.length > 0) {
      const eIdx = rng.int(0, pool.elite.length - 1);
      plans.push(toEntries(pool.elite[eIdx]!, true));
    }
  }
  return plans;
}

/** 波次方案 → 生成条目（精英波：数量最少种类精英化，上限 eliteMaxCount） */
function toEntries(wave: ReadonlyArray<[string, number]>, eliteWave: boolean): WaveEntry[] {
  const entries: WaveEntry[] = wave.map(([enemyId, count]) => ({ enemyId, count, eliteCount: 0 }));
  if (eliteWave && entries.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i]!.count < entries[minIdx]!.count) minIdx = i;
    }
    const target = entries[minIdx]!;
    target.eliteCount = Math.min(target.count, WAVE.eliteMaxCount);
  }
  return entries;
}

function shuffleRange(n: number, rng: Rng): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ---------------- 刷怪 ----------------

/** 黄金角：任意数量敌人均匀分布到 2π（松散包围槽位） */
const GOLDEN_ANGLE = 2.399963;

function spawnWave(entries: WaveEntry[], world: CombatWorld, rng: Rng): void {
  const total = entries.reduce((s, e) => s + e.count, 0);
  let spawned = 0;
  for (const entry of entries) {
    for (let i = 0; i < entry.count; i++) {
      const pos = edgePos(spawned / Math.max(1, total), rng);
      const enemy = world.spawnEnemy(ENEMIES[entry.enemyId]!, pos.x, pos.y);
      if (i < entry.eliteCount) {
        enemy.applyElite(rng.pick(ELITE_AFFIXES).id);
      }
      initEnemy(enemy, world);
      spawned++;
    }
  }
}

/** 初始 AI 状态：入场淡入 + 槽位角 */
function initEnemy(e: Enemy, world: CombatWorld): void {
  e.fadeT = WAVE.spawnFade;
  e.phase = 'enter';
  e.phaseT = 0;
  const tpl = e.type.tpl;
  if (tpl === 'T5' || tpl === 'T6' || tpl === 'T10') {
    // 远程模板：slotAngle = 环绕角（初始为相对玩家角）
    e.slotAngle = Math.atan2(e.y - world.player.y, e.x - world.player.x);
  } else {
    // 近战模板：黄金角均匀槽位
    e.slotAngle = (e.uid * GOLDEN_ANGLE) % TAU;
  }
  e.strafeDir = world.rng.chance(0.5) ? 1 : -1;
}

/** 沿竞技场边缘的出生点（t ∈ [0,1) 沿周长巡走 + 抖动） */
function edgePos(t: number, rng: Rng): { x: number; y: number } {
  const w = ARENA.w;
  const h = ARENA.h;
  const pad = WAVE.spawnPad;
  const per = 2 * (w + h);
  let d = ((((t + rng.range(-0.04, 0.04)) % 1) + 1) % 1) * per;
  if (d < w) return { x: pad + d, y: pad };
  d -= w;
  if (d < h) return { x: w - pad, y: pad + d };
  d -= h;
  if (d < w) return { x: w - pad - d, y: h - pad };
  d -= w;
  return { x: pad, y: h - pad - d };
}
