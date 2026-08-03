const CARD_ASPECT = 1.586;

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (let i = sorted.length - 1; i >= 0; i -= 1) { const p = sorted[i]; while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function extremes(points) {
  return [
    points.reduce((a, p) => p.x + p.y < a.x + a.y ? p : a),
    points.reduce((a, p) => p.x - p.y > a.x - a.y ? p : a),
    points.reduce((a, p) => p.x + p.y > a.x + a.y ? p : a),
    points.reduce((a, p) => p.x - p.y < a.x - a.y ? p : a)
  ];
}

function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
}

function integral(values, width, height) {
  const stride = width + 1, output = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += values[y * width + x];
      output[(y + 1) * stride + x + 1] = output[y * stride + x + 1] + row;
    }
  }
  return output;
}

function mean(sum, width, height, x, y, w, h) {
  const x1 = Math.max(0, Math.min(width, Math.round(x))), y1 = Math.max(0, Math.min(height, Math.round(y)));
  const x2 = Math.max(x1 + 1, Math.min(width, Math.round(x + w))), y2 = Math.max(y1 + 1, Math.min(height, Math.round(y + h)));
  const stride = width + 1;
  return (sum[y2 * stride + x2] - sum[y1 * stride + x2] - sum[y2 * stride + x1] + sum[y1 * stride + x1]) / ((x2 - x1) * (y2 - y1));
}

function scoreRectangle(rect, edgeSum, graySum, width, height) {
  const { x, y, w, h } = rect, band = Math.max(2, Math.round(Math.min(w, h) * .018));
  const insetX = w * .06, insetY = h * .06;
  const edges = [
    mean(edgeSum, width, height, x + insetX, y - band, w - 2 * insetX, 2 * band),
    mean(edgeSum, width, height, x + insetX, y + h - band, w - 2 * insetX, 2 * band),
    mean(edgeSum, width, height, x - band, y + insetY, 2 * band, h - 2 * insetY),
    mean(edgeSum, width, height, x + w - band, y + insetY, 2 * band, h - 2 * insetY)
  ];
  const strip = Math.max(3, band * 2), contrasts = [
    Math.abs(mean(graySum, width, height, x + insetX, y + 1, w - 2 * insetX, strip) - mean(graySum, width, height, x + insetX, y - strip, w - 2 * insetX, strip)),
    Math.abs(mean(graySum, width, height, x + insetX, y + h - strip, w - 2 * insetX, strip) - mean(graySum, width, height, x + insetX, y + h, w - 2 * insetX, strip)),
    Math.abs(mean(graySum, width, height, x + 1, y + insetY, strip, h - 2 * insetY) - mean(graySum, width, height, x - strip, y + insetY, strip, h - 2 * insetY)),
    Math.abs(mean(graySum, width, height, x + w - strip, y + insetY, strip, h - 2 * insetY) - mean(graySum, width, height, x + w, y + insetY, strip, h - 2 * insetY))
  ];
  const edgeAverage = edges.reduce((a, b) => a + b, 0) / 4;
  const contrastAverage = contrasts.reduce((a, b) => a + b, 0) / 4;
  const edgeFloor = [...edges].sort((a, b) => a - b)[1];
  const ring = Math.max(8, band * 5), ox = Math.max(0, x - ring), oy = Math.max(0, y - ring), ox2 = Math.min(width, x + w + ring), oy2 = Math.min(height, y + h + ring);
  const outerArea = (ox2 - ox) * (oy2 - oy), innerArea = w * h, innerMean = mean(graySum, width, height, x, y, w, h), outerMean = mean(graySum, width, height, ox, oy, ox2 - ox, oy2 - oy);
  const ringMean = (outerMean * outerArea - innerMean * innerArea) / Math.max(1, outerArea - innerArea), globalContrast = Math.abs(innerMean - ringMean);
  const area = innerArea / (width * height), ratioPenalty = Math.abs(Math.log((w / h) / CARD_ASPECT)) * 38;
  const areaPenalty = area > .72 ? (area - .72) * 240 : area < .12 ? (.12 - area) * 240 : 0;
  const marginPenalty = x < width * .015 || y < height * .015 || x + w > width * .985 || y + h > height * .985 ? 18 : 0;
  const centerPenalty = Math.hypot(x + w / 2 - width / 2, y + h / 2 - height / 2) / Math.hypot(width, height) * 18;
  return edgeAverage * .58 + edgeFloor * .16 + contrastAverage * .62 + globalContrast * 1.45 + Math.min(area, .38) * 500 - ratioPenalty - areaPenalty - marginPenalty - centerPenalty;
}

