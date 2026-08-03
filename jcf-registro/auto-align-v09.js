'use strict';

const AUTO_ALIGN_VERSION = 'JCF-AUTO-ALIGN-0.9.0';
let autoCornersV09 = null;
let cvApiV09 = null;
let cvPromiseV09 = null;
let alignmentModeV09 = 'manual';

function resolveCvV09() {
  if (cvPromiseV09) return cvPromiseV09;
  cvPromiseV09 = new Promise((resolve, reject) => {
    const finish = async () => {
      try {
        let api = window.cv;
        if (api && typeof api.then === 'function') api = await api;
        if (api && api.Mat) {
          cvApiV09 = api;
          resolve(api);
          return;
        }
        if (api) {
          api.onRuntimeInitialized = () => {
            cvApiV09 = api;
            resolve(api);
          };
          setTimeout(() => {
            if (!cvApiV09) reject(new Error('OpenCV no terminó de cargar'));
          }, 25000);
          return;
        }
        reject(new Error('OpenCV no disponible'));
      } catch (error) {
        reject(error);
      }
    };

    if (window.cv) {
      finish();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error('No se pudo descargar el detector de bordes'));
    document.head.appendChild(script);
  });
  return cvPromiseV09;
}

function orderCornersV09(points) {
  const p = points.map(point => ({x: Number(point.x), y: Number(point.y)}));
  const bySum = [...p].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const byDiff = [...p].sort((a, b) => (a.x - a.y) - (b.x - b.y));
  return [bySum[0], byDiff[3], bySum[3], byDiff[0]]; // TL, TR, BR, BL
}

function distanceV09(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function candidateScoreV09(points, area, imageArea) {
  const ordered = orderCornersV09(points);
  const width = Math.max(distanceV09(ordered[0], ordered[1]), distanceV09(ordered[3], ordered[2]));
  const height = Math.max(distanceV09(ordered[0], ordered[3]), distanceV09(ordered[1], ordered[2]));
  if (!width || !height) return -999;
  const ratio = width / height;
  if (ratio < 1.20 || ratio > 2.10) return -999;
  const areaRatio = area / imageArea;
  const ratioPenalty = Math.abs(Math.log(ratio / 1.586));
  return areaRatio * 12 - ratioPenalty * 4;
}

function contourCandidatesV09(cv, binary, imageArea) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const candidates = [];
  try {
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = Math.abs(cv.contourArea(contour));
      if (area < imageArea * 0.12) {
        contour.delete();
        continue;
      }
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, perimeter * 0.025, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const data = approx.data32S;
        const points = [];
        for (let j = 0; j < 4; j++) points.push({x: data[j * 2], y: data[j * 2 + 1]});
        const score = candidateScoreV09(points, area, imageArea);
        if (score > -900) candidates.push({points, score, area});
      }
      approx.delete();
      contour.delete();
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
  return candidates;
}

async function detectCardCornersV09() {
  if (!sourceImage) return false;
  const button = document.getElementById('autoAlignBtnV09');
  if (button) button.disabled = true;
  setStatus('ocrStatus', 'Detectando y enderezando automáticamente la cédula…', 'warn');
  try {
    const cv = await resolveCvV09();
    const dims = sourceDimensions();
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(dims.w, dims.h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(dims.w * scale));
    canvas.height = Math.max(1, Math.round(dims.h * scale));
    const context = canvas.getContext('2d', {willReadFrequently: true});
    drawRotatedImage(context, sourceImage, rotation, canvas.width, canvas.height);

    const source = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const dilated = new cv.Mat();
    const threshold = new cv.Mat();
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    let candidates = [];
    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      cv.Canny(blurred, edges, 45, 145);
      cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 1);
      candidates.push(...contourCandidatesV09(cv, dilated, canvas.width * canvas.height));

      cv.adaptiveThreshold(blurred, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 7);
      cv.bitwise_not(threshold, threshold);
      candidates.push(...contourCandidatesV09(cv, threshold, canvas.width * canvas.height));
    } finally {
      source.delete(); gray.delete(); blurred.delete(); edges.delete(); dilated.delete(); threshold.delete(); kernel.delete();
    }

    candidates.sort((a, b) => b.score - a.score || b.area - a.area);
    const best = candidates[0];
    if (!best || best.score < 0.75) throw new Error('No se encontró un contorno confiable');

    autoCornersV09 = orderCornersV09(best.points).map(point => ({x: point.x / scale, y: point.y / scale}));
    alignmentModeV09 = 'automatico-perspectiva';

    const xs = autoCornersV09.map(point => point.x * display.scale);
    const ys = autoCornersV09.map(point => point.y * display.scale);
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(display.w, Math.max(...xs));
    const maxY = Math.min(display.h, Math.max(...ys));
    crop = {x: minX, y: minY, w: Math.max(120, maxX - minX), h: Math.max(75, maxY - minY)};
    drawEditor();
    setStatus('ocrStatus', 'Cédula detectada y alineada automáticamente. Ya puedes pulsar “Leer cédula”.');
    return true;
  } catch (error) {
    console.warn('Alineación automática no disponible:', error);
    autoCornersV09 = null;
    alignmentModeV09 = 'manual-respaldo';
    setStatus('ocrStatus', 'No pude detectar los cuatro bordes automáticamente. Ajusta el recuadro azul exactamente a la cédula y pulsa “Leer cédula”.', 'warn');
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

const drawEditorBaseV09 = drawEditor;
drawEditor = function() {
  drawEditorBaseV09();
  if (!autoCornersV09 || !sourceImage) return;
  const points = autoCornersV09.map(point => ({x: point.x * display.scale, y: point.y * display.scale}));
  cropCtx.save();
  cropCtx.strokeStyle = '#16A36A';
  cropCtx.lineWidth = 5;
  cropCtx.beginPath();
  cropCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) cropCtx.lineTo(points[i].x, points[i].y);
  cropCtx.closePath();
  cropCtx.stroke();
  cropCtx.fillStyle = '#FFFFFF';
  for (const point of points) {
    cropCtx.beginPath();
    cropCtx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    cropCtx.fill();
    cropCtx.stroke();
  }
  cropCtx.font = '700 15px -apple-system, Arial';
  cropCtx.fillStyle = 'rgba(22,163,106,.94)';
  cropCtx.fillRect(points[0].x, Math.max(0, points[0].y - 30), 205, 30);
  cropCtx.fillStyle = '#FFFFFF';
  cropCtx.fillText('✓ Alineación automática', points[0].x + 8, Math.max(20, points[0].y - 10));
  cropCtx.restore();
};

