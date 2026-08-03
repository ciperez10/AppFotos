import { describe, expect, it } from 'vitest';
import { defaultCorners, findCardRectangle } from '../src/image/edge-detection.js';

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
});
