import { describe, expect, it } from 'vitest';
import { buildCalibrationReport, calibrationAsText } from '../src/debug/calibration.js';

describe('paquete de calibración privado', () => {
  it('incluye detector, vista automática, corrección y contenido del paquete', () => {
    const raw = [{ x: 90, y: 290 }, { x: 910, y: 290 }, { x: 910, y: 920 }, { x: 90, y: 920 }], automatic = [{ x: 100, y: 300 }, { x: 900, y: 300 }, { x: 900, y: 900 }, { x: 100, y: 900 }], corrected = [{ x: 110, y: 310 }, { x: 890, y: 310 }, { x: 860, y: 820 }, { x: 120, y: 820 }];
    const report = buildCalibrationReport({ width: 1000, height: 1500, detectorCorners: raw, automaticCorners: automatic, correctedCorners: corrected, detector: { strategy: 'rectangle', elapsedMs: 213, score: 88, calibrationApplied: true, calibrationSamples: 2 }, input: { source: 'gallery', size: 12345, type: 'image/jpeg' } });
    expect(report.correctedCorners[0].x).toBe(.11);
    expect(report.correctedCorners[0].y).toBeCloseTo(.206667, 6);
    expect(report.correctionFromAutomatic[2].y).toBeCloseTo(-.053333, 6);
    expect(report.detectorCorners[0].x).toBe(.09);
    expect(report.pixelCorners.corrected[2]).toEqual({ x: 860, y: 820 });
    expect(report.packageContents).toContain('captura-automatica.png');
    expect(calibrationAsText(report)).toContain('gallery · image/jpeg · 12345 bytes');
    expect(report).not.toHaveProperty('photo'); expect(report).not.toHaveProperty('image'); expect(report).not.toHaveProperty('ocr'); expect(report).not.toHaveProperty('personalData');
  });
});
