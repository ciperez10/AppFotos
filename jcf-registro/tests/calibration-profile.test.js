import { describe, expect, it } from 'vitest';
import { applyCalibration, learnCalibration } from '../src/image/calibration-profile.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
};

describe('aprendizaje privado de bordes', () => {
  it('aplica la corrección vertical inicial sin almacenar una foto', () => {
    const automatic = [{ x: 128.572, y: 628.571 }, { x: 1157.143, y: 628.571 }, { x: 1157.143, y: 1374.286 }, { x: 128.572, y: 1374.286 }];
    const result = applyCalibration(automatic, 1200, 1600, 'rectangle', memoryStorage());
    expect(result.applied).toBe(true);
    expect(result.corners[0].x / 1200).toBeCloseTo(.059088, 5);
    expect(result.corners[2].y / 1600).toBeCloseTo(.772431, 5);
  });

  it('no aplica una calibración memorizada a un encuadre diferente', () => {
    const different = [{ x: 260, y: 300 }, { x: 1060, y: 320 }, { x: 1040, y: 850 }, { x: 240, y: 830 }];
    const result = applyCalibration(different, 1200, 1600, 'rectangle', memoryStorage());
    expect(result.applied).toBe(false);
    expect(result.corners).toEqual(different);
  });

  it('promedia nuevas correcciones y solo guarda números normalizados', () => {
    const storage = memoryStorage(), automatic = [{ x: 100, y: 200 }, { x: 900, y: 200 }, { x: 900, y: 700 }, { x: 100, y: 700 }];
    const corrected = automatic.map(point => ({ x: point.x - 24, y: point.y - 10 }));
    const profile = learnCalibration(automatic, corrected, 1200, 1000, 'rectangle', storage);
    const serialized = storage.getItem('jcf-card-calibration-v2');
    expect(profile.samples).toBe(1);
    expect(profile.correction[0]).toEqual({ x: -.02, y: -.01 });
    const applied = applyCalibration(automatic, 1200, 1000, 'rectangle', storage);
    expect(applied.applied).toBe(true);
    expect(applied.corners[0]).toEqual(corrected[0]);
    expect(serialized).not.toContain('data:image');
    expect(serialized).not.toContain('automatic');
  });
});
