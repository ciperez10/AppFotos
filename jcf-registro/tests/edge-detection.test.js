import { describe, expect, it } from 'vitest';
import { defaultCorners, findCardRectangle, refineRectangleCorners } from '../src/image/edge-detection.js';

describe('detección y ajuste de cédula', () => {
  it('propone un marco manual centrado con proporción de tarjeta', () => {
    const corners = defaultCorners(600, 900);
    const width = corners[1].x - corners[0].x, height = corners[3].y - corners[0].y;
    expect(width / height).toBeCloseTo(1.586, 2);
    expect(width * height / (600 * 900)).toBeLessThan(.6);
    expect(corners.every(point => point.x >= 0 && point.y >= 0 && point.x <= 600 && point.y <= 900)).toBe(true);
  });

  it('encuentra la tarjeta y rechaza el marco de toda la fotografía', () => {
    const width = 220, height = 300, gray = new Uint8Array(width * height).fill(65), strength = new Float32Array(width * height);
    const card = { x: 24, y: 128, w: 176, h: 111 };
    for (let y = card.y; y < card.y + card.h; y += 1) for (let x = card.x; x < card.x + card.w; x += 1) gray[y * width + x] = 178;
    for (let x = card.x; x < card.x + card.w; x += 1) { strength[card.y * width + x] = 240; strength[(card.y + card.h - 1) * width + x] = 240; }
    for (let y = card.y; y < card.y + card.h; y += 1) { strength[y * width + card.x] = 240; strength[y * width + card.x + card.w - 1] = 240; }
    const found = findCardRectangle(strength, gray, width, height);
    expect(found).not.toBeNull();
    expect(found.w / found.h).toBeGreaterThan(1.4);
    expect(found.w * found.h / (width * height)).toBeLessThan(.5);
    expect(Math.abs((found.y + found.h / 2) - (card.y + card.h / 2))).toBeLessThan(28);
  });

  it('prefiere la tarjeta completa sobre un bloque interno con bordes más fuertes', () => {
    const width = 240, height = 320, gray = new Uint8Array(width * height).fill(68), strength = new Float32Array(width * height);
    const card = { x: 30, y: 132, w: 180, h: 114 }, innerRight = 160, innerBottom = 217;
    for (let y = card.y; y < card.y + card.h; y += 1) for (let x = card.x; x < card.x + card.w; x += 1) gray[y * width + x] = x < innerRight ? 188 : 142;
    for (let x = card.x; x < card.x + card.w; x += 1) { strength[card.y * width + x] = 110; strength[(card.y + card.h - 1) * width + x] = 110; }
    for (let y = card.y; y < card.y + card.h; y += 1) { strength[y * width + card.x] = 110; strength[y * width + card.x + card.w - 1] = 110; }
    for (let y = card.y; y < card.y + card.h; y += 1) strength[y * width + innerRight] = 245;
    for (let x = card.x; x <= innerRight; x += 1) strength[innerBottom * width + x] = 245;
    const found = findCardRectangle(strength, gray, width, height);
    expect(found.x + found.w).toBeGreaterThan(card.x + card.w - 24);
    expect(found.y + found.h).toBeGreaterThan(card.y + card.h - 24);
    expect(found.w * found.h / (width * height)).toBeGreaterThan(.2);
  });

  it('refina cuatro líneas independientes para una tarjeta inclinada', () => {
    const width = 240, height = 320, gray = new Uint8Array(width * height).fill(55), gx = new Float32Array(width * height), gy = new Float32Array(width * height);
    const top = x => 116 - x * .035, bottom = x => 232 + x * .025, left = y => 24 + y * .025, right = y => 218 - y * .018;
    for (let x = 20; x < 222; x += 1) { const yt = Math.round(top(x)), yb = Math.round(bottom(x)); gy[yt * width + x] = 230; gy[yb * width + x] = 230; gray[(yt + 3) * width + x] = 185; gray[(yb - 3) * width + x] = 185; }
    for (let y = 106; y < 240; y += 1) { const xl = Math.round(left(y)), xr = Math.round(right(y)); gx[y * width + xl] = 230; gx[y * width + xr] = 230; gray[y * width + xl + 3] = 185; gray[y * width + xr - 3] = 185; }
    const corners = refineRectangleCorners({ x: 34, y: 112, w: 174, h: 126 }, gx, gy, gray, width, height);
    expect(corners).not.toBeNull();
    expect(corners[0].y).toBeGreaterThan(corners[1].y);
    expect(corners[2].y).toBeGreaterThan(corners[1].y + 100);
    expect(corners[0].x).toBeLessThan(32);
    expect(corners[2].x).toBeGreaterThan(208);
  });
});
