import { NORMALIZED_SIZE } from '../version.js';

function solve(matrix, values) {
  const n = values.length;
  const a = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10) throw new Error('Las esquinas no forman una tarjeta válida.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[n]);
}

export function homography(from, to) {
  const matrix = [], values = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = from[i], { x: u, y: v } = to[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]); values.push(v);
  }
  return [...solve(matrix, values), 1];
}

export function polygonArea(points) {
  return Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

export function validateCorners(points, width, height) {
  if (!Array.isArray(points) || points.length !== 4) return false;
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > width || p.y > height)) return false;
  return polygonArea(points) > width * height * 0.08;
}

export async function warpPerspective(sourceCanvas, points, { signal, onProgress } = {}) {
  const { width, height } = NORMALIZED_SIZE;
  if (!validateCorners(points, sourceCanvas.width, sourceCanvas.height)) throw new Error('Ajusta las cuatro esquinas antes de continuar.');
  const destination = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const h = homography(destination, points);
  const source = sourceCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const outputCanvas = document.createElement('canvas'); outputCanvas.width = width; outputCanvas.height = height;
  const output = new ImageData(width, height), src = source.data, dst = output.data, sw = source.width, sh = source.height;
  for (let y = 0; y < height; y += 1) {
    if (signal?.aborted) throw new DOMException('Análisis cancelado', 'AbortError');
    for (let x = 0; x < width; x += 1) {
      const d = h[6] * x + h[7] * y + 1;
      const sx = (h[0] * x + h[1] * y + h[2]) / d, sy = (h[3] * x + h[4] * y + h[5]) / d;
      const x0 = Math.max(0, Math.min(sw - 1, Math.floor(sx))), y0 = Math.max(0, Math.min(sh - 1, Math.floor(sy)));
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
      const indices = [(y0 * sw + x0) * 4, (y0 * sw + x1) * 4, (y1 * sw + x0) * 4, (y1 * sw + x1) * 4];
      const out = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) dst[out + c] = src[indices[0] + c] * (1 - fx) * (1 - fy) + src[indices[1] + c] * fx * (1 - fy) + src[indices[2] + c] * (1 - fx) * fy + src[indices[3] + c] * fx * fy;
      dst[out + 3] = 255;
    }
    if (y % 80 === 0) { onProgress?.(y / height); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  outputCanvas.getContext('2d').putImageData(output, 0, 0); onProgress?.(1); return outputCanvas;
}
