import { AFFIXES } from './affixes';
import { ENEMIES, ENEMY_LIST, WAVES } from './enemies';
import { BOSS_LIST, MOVES } from './bosses';
import { EVENT_LIST } from './events';
import { KNIFE_LIST, TRAITS } from './knives';
import { ENEMY_AI, ENEMY_SPEED_CAP, ELITE } from './constants';

/**
 * 数据一致性校验：各清单「一致性检查记录」的代码化。
 * 启动时运行；任何 error 都意味着 src/data 与 wiki 出现漂移。
 */
export function validateData(): string[] {
  const errors: string[] = [];

  // —— 刀 ——
  const knifeIds = new Set<string>();
  for (const k of KNIFE_LIST) {
    if (knifeIds.has(k.id)) errors.push(`刀 ID 重复：${k.id}（${k.name}）`);
    knifeIds.add(k.id);
    if (k.weight < 1 || k.weight > 5) errors.push(`${k.name} 重量越界（1-5）：${k.weight}`);
    if (k.spin <= 0 || k.orbit <= 0 || k.radius <= 0) errors.push(`${k.name} 运动参数非法`);
    if (k.trait !== null && !(k.trait in TRAITS)) errors.push(`${k.name} 引用不存在的特性：${k.trait}`);
    for (const affixId of k.affixPool) {
      if (!(affixId in AFFIXES)) errors.push(`${k.name} 词缀池引用不存在的词缀：${affixId}`);
    }
  }

  // —— 敌人 ——
  const enemyIds = new Set<string>();
  for (const e of ENEMY_LIST) {
    if (enemyIds.has(e.id)) errors.push(`敌人 ID 重复：${e.id}（${e.name}）`);
    enemyIds.add(e.id);
    if (e.speed >= ENEMY_SPEED_CAP) {
      errors.push(`${e.name} 移速越红线（须 < ${ENEMY_SPEED_CAP}）：${e.speed}`);
    }
  }

  // —— 行为红线（wiki 03-敌人AI §一：所有攻击前摇 ≥0.5s）——
  const windups: Array<[string, number]> = [
    ['T1', ENEMY_AI.T1.windup],
    ['T2', ENEMY_AI.T2.windup],
    ['T3', ENEMY_AI.T3.windup],
    ['T4', ENEMY_AI.T4.windup],
    ['T5', ENEMY_AI.T5.windup],
    ['T6', ENEMY_AI.T6.windup],
    ['T7', ENEMY_AI.T7.windup],
    ['T8-平A', ENEMY_AI.T8.aWindup],
    ['T8-三连斩', ENEMY_AI.T8.bWindup],
    ['T9-引信', ENEMY_AI.T9.fuse],
    ['T10', ENEMY_AI.T10.windup],
  ];
  for (const [label, w] of windups) {
    if (w < ENEMY_AI.minWindup) errors.push(`${label} 前摇越红线（须 ≥${ENEMY_AI.minWindup}s）：${w}`);
  }

  // —— 精英词条数值红线（wiki §三：血×3/攻×1.5/体型×1.2）——
  if (ELITE.hpMult !== 3 || ELITE.atkMult !== 1.5 || ELITE.sizeMult !== 1.2) {
    errors.push('精英基础倍率漂移（wiki：血×3 / 攻×1.5 / 体型×1.2）');
  }

  // —— 波次引用 ——
  for (const [domain, pools] of Object.entries(WAVES)) {
    for (const wave of [...pools.normal, ...pools.elite]) {
      for (const [enemyId, count] of wave) {
        if (!ENEMIES[enemyId]) errors.push(`域 ${domain} 波次引用不存在的敌人：${enemyId}`);
        if (count <= 0) errors.push(`域 ${domain} 波次数量非法：${enemyId}×${count}`);
      }
    }
  }

  // —— Boss ——
  const bossIds = new Set<string>();
  for (const b of BOSS_LIST) {
    if (bossIds.has(b.id)) errors.push(`Boss ID 重复：${b.id}（${b.name}）`);
    bossIds.add(b.id);
    if (b.moves.length !== b.phases) {
      errors.push(`${b.name} 阶段数（${b.phases}）与行为池分组数（${b.moves.length}）不一致`);
    }
    for (const pool of b.moves) {
      for (const moveId of pool) {
        if (!(moveId in MOVES)) errors.push(`Boss ${b.name} 引用不存在的技能：${moveId}`);
      }
    }
  }

  // —— 事件 ——
  const eventIds = new Set<string>();
  for (const evt of EVENT_LIST) {
    if (eventIds.has(evt.id)) errors.push(`事件 ID 重复：${evt.id}（${evt.name}）`);
    eventIds.add(evt.id);
    if (evt.weight <= 0) errors.push(`事件 ${evt.name} 权重非法：${evt.weight}`);
    if (evt.options.length === 0) errors.push(`事件 ${evt.name} 无选项`);
  }

  return errors;
}
