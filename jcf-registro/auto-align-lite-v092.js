'use strict';

const JCF_VISIBLE_VERSION_092 = '0.9.2';
let autoBoxV092 = null;
let alignmentModeV092 = 'esperando-imagen';
let detectingV092 = false;

function setVisibleVersionV092() {
  document.title = `JCF Registro v${JCF_VISIBLE_VERSION_092}`;
  const title = document.querySelector('.hero h1');
  if (title) title.textContent = `JCF Registro v${JCF_VISIBLE_VERSION_092}`;
  const badge = document.getElementById('visibleVersionV091');
  if (badge) badge.textContent = `Versión ${JCF_VISIBLE_VERSION_092}`;
  const watermark = document.querySelector('.version-watermark-v091');
  if (watermark) watermark.textContent = `Motor visible: JCF Registro ${JCF_VISIBLE_VERSION_092} · Alineación ligera sin OpenCV`;
}

function setAlignStateV092(state, title, detail) {
  const panel = document.getElementById('alignPanelV091');
  const icon = document.getElementById('alignIconV091');
  const heading = document.getElementById('alignTitleV091');
  const copy = document.getElementById('alignDetailV091');
  const button = document.getElementById('autoAlignBtnV09');
  if (panel) panel.dataset.state = state;
  if (icon) icon.textContent = state === 'success' ? '✅' : state === 'error' ? '⚠️' : state === 'working' ? '⏳' : '📐';
  if (heading) heading.textContent = title;
  if (copy) copy.textContent = detail;
  if (button) {
    button.disabled = state === 'working';
    button.textContent = state === 'working' ? 'Detectando…' : '✨ Detectar bordes automáticamente';
  }
}

function rectSumV092(integral, stride, x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  const x2 = Math.max(x, Math.floor(x + w));
  const y2 = Math.max(y, Math.floor(y + h));
  return integral[y2 * stride + x2] - integral[y * stride + x2] - integral[y2 * stride + x] + integral[y * stride + x];
}

function makeIntegralV092(values, width, height) {
  const stride = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += values[(y - 1) * width + (x - 1)];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
    }
  }
  return {integral, stride};
}

function bestCardBoxV092(image) {
  const dims = sourceDimensions();
  const maxSide = 620;
  const scale = Math.min(1, maxSide / Math.max(dims.w, dims.h));
  const width = Math.max(160, Math.round(dims.w * scale));
  const height = Math.max(160, Math.round(dims.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  drawRotatedImage(ctx, image, rotation, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  const edge = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      gray[y * width + x] = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2];
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const gx = Math.abs(gray[p + 1] - gray[p - 1]);
      const gy = Math.abs(gray[p + width] - gray[p - width]);
      edge[p] = Math.min(255, gx + gy);
    }
  }
  const grayInt = makeIntegralV092(gray, width, height);
  const edgeInt = makeIntegralV092(edge, width, height);
  const ratio = 1.586;
  const step = Math.max(7, Math.round(Math.min(width, height) / 55));
  let best = null;
  for (let wf = .42; wf <= .96; wf += .045) {
    const w = Math.round(width * wf);
    const h = Math.round(w / ratio);
    if (h > height * .94 || h < height * .18) continue;
    const band = Math.max(2, Math.round(Math.min(w, h) * .012));
    for (let y = 0; y <= height - h; y += step) {
      for (let x = 0; x <= width - w; x += step) {
        const top = rectSumV092(edgeInt.integral, edgeInt.stride, x, y, w, band);
        const bottom = rectSumV092(edgeInt.integral, edgeInt.stride, x, y + h - band, w, band);
        const left = rectSumV092(edgeInt.integral, edgeInt.stride, x, y, band, h);
        const right = rectSumV092(edgeInt.integral, edgeInt.stride, x + w - band, y, band, h);
        const borderArea = 2 * w * band + 2 * h * band;
        const borderMean = (top + bottom + left + right) / Math.max(1, borderArea);
        const inside = rectSumV092(grayInt.integral, grayInt.stride, x + band, y + band, w - 2 * band, h - 2 * band);
        const insideArea = Math.max(1, (w - 2 * band) * (h - 2 * band));
        const insideMean = inside / insideArea;
        const ring = Math.max(5, band * 3);
        const ox = Math.max(0, x - ring), oy = Math.max(0, y - ring);
        const ox2 = Math.min(width, x + w + ring), oy2 = Math.min(height, y + h + ring);
        const outer = rectSumV092(grayInt.integral, grayInt.stride, ox, oy, ox2 - ox, oy2 - oy);
        const outerArea = Math.max(1, (ox2 - ox) * (oy2 - oy));
        const ringArea = Math.max(1, outerArea - w * h);
        const ringMean = (outer - rectSumV092(grayInt.integral, grayInt.stride, x, y, w, h)) / ringArea;
        const contrast = Math.abs(insideMean - ringMean);
        const areaRatio = (w * h) / (width * height);
        const centerX = x + w / 2, centerY = y + h / 2;
        const centerPenalty = Math.hypot(centerX - width / 2, centerY - height / 2) / Math.max(width, height);
        const score = borderMean * .75 + contrast * .55 + areaRatio * 22 - centerPenalty * 3;
        if (!best || score > best.score) best = {x, y, w, h, score, borderMean, contrast};
      }
    }
  }
  canvas.width = 1;
  canvas.height = 1;
  if (!best || best.borderMean < 8 || best.score < 9) return null;
  return {
    x: best.x / scale,
    y: best.y / scale,
    w: best.w / scale,
    h: best.h / scale,
    score: Math.round(best.score * 10) / 10
  };
}

