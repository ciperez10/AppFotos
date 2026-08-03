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
  const ring = Math.max(8, band * 5), ox = Math.max(0, x - ring), oy = Math.max(0, y - ring), ox2 = Math.min(width, x + w + ring), oy2 = Math.min(height, y + h + ring);
  const outerArea = (ox2 - ox) * (oy2 - oy), innerArea = w * h, innerMean = mean(graySum, width, height, x, y, w, h), outerMean = mean(graySum, width, height, ox, oy, ox2 - ox, oy2 - oy);
  const ringMean = (outerMean * outerArea - innerMean * innerArea) / Math.max(1, outerArea - innerArea), globalContrast = Math.abs(innerMean - ringMean);
  const area = innerArea / (width * height), ratioPenalty = Math.abs(Math.log((w / h) / CARD_ASPECT)) * 38;
  const areaPenalty = area > .72 ? (area - .72) * 240 : area < .12 ? (.12 - area) * 240 : 0;
  const marginPenalty = x < width * .015 || y < height * .015 || x + w > width * .985 || y + h > height * .985 ? 18 : 0;
  const centerPenalty = Math.hypot(x + w / 2 - width / 2, y + h / 2 - height / 2) / Math.hypot(width, height) * 18;
  return edgeAverage * .58 + edgeFloor * .16 + contrastAverage * .62 + globalContrast * 1.45 + Math.min(area, .38) * 500 - ratioPenalty - areaPenalty - marginPenalty - centerPenalty;
}

function horizontalLineScore(base, slope, x1, x2, gradient, gray, width, height) {
  const center = (x1 + x2) / 2, step = Math.max(2, Math.round((x2 - x1) / 120)), values = [], contrasts = [];
  for (let x = x1; x <= x2; x += step) {
    const y = Math.round(base + slope * (x - center));
    if (y < 3 || y >= height - 3) continue;
    values.push(gradient[y * width + x]); contrasts.push(Math.abs(gray[(y - 2) * width + x] - gray[(y + 2) * width + x]));
  }
  if (values.length < 12) return 0;
  values.sort((a, b) => a - b);
  return values.reduce((sum, value) => sum + value, 0) / values.length * .58 + values[Math.floor(values.length * .3)] * .42 + contrasts.reduce((sum, value) => sum + value, 0) / contrasts.length * .45;
}

function verticalLineScore(base, slope, y1, y2, gradient, gray, width, height) {
  const center = (y1 + y2) / 2, step = Math.max(2, Math.round((y2 - y1) / 120)), values = [], contrasts = [];
  for (let y = y1; y <= y2; y += step) {
    const x = Math.round(base + slope * (y - center));
    if (x < 3 || x >= width - 3) continue;
    values.push(gradient[y * width + x]); contrasts.push(Math.abs(gray[y * width + x - 2] - gray[y * width + x + 2]));
  }
  if (values.length < 12) return 0;
  values.sort((a, b) => a - b);
  return values.reduce((sum, value) => sum + value, 0) / values.length * .58 + values[Math.floor(values.length * .3)] * .42 + contrasts.reduce((sum, value) => sum + value, 0) / contrasts.length * .45;
}

function searchHorizontalLine(centerY, x1, x2, range, gradient, gray, width, height) {
  let best = null;
  for (let slope = -.12; slope <= .1201; slope += .015) {
    for (let base = Math.max(3, Math.round(centerY - range)); base <= Math.min(height - 4, Math.round(centerY + range)); base += 2) {
      const score = horizontalLineScore(base, slope, x1, x2, gradient, gray, width, height) - Math.abs(base - centerY) / range * 2;
      if (!best || score > best.score) best = { base, slope, score };
    }
  }
  return best;
}

function searchVerticalLine(centerX, y1, y2, range, gradient, gray, width, height) {
  let best = null;
  for (let slope = -.12; slope <= .1201; slope += .015) {
    for (let base = Math.max(3, Math.round(centerX - range)); base <= Math.min(width - 4, Math.round(centerX + range)); base += 2) {
      const score = verticalLineScore(base, slope, y1, y2, gradient, gray, width, height) - Math.abs(base - centerX) / range * 2;
      if (!best || score > best.score) best = { base, slope, score };
    }
  }
  return best;
}

function intersection(horizontal, vertical, horizontalCenter, verticalCenter) {
  const horizontalIntercept = horizontal.base - horizontal.slope * horizontalCenter;
  const verticalIntercept = vertical.base - vertical.slope * verticalCenter;
  const x = (vertical.slope * horizontalIntercept + verticalIntercept) / (1 - vertical.slope * horizontal.slope);
  return { x, y: horizontal.slope * x + horizontalIntercept };
}