export function findCardRectangle(strength, gray, width, height) {
  const edgeSum = integral(strength, width, height), graySum = integral(gray, width, height);
  const ratios = [1.38, 1.48, 1.52, CARD_ASPECT, 1.66, 1.75], gridX = Math.max(5, Math.round(width / 48)), gridY = Math.max(5, Math.round(height / 56));
  let best = null;
  for (let w = Math.round(width * .9); w >= width * .3; w -= Math.max(12, Math.round(width / 24))) {
    for (const ratio of ratios) {
      const h = Math.round(w / ratio);
      if (h < height * .16 || h > height * .82) continue;
      for (let y = gridY; y + h < height - gridY; y += gridY) {
        for (let x = gridX; x + w < width - gridX; x += gridX) {
          const candidate = { x, y, w, h }, score = scoreRectangle(candidate, edgeSum, graySum, width, height);
          if (!best || score >.=��h��춻�q�^ument('strong'), meta = document.createElement('p'), button = document.createElement('button'); strong.textContent = child.nombre; meta.textContent = [child.edad ? `${child.edad} años` : child.fechaNacimiento, child.actividad].filter(Boolean).join(' · '); button.className = 'icon-button'; button.type = 'button'; button.textContent = 'Quitar'; button.addEventListener('click', () => { draftChildren.splice(index, 1); renderChildren(); }); copy.append(strong, meta); item.append(copy, button); list.append(item); }); }
function showSave(message, error = false) { $('saveMessage').textContent = message; $('saveMessage').style.color = error ? '#b42318' : '#087a55'; }

async function saveRecord() {
  const tutor = readTutor(); if (!tutor.nombres || !tutor.apellidos) return showSave('Completa nombres y apellidos del tutor.', true); if (!draftChildren.length) return showSave('Agrega al menos un beneficiario.', true);
  await putRecord({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), tutor, children: draftChildren.map(child => ({ ...child })) }); draftChildren = []; renderChildren(); $('tutorForm').reset(); showSave('Registro guardado como texto en este dispositivo.'); discardImage({ keepStatus: true }); status.set('complete', 'Registro guardado y fotografía eliminada de la memoria.'); await renderRecords();
}
async function renderRecords() { const records = (await listRecords()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); $('recordCount').textContent = records.length; const list = $('recordsList'); list.replaceChildren(); if (!records.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No hay registros.'; list.append(empty); return records; } records.forEach(record => { const item = document.createElement('div'); item.className = 'record-item'; const copy = document.createElement('div'), strong = document.createElement('strong'), meta = document.createElement('p'), button = document.createElement('button'); strong.textContent = `${record.tutor.nombres} ${record.tutor.apellidos}`; meta.textContent = `${maskCedula(record.tutor.cedula)} · ${record.children.length} beneficiario(s)`; button.className = 'icon-button'; button.type = 'button'; button.textContent = 'Borrar'; button.addEventListener('click', async () => { await deleteRecord(record.id); await renderRecords(); }); copy.append(strong, meta); item.append(copy, button); list.append(item); }); return records; }

async function createDebugPackage() {
  if (!currentResult || !normalizedCanvas) return status.set('recoverable', 'Realiza una lectura en modo laboratorio antes de generar el paquete.'); if (!confirm('La imagen normalizada contiene información personal. ¿Deseas crear y compartir o descargar el paquete técnico ahora?')) return;
  const quality = imageQuality(normalizedCanvas), corrected = readTutor(), report = buildTechnicalReport({ result: currentResult, corrected, quality, corners: editor.getCorners(), input: inputMeta, note: $('debugNote').value }); const outcome = await exportDebugPackage({ normalized: normalizedCanvas, result: currentResult, report }); status.set('complete', outcome === 'shared' ? 'Paquete técnico compartido.' : outcome === 'downloaded' ? 'Paquete técnico descargado.' : 'Compartir paquete cancelado.');
}

function bindEvents() {
  $('cameraBtn').addEventListener('click', () => $('cameraInput').click()); $('galleryBtn').addEventListener('click', () => $('galleryInput').click());
  $('cameraInput').addEventListener('change', event => { loadImage(event.target.files[0], 'camera'); event.target.value = ''; }); $('galleryInput').addEventListener('change', event => { loadImage(event.target.files[0], 'gallery'); event.target.value = ''; });
  $('detectBtn').addEventListener('click', runDetection); $('resetCornersBtn').addEventListener('click', () => { editor.reset(); manualCalibration = false; $('calibrationBtn').disabled = true; }); $('rotateBtn').addEventListener('click', () => { if (!sourceCanvas) return; const previous = sourceCanvas; sourceCanvas = rotateCanvas(previous); clearCanvas(previous); editor.setSource(sourceCanvas); edgeCanvas = null; resetCalibration(); status.set('correction', 'Imagen girada. Ajusta o vuelve a detectar los bordes.'); });
  $('calibrationBtn').addEventListener('click', shareCalibration);
  $('normalizeBtn').addEventListener('click', normalizeImage); $('readBtn').addEventListener('click', readCard); $('cancelBtn').addEventListener('click', () => { analysisController?.abort(); ocrEngine?.cancel(); }); $('discardImageBtn').addEventListener('click', () => discardImage());
  $('labMode').addEventListener('change', event => { $('modeDescription').textContent = event.target.checked ? 'Laboratorio · más pases, imágenes y métricas' : 'Normal · lectura más rápida'; });
  $('addChildBtn').addEventListener('click', addChild); $('saveRecordBtn').addEventListener('click', saveRecord); $('debugPackageBtn').addEventListener('click', createDebugPackage);
  $('exportCsvBtn').addEventListener('click', async () => { const records = await listRecords(); if (records.length) downloadCsv(records); else showSave('No hay registros para exportar.', true); });
  $('clearRecordsBtn').addEventListener('click', async () => { if (confirm('¿Borrar todos los registros de texto guardados en este dispositivo?')) { await clearRecords(); await renderRecords(); } });
  $('checkUpdateBtn').addEventListener('click', async () => { status.set('preparing', 'Buscando la compilación más reciente…'); if ('serviceWorker' in navigator) for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister(); if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('jcf-')) await caches.delete(key); location.replace(`${location.pathname}?actualizar=${Date.now()}`); });
  window.addEventListener('beforeunload', () => discardImage({ keepStatus: true }));
}

async function boot() { setVersion(); bindEvents(); if ('serviceWorker' in navigator) { const registrations = await navigator.serviceWorker.getRegistrations(); registrations.filter(registration => registration.scope.includes('/jcf-registro/')).forEach(registration => registration.unregister()); } await renderRecords(); status.set('idle', `Versión visible: ${APP_LABEL} · compilación ${BUILD_ID}`); }
boot().catch(error => status.set('recoverable', error.message));