function applyBoxV092(box) {
  autoBoxV092 = box;
  alignmentModeV092 = 'automatico-ligero';
  crop = {
    x: box.x * display.scale,
    y: box.y * display.scale,
    w: box.w * display.scale,
    h: box.h * display.scale
  };
  drawEditor();
}

function lockCropRatioV092() {
  if (!sourceImage || !crop || !display.w || !display.h) return;
  const ratio = 1.586;
  let w = Math.max(120, crop.w), h = Math.max(75, crop.h);
  const cx = crop.x + w / 2, cy = crop.y + h / 2;
  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  w = Math.min(w, display.w);
  h = Math.min(h, display.h);
  crop = {
    x: Math.max(0, Math.min(display.w - w, cx - w / 2)),
    y: Math.max(0, Math.min(display.h - h, cy - h / 2)),
    w,
    h
  };
  drawEditor();
}

async function detectCardLiteV092() {
  if (!sourceImage || detectingV092) return false;
  detectingV092 = true;
  setAlignStateV092('working', 'Detectando la cédula…', 'Detector ligero para Safari; no descarga OpenCV.');
  setStatus('ocrStatus', 'Buscando los bordes de la cédula…', 'warn');
  const started = performance.now();
  try {
    await new Promise(resolve => setTimeout(resolve, 30));
    const box = bestCardBoxV092(sourceImage);
    if (!box) throw new Error('sin contorno confiable');
    applyBoxV092(box);
    const ms = Math.round(performance.now() - started);
    setAlignStateV092('success', 'Cédula alineada automáticamente', `Detección completada en ${ms} ms. No necesitas mover el recuadro.`);
    setStatus('ocrStatus', 'Cédula alineada automáticamente. Ya puedes pulsar “Leer cédula”.');
    return true;
  } catch (error) {
    autoBoxV092 = null;
    alignmentModeV092 = 'manual-respaldo';
    lockCropRatioV092();
    setAlignStateV092('error', 'No se detectaron los bordes con seguridad', 'El OCR quedó desbloqueado. Ajusta el recuadro azul a la cédula y continúa.');
    setStatus('ocrStatus', 'Detección automática no concluyente. Ajusta el recuadro azul y pulsa “Leer cédula”.', 'warn');
    return false;
  } finally {
    detectingV092 = false;
    const read = document.getElementById('readBtn');
    if (read) read.disabled = false;
  }
}

