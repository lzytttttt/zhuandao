/**
 * M2 一次性节点模拟（tools/m2-sim.ts）
 * 用途：验证 wiki 03-伤害公式 §六 自检表——
 *   普通节点时长 25-45s ｜ 精英节点时长 40-70s ｜ 玩家 TTK（被围殴）≥ 8s
 * 运行：npx -y tsx tools/m2-sim.ts
 * 口径（沿用 M1 的"理想贴轨 + 实战走位"分层）：
 *   rail   理想贴轨：玩家每帧钉在锚敌 + 2.5u（刀环中心）绕圈——覆盖率上限，节点时长下限
 *   bot    实战走位：闭环风筝 bot（锚敌距离负反馈 + 0.5s 锚定节流）——参考口径
 *   ttk    站桩生存：无刀/带刀被围殴致死时间（红线 ≥ 8s）
 * 编队口径：学徒（6斤全白）打普通节点；铸师（10斤）打精英节点（进阶挑战）。
 */
import { CombatWorld } from '../src/combat/CombatWorld';
import { WaveDirector } from '../src/combat/WaveDirector';
import type { NodeKind } from '../src/combat/WaveDirector';
import { makeWeapon } from '../src/combat/WeaponInstance';
import { WEAPONS } from '../src/data/knives';
import { ARENA } from '../src/data/constants';
import { Rng } from '../src/core/Rng';
import { clamp } from '../src/core/math';
import type { Rarity } from '../src/data/types';

const STEP = 1 / 60;
const MAX_T = 240; // 超时上限（s）

const APPRENTICE: Array<[string, Rarity]> = [
  ['dao_liuye', '白'],
  ['dao_feihuang', '白'],
  ['dao_qingzhu', '白'],
  ['dao_hanbo', '白'],
  ['dao_duyan', '白'],
  ['dao_shandian', '白'],
];

const FOUNDER: Array<[string, Rarity]> = [
  ['dao_yanling', '绿'],
  ['dao_huozhe', '绿'],
  ['dao_leiming', '绿'],
  ['dao_hanbo', '白'],
  ['dao_duyan', '白'],
  ['dao_shandian', '白'],
  ['dao_liuye', '白'],
];

type MoveMode = 'rail' | 'bot' | 'stand';

interface SimResult {
  t: number;
  win: boolean;
  taken: number;
  hp: number;
  kills: number;
  waves: number;
}

/** 锚敌：优先精英（血最高），否则最近 */
function pickAnchor(world: CombatWorld) {
  let best = null as null | { x: number; y: number; maxHp: number };
  let bestHp = -1;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (e.maxHp > bestHp) {
      bestHp = e.maxHp;
      best = e;
    }
  }
  return best;
}

/**
 * 实战风筝 bot：
 * 追逃几何：距离变化率 = 6·cosα − 敌速（α = 速度方向相对径向外的偏角）。
 * 距离负反馈维持 ~2.5u（1 斤刀环带 [2.15,2.85] 中心）；锚敌 0.5s 节流防抖。
 */
function botMove(world: CombatWorld, anchorHold: { enemy: { x: number; y: number } | null; until: number }) {
  const p = world.player;
  const now = world.time;
  let anchor = anchorHold.enemy;
  if (!anchor || now >= anchorHold.until || (anchor as { x: number; y: number }).x === undefined) {
    // 重新锚定（血最高敌，跨帧持有）
    let best = null as null | { x: number; y: number; maxHp: number };
    let bestHp = -1;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (e.maxHp > bestHp) {
        bestHp = e.maxHp;
        best = e;
      }
    }
    anchor = best;
    anchorHold.enemy = best;
    anchorHold.until = now + 0.5;
  }
  if (!anchor) return { active: false, worldX: 0, worldY: 0 };
  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  const d = Math.hypot(dx, dy) || 1;
  const err = d - 2.5;
  const alpha = clamp(0.96 + err * 0.9, -1.1, 1.6);
  const ang = Math.atan2(dy, dx) + alpha;
  return {
    active: true,
    worldX: clamp(p.x + Math.cos(ang) * 5, 0.5, ARENA.w - 0.5),
    worldY: clamp(p.y + Math.sin(ang) * 5, 0.5, ARENA.h - 0.5),
  };
}

