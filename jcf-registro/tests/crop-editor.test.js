import { describe, expect, it } from 'vitest';
import { containMetrics, pointInContainedCanvas } from '../src/ui/crop-editor.js';

describe('coordenadas táctiles del editor', () => {
  it('descuenta las franjas laterales creadas por object-fit contain', () => {
    const content = containMetrics(1200, 1600, 554, 628);
    expect(content.left).toBeGreaterThan(40);
    const left = pointInContainedCanvas(10 + content.left, 20, { left: 10, top: 20, width: 554, height: 628 }, 1200, 1600);
    const right = pointInContainedCanvas(10 + content.left + content.width, 20 + content.height, { left: 10, top: 20, width: 554, height: 628 }, 1200, 1600);
    expect(left.x).toBeCloseTo(0, 4); expect(left.y).toBeCloseTo(0, 4);
    expect(right.x).toBeCloseTo(1200, 4); expect(right.y).toBeCloseTo(1600, 4);
  });
});
