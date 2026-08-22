import { Game } from './core/Game';
import { validateData } from './data/validate';

/** 启动即校验数据层与 wiki 清单的一致性 */
const problems = validateData();
if (problems.length > 0) {
  console.error(`[数据校验] 发现 ${problems.length} 处不一致：`, problems);
} else {
  console.info('[数据校验] 20 刀 / 10 敌 / 5 Boss / 8 事件 / 25 词缀 全部通过');
}

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('找不到画布元素 #game');

new Game(canvas).start();