function simNode(kind: NodeKind, seed: number, moveMode: MoveMode, loadout: Array<[string, Rarity]>): SimResult {
  const rng = new Rng(seed);
  const world = new CombatWorld(rng, ARENA.w / 2, ARENA.h / 2, { ai: true });
  world.setLoadout(loadout.map(([id, r]) => makeWeapon(WEAPONS[id]!, r)));
  const director = new WaveDirector(1, kind, rng);

  let t = 0;
  let taken = 0;
  let hpBefore = world.player.hp;
  const anchorHold = { enemy: null as { x: number; y: number } | null, until: 0 };
  let orbitAng = 0;

  while (t < MAX_T) {
    let move = { active: false, worldX: 0, worldY: 0 };
    if (moveMode === 'rail') {
      // 理想贴轨：钉在锚敌 + 2.5u 绕圈（覆盖率上限口径）
      const anchor = pickAnchor(world);
      if (anchor) {
        orbitAng += 1.4 * STEP;
        const tx = anchor.x + Math.cos(orbitAng) * 2.5;
        const ty = anchor.y + Math.sin(orbitAng) * 2.5;
        world.player.x = clamp(tx, 0.5, ARENA.w - 0.5);
        world.player.y = clamp(ty, 0.5, ARENA.h - 0.5);
        world.player.vx = -Math.sin(orbitAng) * 4;
        world.player.vy = Math.cos(orbitAng) * 4;
      }
    } else if (moveMode === 'bot') {
      move = botMove(world, anchorHold);
    }
    world.update(STEP, move);
    director.update(STEP, world);
    taken += Math.max(0, hpBefore - world.player.hp);
    hpBefore = world.player.hp;
    t += STEP;
    if (director.phase === 'done' || director.phase === 'fail') break;
  }
  return {
    t,
    win: director.phase === 'done',
    taken: Math.round(taken),
    hp: Math.ceil(world.player.hp),
    kills: world.kills,
    waves: director.waveTotal,
  };
}

function simTTK(seed: number, armed: boolean): number {
  const rng = new Rng(seed);
  const world = new CombatWorld(rng, ARENA.w / 2, ARENA.h / 2, { ai: true });
  if (armed) {
    world.setLoadout(APPRENTICE.map(([id, r]) => makeWeapon(WEAPONS[id]!, r)));
  } else {
    world.setLoadout([]); // 无刀：纯生存
  }
  const director = new WaveDirector(1, 'normal', rng);
  let t = 0;
  while (t < MAX_T) {
    world.update(STEP, { active: false, worldX: 0, worldY: 0 }); // 站桩
    director.update(STEP, world);
    t += STEP;
    if (world.player.hp <= 0) return t;
    if (director.phase === 'done') return -1; // 站桩打完了都没死（围殴失败）
  }
  return -2;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function report(label: string, results: SimResult[]): void {
  const t = avg(results.map((r) => r.t));
  const taken = avg(results.map((r) => r.taken));
  const hp = avg(results.map((r) => r.hp));
  const wins = results.filter((r) => r.win).length;
  console.log(
    `${label}: 时长 ${t.toFixed(1)}s（胜 ${wins}/${results.length}）│ 承伤 ${taken.toFixed(0)} │ 终局HP ${hp.toFixed(0)} │ 击杀 ${avg(results.map((r) => r.kills)).toFixed(0)}`,
  );
}

console.log('M2 节点模拟（域1，种子×3 取均值，60Hz 全真模拟：AI/弹幕/毒圈/词条全开）');
console.log('自检表目标：普通节点 25-45s ｜ 精英节点 40-70s ｜ 玩家 TTK（围殴）≥ 8s\n');

const seeds = [2001, 2002, 2003];
report('普通节点·学徒·贴轨上限', seeds.map((s) => simNode('normal', s, 'rail', APPRENTICE)));
report('普通节点·学徒·实战bot  ', seeds.map((s) => simNode('normal', s, 'bot', APPRENTICE)));
report('精英节点·铸师·贴轨上限', seeds.map((s) => simNode('elite', s, 'rail', FOUNDER)));
report('精英节点·铸师·实战bot  ', seeds.map((s) => simNode('elite', s, 'bot', FOUNDER)));
report('精英节点·学徒·实战bot  ', seeds.map((s) => simNode('elite', s, 'bot', APPRENTICE)));

const ttk = seeds.map((s) => simTTK(s + 1000, false));
const ttkOk = ttk.every((t) => t > 0);
console.log(
  `\n无刀站桩 TTK: ${ttk.map((t) => (t < 0 ? '未死' : t.toFixed(1) + 's')).join(' / ')}${ttkOk ? `（均值 ${avg(ttk).toFixed(1)}s）` : ''}`,
);
const ttkArmed = seeds.map((s) => simTTK(s + 2000, true));
const alive = ttkArmed.filter((t) => t < 0).length;
console.log(
  `带刀站桩 TTK: ${ttkArmed.map((t) => (t < 0 ? '存活' : t.toFixed(1) + 's')).join(' / ')}${alive > 0 ? `（${alive}/${seeds.length} 存活——反击击杀快于围殴）` : ''}`,
);
