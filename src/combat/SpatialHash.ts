/**
 * 空间哈希网格（wiki 03-战斗总纲·性能预算：cell=1.0，每帧全量刷新）。
 * 碰撞检测粗筛：敌人按半径覆盖插入，刀按几何包围盒查询。
 */
export class SpatialHash<T> {
  private cells = new Map<string, T[]>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    this.cells.clear();
  }

  private cellKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /** 插入圆形范围（覆盖圆外接方格涉及的所有格子） */
  insert(item: T, x: number, y: number, r: number): void {
    const minCx = Math.floor((x - r) / this.cellSize);
    const maxCx = Math.floor((x + r) / this.cellSize);
    const minCy = Math.floor((y - r) / this.cellSize);
    const maxCy = Math.floor((y + r) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.cellKey(cx, cy);
        let arr = this.cells.get(key);
        if (!arr) {
          arr = [];
          this.cells.set(key, arr);
        }
        arr.push(item);
      }
    }
  }

  /** 查询矩形范围内（外接）的所有候选（去重） */
  queryRect(minX: number, minY: number, maxX: number, maxY: number): T[] {
    const minCx = Math.floor(minX / this.cellSize);
    const maxCx = Math.floor(maxX / this.cellSize);
    const minCy = Math.floor(minY / this.cellSize);
    const maxCy = Math.floor(maxY / this.cellSize);
    const seen = new Set<T>();
    const out: T[] = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.cells.get(this.cellKey(cx, cy));
        if (!arr) continue;
        for (const item of arr) {
          if (!seen.has(item)) {
            seen.add(item);
            out.push(item);
          }
        }
      }
    }
    return out;
  }
}
