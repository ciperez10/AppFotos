import { strToU8, zipSync } from 'fflate';
import { APP_LABEL, BUILD_ID, VERSION } from '../version.js';
import { drawCornerOverlay } from '../ui/crop-editor.js';

const rounded = value => Math.round(value * 1e6) / 1e6;
const normalized = (corners, width, height) => corners?.map(({ x, y }) => ({ x: rounded(x / width), y: rounded(y / height) })) || null;
const pixels = corners => corners?.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) })) || null;
const difference = (first, second) => first && second ? second.map((point, index) => ({ x: rounded(point.x - first[index].x), y: rounded(point.y - first[index].y) })) : null;
const canvasBytes = canvas => new Promise((resolve, reject) => canvas.toBlob(async blob => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('No se pudo crear una captura de calibración.')), 'image/png'));
const download = (blob, name) => { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); };

export function buildCalibrationReport({ width, height, detectorCorners, automaticCorners, correctedCorners, detector = {}, input = {} }) {
  const raw = normalized(detectorCorners || automaticCorners, width, height), automatic = normalized(automaticCorners, width, height), corrected = normalized(correctedCorners, width, height);
  return {
    schema: 'jcf-card-calibration-v2', product: APP_LABEL, version: VERSION, build: BUILD_ID, createdAt: new Date().toISOString(),
    imageGeometry: { width, height, orientation: height > width ? 'portrait' : width > height ? 'landscape' : 'square' },
    input: { source: input.source || 'unknown', size: input.size || 0, type: input.type || 'unknown' },
    detector: { strategy: detector.strategy || 'unknown', elapsedMs: detector.elapsedMs ?? null, threshold: detector.threshold ?? null, score: detector.score ?? null, calibrationApplied: Boolean(detector.calibrationApplied), calibrationSamples: detector.calibrationSamples || 0, error: detector.error || null },
    detectorCorners: raw,
    automaticCorners: automatic,
    correctedCorners: corrected,
    correctionFromAutomatic: difference(automatic, corrected),
    correctionFromDetector: difference(raw, corrected),
    pixelCorners: { detector: pixels(detectorCorners || automaticCorners), automatic: pixels(automaticCorners), corrected: pixels(correctedCorners) },
    packageContents: ['captura-automatica.png', 'captura-ajustada.png', 'calibracion.json', 'resumen.txt'],
    privacy: 'El ZIP incluye dos capturas de la cédula con información personal visible. Solo se crea y comparte después de una confirmación explícita.'
  };
}

export function calibrationAsText(report) {
  return [
    `${report.product} · calibración completa`,
    `Creado: ${report.createdAt}`,
    `Compilación: ${report.build}`,
    `Imagen: ${report.imageGeometry.width} × ${report.imageGeometry.height} (${report.imageGeometry.orientation})`,
    `Entrada: ${report.input.source} · ${report.input.type} · ${report.input.size} bytes`,
    `Detector: ${report.detector.strategy} · ${report.detector.elapsedMs ?? '—'} ms · umbral ${report.detector.threshold ?? '—'} · puntuación ${report.detector.score ?? '—'}`,
    `Calibración previa aplicada: ${report.detector.calibrationApplied ? `sí (${report.detector.calibrationSamples} muestra/s)` : 'no'}`,
    '',
    `Esquinas del detector: ${JSON.stringify(report.detectorCorners)}`,
    `Esquinas automáticas mostradas: ${JSON.stringify(report.automaticCorners)}`,
    `Esquinas corregidas: ${JSON.stringify(report.correctedCorners)}`,
    `Corrección desde lo mostrado: ${JSON.stringify(report.correctionFromAutomatic)}`,
    '',
    'ATENCIÓN: captura-automatica.png y captura-ajustada.png contienen la fotografía completa de la cédula.'
  ].join('\n');
}

function capture(source, corners, mode) {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; drawCornerOverlay(canvas, source, corners, mode); return canvas;
}

export async function exportCalibrationPackage({ report, source, automaticCorners, correctedCorners }) {
  const automatic = capture(source, automaticCorners, 'automatic'), corrected = capture(source, correctedCorners, 'manual');
  try {
    const files = {
      'captura-automatica.png': await canvasBytes(automatic),
      'captura-ajustada.png': await canvasBytes(corrected),
      'calibracion.json': strToU8(JSON.stringify(report, null, 2)),
      'resumen.txt': strToU8(calibrationAsText(report))
    };
    const zipped = zipSync(files, { level: 6 }), file = new File([zipped], `jcf-calibracion-completa-${Date.now()}.zip`, { type: 'application/zip' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ title: 'Calibración completa JCF Registro', text: 'Incluye capturas automática y ajustada, más datos técnicos. Contiene información personal.', files: [file] }); return 'shared'; }
      catch (error) { if (error.name === 'AbortError') return 'cancelled'; }
    }
    download(file, file.name); return 'downloaded';
  } finally { automatic.width = automatic.height = corrected.width = corrected.height = 1; }
}
