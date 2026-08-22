/**
 * M1 一次性 DPS 模拟（tools/m1-sim.ts）
 * 用途：验证 wiki 03-伤害公式 §六 自检表——
 *   学徒（6斤全1斤刀）DPS ~18-25、铸师（10斤）~30-45、名匠（15斤混搭）~55-80
 *   学徒 vs 域1小兵（30-50 血）2-3s/只
 * 运行：npx -y tsx tools/m1-sim.ts
 * 几何要点：刀覆盖是以玩家为心的环带 [R−L/2, R+L/2]（1斤刀 ≈ [2.15, 2.85]），
 *   敌人必须处于环带内才可被命中——"走位=让敌人保持在刀环上"是本作伤害几何本质。
 * 模式：
 *   static  玩家站桩、单桩恰在主刀轨道上（理想贴轨 = 覆盖率上限）
 *   orbit   玩家以主刀半径绕桩跑动（走位增伤 vBonus 生效，覆盖率下降）
 *   swarm   多桩环形分布（体现大半径刀 AOE 覆盖价值，对名匠公平）
 */
import { CombatWorld } from '../src/combat/CombatWorld';
import { makeWeapon } from '../src/combat/WeaponInstance';
import type { WeaponInstance } from '../src/combat/WeaponInstance';
import { WEAPONS } from '../src/data/knives';
import { ENEMIES } from '../src/data/enemies';
import { Rng } from '../src/core/Rng';
import type { Rarity } from '../src/data/types';

const DURATION = 60; // 模拟秒数
const STEP = 1 / 60;

type Mode = 'static' | 'orbit' | 'swarm';

interface SimResult {
  dps: number;
  kills: number;
  avgKillTime: number;
}

function simulate(
  items: Array<[string, Rarity]>,
  mode: Mode,
  seed: number,
): SimResult {
  const rng = new Rng(seed);
  const world = new CombatWorld(rng, 11, 7, { ai: false }); // M1 口径：静态桩
  const instances: WeaponInstance[] = items.map(([id, rarity]) => makeWeapon(WEAPONS[id]!, rarity));
  world.setLoadout(instances);

  // 主刀半径（编队中最常见的轨道半径，走位参考）
  const mainR = 2.5;
  const cx = 11;
  const cy = 7;

  const dummyType = ENEMIES['ey_yekedao']!;
  const dummies = [] as ReturnType<typeof world.spawnEnemy>[];

  if (mode === 'swarm') {
    // 多桩环形分布：不同半径环 × 角度，覆盖 1-4 斤刀的轨道带
    const rings = [2.2, 2.8, 3.4, 4.0];
    rings.forEach((r, i) => {
      for (let j = 0; j < 2; j++) {
        const a = (i * 2 + j) * 0.8;
        dummies.push(world.spawnEnemy(dummyType, cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
    });
  } else {
    dummies.push(world.spawnEnemy(dummyType, cx, cy));
  }

  const killTimes: number[] = [];
  let lastKill = 0;
  let angle = 0;

  for (let t = 0; t < DURATION; t += STEP) {
    if (mode === 'static') {
      // 站桩：玩家与桩距离 = 主刀半径（桩恰在轨道上，覆盖率上限）
      world.player.x = cx;
      world.player.y = cy + mainR;
      world.update(STEP, { active: false, worldX: 0, worldY: 0 });
    } else {
      // 走位：以主刀半径绕桩心跑动（active=true → 玩家速度真实生效）
      angle += (6 / mainR) * STEP;
      const tx = cx + Math.cos(angle) * mainR;
      const ty = cy + Math.sin(angle) * mainR;
      world.update(STEP, { active: true, worldX: tx, worldY: ty });
    }

    for (const d of dummies) {
      if (!d.alive) {
        killTimes.push(world.time - lastKill);
        lastKill = world.time;
        d.revive();
      }
    }
  }

  const kills = killTimes.length;
  const avgKillTime = kills > 0 ? killTimes.reduce((a, b) => a + b, 0) / kills : 0;
  return { dps: world.totalDamage / DURATION, kills, avgKillTime };
}

const LOADOUTS: Record<string, Array<[string, Rarity]>> = {
  学徒6斤: [
    ['dao_liuye', '白'],
    ['dao_feihuang', '白'],
    ['dao_qingzhu', '白'],
    ['dao_hanbo', '白'],
    ['dao_duyan', '白'],
    ['dao_shandian', '白'],
  ],
  铸师10斤: [
    ['dao_yanling', '绿'],
    ['dao_huozhe', '绿'],
    ['dao_leiming', '绿'],
    ['dao_hanbo', '白'],
    ['dao_duyan', '白'],
    ['dao_shandian', '白'],
    ['dao_liuye', '白'],
  ],
  名匠15斤: [
    ['dao_duangu', '蓝'],
    ['dao_wugong', '蓝'],
    ['dao_hanyue', '绿'],
    ['dao_liushui', '绿'],
    ['dao_huadu', '绿'],
    ['dao_hanbo', '白'],
    ['dao_duyan', '白'],
    ['dao_shandian', '白'],
  ],
};

console.log(`M1 DPS 模拟（${DURATION}s，域1 野刀客桩 40血/5甲，种子×3 取均值）`);
console.log('自检表目标：学徒 18-25 │ 铸师 30-45 │ 名匠 55-80 │ 学徒杀小兵 2-3s/只');
console.log('模式：static=理想贴轨（上限）│ orbit=绕桩走位 │ swarm=8桩环形（AOE 场景）\n');

for (const [name, items] of Object.entries(LOADOUTS)) {
  const modes: Mode[] = name === '名匠15斤' ? ['static', 'orbit', 'swarm'] : ['static', 'orbit'];
  for (const mode of modes) {
    const results = [1, 2, 3].map((s) => simulate(items, mode, s * 1000));
    const dps = results.reduce((a, r) => a + r.dps, 0) / results.length;
    const kills = results.reduce((a, r) => a + r.kills, 0) / results.length;
    const avgKill = results.reduce((a, r) => a + r.avgKillTime, 0) / results.length;
    const killInfo = mode === 'swarm' ? `击杀 ${kills.toFixed(0)} 只` : `平均 ${avgKill.toFixed(2)}s/只`;
    console.log(`${name} ${mode}: DPS ${dps.toFixed(1)} │ ${killInfo}`);
  }
}
