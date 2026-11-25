import type { Point } from "./cardLayout";

/** Matriz 3×3 (linha a linha) que leva um ponto do cartão (mm) à imagem (px). */
export type Homography = readonly [number, number, number, number, number, number, number, number, number];

/**
 * Homografia que leva `from[i]` em `to[i]` (4 pares, sem três pontos alinhados).
 * Resolve o sistema 8×8 por eliminação de Gauss com pivoteamento. `null` se for degenerado.
 */
export function solveHomography(from: readonly Point[], to: readonly Point[]): Homography | null {
  if (from.length !== 4 || to.length !== 4) return null;
  const a: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i] as Point;
    const { x: u, y: v } = to[i] as Point;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1)
      if (Math.abs((a[row] as number[])[col] as number) > Math.abs((a[pivot] as number[])[col] as number)) pivot = row;
    const pivotRow = a[pivot] as number[];
    if (Math.abs(pivotRow[col] as number) < 1e-10) return null;
    [a[col], a[pivot]] = [pivotRow, a[col] as number[]];
    const current = a[col] as number[];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const target = a[row] as number[];
      const factor = (target[col] as number) / (current[col] as number);
      if (factor === 0) continue;
      for (let k = col; k <= n; k += 1) target[k] = (target[k] as number) - factor * (current[k] as number);
    }
  }
  const h = a.map((row, i) => (row[n] as number) / (row[i] as number));
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] as unknown as Homography;
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}