const drawEditorBaseV092 = drawEditor;
drawEditor = function() {
  drawEditorBaseV092();
  if (!autoBoxV092 || !sourceImage) return;
  const x = autoBoxV092.x * display.scale;
  const y = autoBoxV092.y * display.scale;
  const w = autoBoxV092.w * display.scale;
  const h = autoBoxV092.h * display.scale;
  cropCtx.save();
  cropCtx.strokeStyle = '#16A36A';
  cropCtx.lineWidth = 5;
  cropCtx.strokeRect(x, y, w, h);
  cropCtx.fillStyle = 'rgba(22,163,106,.94)';
  cropCtx.fillRect(x, Math.max(0, y - 30), Math.min(260, w), 30);
  cropCtx.fillStyle = '#fff';
  cropCtx.font = '700 14px -apple-system, Arial';
  cropCtx.fillText('✓ Alineación automática v0.9.2', x + 8, Math.max(20, y - 10));
  cropCtx.restore();
};

const loadCedulaFileBaseV092 = loadCedulaFile;
loadCedulaFile = function(file, input) {
  autoBoxV092 = null;
  alignmentModeV092 = 'cargando-imagen';
  setAlignStateV092('working', 'Cargando imagen…', 'Al terminar se intentará alinear automáticamente.');
  loadCedulaFileBaseV092(file, input);
  let tries = 0;
  const wait = () => {
    if (sourceImage && sourceImage.complete && sourceImage.naturalWidth) {
      const read = document.getElementById('readBtn');
      if (read) read.disabled = true;
      detectCardLiteV092();
      return;
    }
    if (++tries < 80) setTimeout(wait, 60);
    else {
      setAlignStateV092('error', 'No se pudo preparar la imagen', 'Selecciona la fotografía nuevamente.');
      const read = document.getElementById('readBtn');
      if (read) read.disabled = false;
    }
  };
  setTimeout(wait, 60);
};

const buttonV092 = document.getElementById('autoAlignBtnV09');
if (buttonV092) {
  buttonV092.disabled = false;
  buttonV092.addEventListener('click', detectCardLiteV092);
}

cropCanvas.addEventListener('pointerdown', () => {
  if (!autoBoxV092) return;
  autoBoxV092 = null;
  alignmentModeV092 = 'manual-usuario';
  setAlignStateV092('error', 'Ajuste manual activado', 'Al soltar, la proporción de la cédula se mantendrá fija.');
}, true);
['pointerup', 'pointercancel'].forEach(type => cropCanvas.addEventListener(type, () => {
  if (!autoBoxV092) lockCropRatioV092();
}, true));

document.getElementById('resetCrop')?.addEventListener('click', () => setTimeout(detectCardLiteV092, 80));
document.getElementById('rotateImage')?.addEventListener('click', () => {
  autoBoxV092 = null;
  setTimeout(detectCardLiteV092, 150);
});

const showDiagnosticBaseV092 = showDiagnostic;
showDiagnostic = function(card, result, passes, previews, meta) {
  meta.alignment = {
    version: `JCF-AUTO-ALIGN-${JCF_VISIBLE_VERSION_092}`,
    mode: alignmentModeV092,
    box: autoBoxV092 ? {
      x: Math.round(autoBoxV092.x), y: Math.round(autoBoxV092.y),
      w: Math.round(autoBoxV092.w), h: Math.round(autoBoxV092.h), score: autoBoxV092.score
    } : null,
    perspectiveCorrected: false,
    fixedRatio: true
  };
  return showDiagnosticBaseV092(card, result, passes, previews, meta);
};

// Reloj de seguridad: ninguna lectura debe dejar el botón bloqueado indefinidamente.
const readButtonSafetyV092 = document.getElementById('readBtn');
readButtonSafetyV092?.addEventListener('click', () => {
  setTimeout(() => {
    if (readButtonSafetyV092.disabled) {
      readButtonSafetyV092.disabled = false;
      setStatus('ocrStatus', 'La lectura tardó demasiado y fue desbloqueada. Puedes intentarlo nuevamente con el recorte ajustado.', 'warn');
    }
  }, 45000);
}, true);

setVisibleVersionV092();
setAlignStateV092('idle', 'Detector ligero listo', 'Selecciona una imagen; la detección debe concluir en pocos segundos.');
const readReadyV092 = document.getElementById('readBtn');
if (readReadyV092) readReadyV092.disabled = false;
