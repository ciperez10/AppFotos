const CARD_ASPECT = 1.586;

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

function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
}

function integral(values, width, height) {
  const stride = width + 1, output = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += values[y * width + x];
      output[(y + 1) * stride + x + 1] = output[y * stride + x + 1] + row;
    }
  }
  return output;
}

function mean(sum, width, height, x, y, w, h) {
  const x1 = Math.max(0, Math.min(width, Math.round(x))), y1 = Math.max(0, Math.min(height, Math.round(y)));
  const x2 = Math.max(x1 + 1, Math.min(width, Math.round(x + w))), y2 = Math.max(y1 + 1, Math.min(height, Math.round(y + h)));
  const stride = width + 1;
  return (sum[y2 * stride + x2] - sum[y1 * stride + x2] - sum[y2 * stride + x1] + sum[y1 * stride + x1]) / ((x2 - x1) * (y2 - y1));
}

function scoreRectangle(rect, edgeSum, graySum, width, height) {
  const { x, y, w, h } = rect, band = Math.max(2, Math.round(Math.min(w, h) * .018));
  const insetX = w * .06, insetY = h * .06;
  const edges = [
    mean(edgeSum, width, height, x + insetX, y - band, w - 2 * insetX, 2 * band),
    mean(edgeSum, width, height, x + insetX, y + h - band, w - 2 * insetX, 2 * band),
    mean(edgeSum, width, height, x - band, y + insetY, 2 * band, h - 2 * insetY),
    mean(edgeSum, width, height, x + w - band, y + insetY, 2 * band, h - 2 * insetY)
  ];
  const strip = Math.max(3, band * 2), contrasts = [
    Math.abs(mean(graySum, width, height, x + insetX, y + 1, w - 2 * insetX, strip) - mean(graySum, width, height, x + insetX, y - strip, w - 2 * insetX, strip)),
    Math.abs(mean(graySum, width, height, x + insetX, y + h - strip, w - 2 * insetX, strip) - mean(graySum, width, height, x + insetX, y + h, w - 2 * insetX, strip)),
    Math.abs(mean(graySum, width, height, x + 1, y + insetY, strip, h - 2 * insetY) - mean(graySum, width, height, x - strip, y + insetY, strip, h - 2 * insetY)),
    Math.abs(mean(graySum, width, height, x + w - strip, y + insetY, strip, h - 2 * insetY) - mean(graySum, width, height, x + w, y + insetY, strip, h - 2 * insetY))
  ];
  const edgeAverage = edges.reduce((a, b) => a + b, 0) / 4;
  const contrastAverage = contrasts.reduce((a, b) => a + b, 0) / 4;
  const edgeFloor = [...edges].sort((a, b) => a - b)[1];
  const area = w * h / (width * height), ratioPenalty = Math.abs(Math.log((w / h) / CARD_ASPECT)) * 18;
  const areaPenalty = area > .72 ? (area - .72) * 240 : area < .12 ? (.12 - area) * 240 : 0;
  const marginPenalty = x < width * .015 || y < height * .015 || x + w > width * .985 || y + h > height * .985 ? 18 : 0;
  return edgeAverage * .72 + edgeFloor * .22 + contrastAverage * 1.35 - ratioPenalty - areaPenalty - marginPenalty;
}

export function findCardRectangle(strength, gray, width, height) {
  const edgeSum = integral(strength, width, height), graySum = integral(gray, width, height);
  const ratios = [1.28, 1.4, 1.5, CARD_ASPECT, 1.7, 1.85], gridX = Math.max(5, Math.round(width / 48)), gridY = Math.max(5, Math.round(height / 56));
  let best = null;
  for (let w = Math.round(width * .9); w >= width * .3; w -= Math.max(12, Math.round(width / 24))) {
    for (const ratio of ratios) {
      const h = Math.round(w / ratio);
      if (h < height * .16 || h > height * .82) continue;
      for (let y = gridY; y + h < height - gridY; y += gridY) {
        for (let x = gridX; x + w < width - gridX; x += gridX) {
          const candidate = { x, y, w, h }, score = scoreRectangle(candidate, edgeSum, graySum, width, height);
          if (!best || score > best.score) best = { ...candidate, score };
        }
      }
    }
  }
  return best && best.score >= 32 ? best : null;
}

export function defaultCorners(width, height) {
  const w = Math.min(width * .86, height * .7 * CARD_ASPECT), h = w / CARD_ASPECT;
  const cx = width / 2, cy = height * (height > width * 1.15 ? .56 : .5);
  const x = Math.max(2, cx - w / 2), y = Math.max(2, Math.min(height - h - 2, cy - h / 2));
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

function ratioOf(corners) {
  const top = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y), bottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const left = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y), right = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
  return ((top + bottom) / 2) / ((left + right) / 2);
}

export async function detectCardEdges(sourceCanvas, { signal, timeoutMs = 5000 } = {}) {
  const started = performance.now(), maxWidth = 420, scale = Math.min(1, maxWidth / sourceCanvas.width);
  const width = Math.max(120, Math.round(sourceCanvas.width * scale)), height = Math.max(80, Math.round(sourceCanvas.height * scale));
  const work = document.createElement('canvas'); work.width = width; work.height = height;
  const ctx = work.getContext('2d', { willReadFrequently: true }); ctx.drawImage(sourceCanvas, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height), gray = new Uint8Array(width * height), strength = new Float32Array(width * height), magnitudes = [];
  for (let i = 0; i < gray.length; i += 1) gray[i] = image.data[i * 4] * .299 + image.data[i * 4 + 1] * .587 + image.data[i * 4 + 2] * .114;
  for (let y = 1; y < height - 1; y += 1) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    if (performance.now() - started > timeoutMs) throw new Error('La detección agotó el tiempo disponible.');
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] + gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      const value = Math.min(255, Math.hypot(gx, gy) / 4); strength[i] = value; magnitudes.push(value);
    }
    if (y % 45 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  magnitudes.sort((a, b) => a - b);
  const threshold = Math.max(38, magnitudes[Math.floor(magnitudes.length * .88)] || 70), edge = ctx.createImageData(width, height), samples = [];
  let sampleCursor = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x, value = strength[i], di = i * 4, visible = value > threshold;
      edge.data[di] = edge.data[di + 1] = edge.data[di + 2] = visible ? 255 : 0; edge.data[di + 3] = 255;
      if (visible && x > width * .02 && x < width * .98 && y > height * .02 && y < height * .98 && sampleCursor++ % 3 === 0) samples.push({ x, y });
    }
    if (y % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  ctx.putImageData(edge, 0, 0);
  if (performance.now() - started > timeoutMs) throw new Error('La detección agotó el tiempo disponible.');

  let cornersSmall = null;
  if (samples.length >= 40) {
    const hullCorners = extremes(convexHull(samples)), unique = new Set(hullCorners.map(p => `${p.x},${p.y}`));
    const ratio = unique.size === 4 ? ratioOf(hullCorners) : 0, area = polygonArea(hullCorners) / (width * height);
    if (ratio >= 1.2 && ratio <= 2.05 && area >= .12 && area <= .76) cornersSmall = hullCorners;
  }
  if (!cornersSmall) {
    const rect = findCardRectangle(strength, gray, width, height);
    if (rect) cornersSmall = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }];
  }
  if (!cornersSmall) throw new Error('No se encontró un contorno de cédula confiable.');
  const corners = cornersSmall.map(p => ({ x: p.x / scale, y: p.y / scale }));
  return { corners, edgeCanvas: work, threshold: Math.round(threshold), elapsedMs: Math.round(performance.now() - started) };
}
