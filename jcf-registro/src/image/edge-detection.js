function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (let i = sorted.length - 1; i >= 0; i -= 1) { const p = sorted[i]; while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function extremes(points) {
  return [
    points.reduce((a, p) => p.x + p.y < a.x + a.y ? p : a),
    points.reduce((a, p) => p.x - p.y > a.x - a.y ? p : a),
    points.reduce((a, p) => p.x + p.y > a.x + a.y ? p : a),
    points.reduce((a, p) => p.x - p.y < a.x - a.y ? p : a)
  ];
}

export function defaultCorners(width, height) {
  const x = width * 0.06, y = height * 0.08;
  return [{ x, y }, { x: width - x, y }, { x: width - x, y: height - y }, { x, y: height - y }];
}

export async function detectCardEdges(sourceCanvas, { signal, timeoutMs = 5000 } = {}) {
  const started = performance.now(), maxWidth = 420, scale = Math.min(1, maxWidth / sourceCanvas.width);
  const width = Math.max(120, Math.round(sourceCanvas.width * scale)), height = Math.max(80, Math.round(sourceCanvas.height * scale));
  const work = document.createElement('canvas'); work.width = width; work.height = height;
  const ctx = work.getContext('2d', { willReadFrequently: true }); ctx.drawImage(sourceCanvas, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height), gray = new Uint8Array(width * height), magnitudes = [];
  for (let i = 0; i < gray.length; i += 1) gray[i] = image.data[i * 4] * 0.299 + image.data[i * 4 + 1] * 0.587 + image.data[i * 4 + 2] * 0.114;
  const edge = ctx.createImageData(width, height), samples = [];
  for (let y = 1; y < height - 1; y += 1) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    if (performance.now() - started > timeoutMs) throw new Error('La detección agotó el tiempo disponible.');
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] + gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      const m = Math.min(255, Math.hypot(gx, gy) / 4); magnitudes.push(m);
    }
    if (y % 45 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  magnitudes.sort((a, b) => a - b); const threshold = Math.max(38, magnitudes[Math.floor(magnitudes.length * 0.88)] || 70); let cursor = 0;
  for (let y = 1; y < height - 1; y += 1) {
    if (performance.now() - started > timeoutMs) throw new Error('La detección agotó el tiempo disponible.');
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] + gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      const value = Math.min(255, Math.hypot(gx, gy) / 4), di = i * 4; edge.data[di] = edge.data[di + 1] = edge.data[di + 2] = value > threshold ? 255 : 0; edge.data[di + 3] = 255;
      if (value > threshold && x > width * .02 && x < width * .98 && y > height * .02 && y < height * .98 && cursor++ % 3 === 0) samples.push({ x, y });
    }
    if (y % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  ctx.putImageData(edge, 0, 0);
  if (samples.length < 40) throw new Error('No se encontró un contorno suficientemente claro.');
  const hull = convexHull(samples), cornersSmall = extremes(hull), unique = new Set(cornersSmall.map(p => `${p.x},${p.y}`));
  if (unique.size < 4) throw new Error('No se pudieron separar las cuatro esquinas.');
  const corners = cornersSmall.map(p => ({ x: p.x / scale, y: p.y / scale }));
  const top = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y), bottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y), left = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y), right = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
  const ratio = ((top + bottom) / 2) / ((left + right) / 2);
  if (ratio < 1.15 || ratio > 2.15) throw new Error('El contorno detectado no tiene proporción de cédula.');
  return { corners, edgeCanvas: work, threshold: Math.round(threshold), elapsedMs: Math.round(performance.now() - started) };
}