const makeCardCanvasBaseV09 = makeCardCanvas;
makeCardCanvas = function() {
  if (!autoCornersV09 || !cvApiV09 || !sourceImage) return makeCardCanvasBaseV09();
  const cv = cvApiV09;
  const dims = sourceDimensions();
  const full = document.createElement('canvas');
  full.width = dims.w;
  full.height = dims.h;
  drawRotatedImage(full.getContext('2d', {willReadFrequently: true}), sourceImage, rotation, dims.w, dims.h);
  const output = document.createElement('canvas');
  output.width = 1586;
  output.height = 1000;
  let src, dst, matrix, srcPoints, dstPoints;
  try {
    src = cv.imread(full);
    dst = new cv.Mat();
    const values = autoCornersV09.flatMap(point => [point.x, point.y]);
    srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, values);
    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 1585, 0, 1585, 999, 0, 999]);
    matrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
    cv.warpPerspective(src, dst, matrix, new cv.Size(1586, 1000), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
    cv.imshow(output, dst);
    return output;
  } catch (error) {
    console.warn('Falló la corrección de perspectiva:', error);
    return makeCardCanvasBaseV09();
  } finally {
    full.width = 1; full.height = 1;
    if (src) src.delete(); if (dst) dst.delete(); if (matrix) matrix.delete(); if (srcPoints) srcPoints.delete(); if (dstPoints) dstPoints.delete();
  }
};

const loadCedulaFileBaseV09 = loadCedulaFile;
loadCedulaFile = function(file, input) {
  autoCornersV09 = null;
  alignmentModeV09 = 'detectando';
  loadCedulaFileBaseV09(file, input);
  let attempts = 0;
  const wait = () => {
    if (sourceImage && sourceImage.complete && sourceImage.naturalWidth) {
      detectCardCornersV09();
      return;
    }
    if (++attempts < 80) setTimeout(wait, 75);
  };
  setTimeout(wait, 75);
};

const editorButtonsV09 = document.getElementById('resetCrop')?.parentElement;
if (editorButtonsV09 && !document.getElementById('autoAlignBtnV09')) {
  const button = document.createElement('button');
  button.className = 'btn light mini';
  button.id = 'autoAlignBtnV09';
  button.type = 'button';
  button.textContent = '✨ Detectar bordes';
  button.addEventListener('click', detectCardCornersV09);
  editorButtonsV09.appendChild(button);
}

const helpV09 = document.querySelector('.editor-help');
if (helpV09) helpV09.textContent = 'La cédula se detecta y endereza automáticamente. Solo mueve el recuadro azul si la detección falla.';

cropCanvas.addEventListener('pointerdown', () => {
  if (!autoCornersV09) return;
  autoCornersV09 = null;
  alignmentModeV09 = 'manual-usuario';
  setStatus('ocrStatus', 'Cambiaste a ajuste manual. Coloca el recuadro exactamente sobre los cuatro bordes de la cédula.', 'warn');
}, true);

document.getElementById('rotateImage')?.addEventListener('click', () => {
  autoCornersV09 = null;
  setTimeout(detectCardCornersV09, 120);
});

document.getElementById('resetCrop')?.addEventListener('click', () => {
  autoCornersV09 = null;
  setTimeout(detectCardCornersV09, 120);
});

const showDiagnosticBaseV09 = showDiagnostic;
showDiagnostic = function(card, result, passes, previews, meta) {
  meta.alignment = {
    version: AUTO_ALIGN_VERSION,
    mode: alignmentModeV09,
    corners: autoCornersV09 ? autoCornersV09.map(point => ({x: Math.round(point.x), y: Math.round(point.y)})) : null,
    perspectiveCorrected: Boolean(autoCornersV09)
  };
  return showDiagnosticBaseV09(card, result, passes, previews, meta);
};
