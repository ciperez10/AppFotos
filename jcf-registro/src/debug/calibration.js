import { APP_LABEL, BUILD_ID, VERSION } from '../version.js';

const rounded = value => Math.round(value * 1e6) / 1e6;
const normalized = (corners, width, height) => corners?.map(({ x, y }) => ({ x: rounded(x / width), y: rounded(y / height) })) || null;

export function buildCalibrationReport({ width, height, automaticCorners, correctedCorners, detector = {} }) {
  const automatic = normalized(automaticCorners, width, height), corrected = normalized(correctedCorners, width, height);
  return {
    schema: 'jcf-card-calibration-v1', product: APP_LABEL, version: VERSION, build: BUILD_ID, createdAt: new Date().toISOString(),
    imageGeometry: { width, height, orientation: height > width ? 'portrait' : width > height ? 'landscape' : 'square' },
    detector: { strategy: detector.strategy || 'unknown', elapsedMs: detector.elapsedMs ?? null, threshold: detector.threshold ?? null, score: detector.score ?? null },
    automaticCorners: automatic,
    correctedCorners: corrected,
    correction: automatic && corrected ? corrected.map((point, index) => ({ x: rounded(point.x - automatic[index].x), y: rounded(point.y - automatic[index].y) })) : null,
    privacy: 'Solo geometría y métricas del detector. No contiene fotografía, OCR ni datos personales.'
  };
}

export async function exportCalibration(report) {
  const json = JSON.stringify(report, null, 2), blob = new Blob([json], { type: 'application/json' });
  const filename = `jcf-calibracion-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (typeof File !== 'undefined' && navigator.share) {
    const file = new File([blob], filename, { type: 'application/json' });
    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try { await navigator.share({ title: 'Calibración JCF Registro', text: 'Geometría corregida sin fotografía ni datos personales.', files: [file] }); return 'shared'; }
      catch (error) { if (error.name === 'AbortError') return 'cancelled'; }
    }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); return 'downloaded';
}
