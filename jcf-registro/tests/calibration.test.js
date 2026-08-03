import { describe, expect, it } from 'vitest';
import { buildCalibrationReport } from '../src/debug/calibration.js';

describe('paquete de calibración privado', () => {
  it('incluye correcciones normalizadas sin imagen, OCR ni datos personales', () => {
    const report = buildCalibrationReport({ width: 1000, height: 1500, automaticCorners: [{ x: 100, y: 300 }, { x: 900, y: 300 }, { x: 900, y: 900 }, { x: 100, y: 900 }], correctedCorners: [{ x: 110, y: 310 }, { x: 890, y: 310 }, { x: 860, y: 820 }, { x: 120, y: 820 }], detector: { strategy: 'rectangle', elapsedMs: 213, score: 88 } });
    expect(report.correctedCorners[0].x).toBe(.11);
    expect(report.correctedCorners[0].y).toBeCloseTo(.206667, 6);
    expect(report.correction[2].y).toBeCloseTo(-.053333, 6);
    expect(report).not.toHaveProperty('photo'); expect(report).not.toHaveProperty('image'); expect(report).not.toHaveProperty('ocr'); expect(report).not.toHaveProperty('personalData');
  });
});