export function refineRectangleCorners(rect, gradientX, gradientY, gray, width, height) {
  if (!rect || !gradientX || !gradientY) return null;
  const horizontalRange = Math.max(16, Math.min(height * .09, rect.h * .24)), verticalRange = Math.max(16, Math.min(width * .14, rect.w * .22));
  const xInset = rect.w * .06, yInset = rect.h * .06, x1 = Math.max(5, Math.round(rect.x + xInset)), x2 = Math.min(width - 6, Math.round(rect.x + rect.w - xInset));
  const y1 = Math.max(5, Math.round(rect.y + yInset)), y2 = Math.min(height - 6, Math.round(rect.y + rect.h - yInset));
  let top = searchHorizontalLine(rect.y, x1, x2, horizontalRange, gradientY, gray, width, height), bottom = searchHorizontalLine(rect.y + rect.h, x1, x2, horizontalRange, gradientY, gray, width, height);
  let left = searchVerticalLine(rect.x, y1, y2, verticalRange, gradientX, gray, width, height), right = searchVerticalLine(rect.x + rect.w, y1, y2, verticalRange, gradientX, gray, width, height);
  if (![top, right, bottom, left].every(line => line?.score >= 8)) return null;
  const horizontalCenter = (x1 + x2) / 2, verticalCenter = (y1 + y2) / 2;
  const intersections = () => [intersection(top, left, horizontalCenter, verticalCenter), intersection(top, right, horizontalCenter, verticalCenter), intersection(bottom, right, horizontalCenter, verticalCenter), intersection(bottom, left, horizontalCenter, verticalCenter)];
  let corners = intersections(), initialRatio = ratioOf(corners);
  if (initialRatio < 1.4) {
    const desiredWidth = Math.abs(bottom.base - top.base) * CARD_ASPECT, leftInward = Math.max(0, left.base - rect.x), rightInward = Math.max(0, rect.x + rect.w - right.base);
    if (rightInward >= leftInward) right = { ...right, base: Math.min(width - 2, left.base + desiredWidth) }; else left = { ...left, base: Math.max(2, right.base - desiredWidth) };
    corners = intersections();
  } else if (initialRatio > 1.82) {
    const desiredHeight = Math.abs(right.base - left.base) / CARD_ASPECT, topInward = Math.max(0, top.base - rect.y), bottomInward = Math.max(0, rect.y + rect.h - bottom.base);
    if (bottomInward >= topInward) bottom = { ...bottom, base: Math.min(height - 2, top.base + desiredHeight) }; else top = { ...top, base: Math.max(2, bottom.base - desiredHeight) };
    corners = intersections();
  }
  if (corners.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  corners.forEach(point => { point.x = Math.max(2, Math.min(width - 2, point.x)); point.y = Math.max(2, Math.min(height - 2, point.y)); });
  const ratio = ratioOf(corners), area = polygonArea(corners) / (width * height);
  return ratio >= 1.4 && ratio <= 1.82 && area >= .1 && area <= .8 ? corners : null;
}

export function findCardRectangle(strength, gray, width, height) {
  const edgeSum = integral(strength, width, height), graySum = integral(gray, width, height);
  const ratios = [1.38, 1.48, 1.52, CARD_ASPECT, 1.66, 1.75], gridX = Math.max(5, Math.round(width / 48)), gridY = Math.max(5, Math.round(height / 56));
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
  const image = ctx.getImageData(0, 0, width, height), gray = new Uint8Array(width * height), strength = new Float32Array(width * height), gradientX = new Float32Array(width * height), gradientY = new Float32Array(width * height), magnitudes = [];
  for (let i = 0; i < gray.length; i += 1) gray[i] = image.data[i * 4] * .299 + image.data[i * 4 + 1] * .587 + image.data[i * 4 + 2] * .114;
  for (let y = 1; y < height - 1; y += 1) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    if (performance.now() - started > timeoutMs) throw new Error('La detección agotó el tiempo disponible.');
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] + gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      const value = Math.min(255, Math.hypot(gx, gy) / 4); gradientX[i] = Math.min(255, Math.abs(gx) / 4); gradientY[i] = Math.min(255, Math.abs(gy) / 4); strength[i] = value; magnitudes.push(value);
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

  let cornersSmall = null, strategy = 'contour', score = null;
  if (samples.length >= 40) {
    const hullCorners = extremes(convexHull(samples)), unique = new Set(hullCorners.map(p => `${p.x},${p.y}`));
    const ratio = unique.size === 4 ? ratioOf(hullCorners) : 0, area = polygonArea(hullCorners) / (width * height);
    if (ratio >= 1.2 && ratio <= 2.05 && area >= .12 && area <= .76) cornersSmall = hullCorners;
  }
  if (!cornersSmall) {
    const rect = findCardRectangle(strength, gray, width, height);
    if (rect) { const refined = refineRectangleCorners(rect, gradientX, gradientY, gray, width, height); strategy = refined ? 'quadrilateral' : 'rectangle'; score = Math.round(rect.score * 10) / 10; cornersSmall = refined || [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }]; }
  }
  if (!cornersSmall) throw new Error('No se encontró un contorno de cédula confiable.');
  const corners = cornersSmall.map(p => ({ x: p.x / scale, y: p.y / scale }));
  return { corners, edgeCanvas: work, threshold: Math.round(threshold), elapsedMs: Math.round(performance.now() - started), strategy, score };
}
