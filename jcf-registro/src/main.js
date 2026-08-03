import './style.css';
import './responsive.css';
import { APP_LABEL, BUILD_ID, VERSION } from './version.js';
import { CropEditor } from './ui/crop-editor.js';
import { createStatusController } from './ui/status.js';
import { fillTutor, readTutor } from './ui/form.js';
import { clearCanvas, fileToCanvas, rotateCanvas } from './image/normalize.js';
import { defaultCorners, detectCardEdges } from './image/edge-detection.js';
import { applyCalibration, learnCalibration } from './image/calibration-profile.js';
import { warpPerspective } from './image/perspective.js';
import { histogramCanvas, imageQuality } from './image/quality.js';
import { LocalOcrEngine } from './ocr/worker.js';
import { buildTechnicalReport } from './debug/report.js';
import { exportDebugPackage } from './debug/export.js';
import { buildCalibrationReport, exportCalibration } from './debug/calibration.js';
import { renderLabVisuals, renderPassTable } from './debug/visuals.js';
import { clearRecords, deleteRecord, listRecords, maskCedula, putRecord } from './storage/records.js';
import { downloadCsv } from './storage/csv.js';

const $ = id => document.getElementById(id);
const editorCanvas = $('editorCanvas'), normalizedDisplay = $('normalizedCanvas');
const status = createStatusController({ panel: $('statusPanel'), icon: $('statusIcon'), text: $('statusText'), detail: $('statusDetail') });
let automaticCorners = null, detectorMeta = {}, manualCalibration = false, calibrationLearned = false;
const editor = new CropEditor(editorCanvas, (_, mode, reason) => { $('alignmentMode').textContent = mode === 'automatic' ? 'Alineación automática' : 'Ajuste manual'; if (reason === 'drag') { manualCalibration = true; calibrationLearned = false; $('calibrationBtn').disabled = false; } if (normalizedCanvas) { clearCanvas(normalizedCanvas); normalizedCanvas = null; $('normalizedSection').hidden = true; } });
let sourceCanvas = null, normalizedCanvas = null, edgeCanvas = null, currentResult = null, ocrEngine = null, analysisController = null, draftChildren = [], inputMeta = { source: '', size: 0, type: '' };

function setVersion() { document.title = APP_LABEL; $('appTitle').textContent = APP_LABEL; $('headerVersion').textContent = `v${VERSION}`; $('buildLabel').textContent = `Compilación ${BUILD_ID}`; $('statusVersion').textContent = APP_LABEL; $('footerVersion').textContent = `${APP_LABEL} · compilación ${BUILD_ID}`; }
function copyCanvas(source, target) { target.width = source.width; target.height = source.height; target.getContext('2d').drawImage(source, 0, 0); }
function resetReading() { currentResult = null; $('fieldWarnings').replaceChildren(); $('labSection').hidden = true; }
function resetCalibration() { automaticCorners = null; detectorMeta = {}; manualCalibration = false; calibrationLearned = false; $('calibrationBtn').disabled = true; }

function rememberCalibration() {
  if (calibrationLearned || !manualCalibration || !automaticCorners || !sourceCanvas) return null;
  const profile = learnCalibration(automaticCorners, editor.getCorners(), sourceCanvas.width, sourceCanvas.height, detectorMeta.strategy);
  calibrationLearned = Boolean(profile);
  return profile;
}
function discardImage({ keepStatus = false } = {}) { analysisController?.abort(); ocrEngine?.cancel(); ocrEngine = null; clearCanvas(sourceCanvas); clearCanvas(normalizedCanvas); clearCanvas(edgeCanvas); sourceCanvas = normalizedCanvas = edgeCanvas = null; editor.destroy(); resetCalibration(); $('editorSection').hidden = true; $('normalizedSection').hidden = true; $('labSection').hidden = true; resetReading(); inputMeta = { source: '', size: 0, type: '' }; if (!keepStatus) status.set('idle', `Versión visible: ${APP_LABEL}`); }

async function loadImage(file, source) {
  if (!file) return; discardImage({ keepStatus: true }); status.set('preparing', `${source === 'camera' ? 'Cámara' : 'Fotos'} · ${Math.round(file.size / 1024)} KB`);
  try { sourceCanvas = await fileToCanvas(file); inputMeta = { source, size: file.size, type: file.type }; editor.setSource(sourceCanvas); $('editorSection').hidden = false; $('alignmentMode').textContent = 'Alineación automática'; await runDetection(); }
  catch (error) { status.set('recoverable', error.message); }
}

async function runDetection() {
  if (!sourceCanvas) return; status.set('detecting', 'Máximo 5 segundos; el ajuste manual siempre queda disponible.'); $('detectBtn').disabled = true;
  try { const result = await detectCardEdges(sourceCanvas, { timeoutMs: 5000 }); edgeCanvas = result.edgeCanvas; automaticCorners = result.corners.map(point => ({ ...point })); detectorMeta = { strategy: result.strategy, elapsedMs: result.elapsedMs, threshold: result.threshold, score: result.score }; const calibrated = applyCalibration(result.corners, sourceCanvas.width, sourceCanvas.height, result.strategy); manualCalibration = false; calibrationLearned = false; $('calibrationBtn').disabled = true; editor.setCorners(calibrated.corners, 'automatic', 'detection'); status.set('correction', calibrated.applied ? `Bordes calibrados en ${result.elapsedMs} ms. El aprendizaje local está activo.` : `Bordes sugeridos en ${result.elapsedMs} ms. Corrige las cuatro esquinas si es necesario.`); }
  catch (error) { automaticCorners = null; detectorMeta = { strategy: 'fallback', error: error.message }; manualCalibration = false; $('calibrationBtn').disabled = true; editor.setCorners(defaultCorners(sourceCanvas.width, sourceCanvas.height), 'manual', 'fallback'); status.set('correction', `${error.message} Usa las cuatro esquinas manuales.`); }
  finally { $('detectBtn').disabled = false; }
}

async function shareCalibration() {
  if (!sourceCanvas || !manualCalibration) return status.set('correction', 'Mueve al menos una esquina antes de compartir la calibración.');
  rememberCalibration();
  const report = buildCalibrationReport({ width: sourceCanvas.width, height: sourceCanvas.height, automaticCorners, correctedCorners: editor.getCorners(), detector: detectorMeta });
  const outcome = await exportCalibration(report);
  status.set('correction', outcome === 'shared' ? 'Calibración compartida sin fotografía ni datos personales.' : outcome === 'downloaded' ? 'Calibración descargada como JSON sin fotografía.' : 'Se canceló el envío de la calibración.');
}

async function normalizeImage() {
  if (!sourceCanvas) return; status.set('normalizing', 'Creando una imagen estable de 1586 × 1000 px.'); $('normalizeBtn').disabled = true; const controller = new AbortController();
  try { const learned = rememberCalibration(); normalizedCanvas = await warpPerspective(sourceCanvas, editor.getCorners(), { signal: controller.signal }); copyCanvas(normalizedCanvas, normalizedDisplay); $('normalizedSection').hidden = false; status.set('correction', learned ? `Perspectiva normalizada. Calibración local actualizada con ${learned.samples} ejemplos.` : 'Perspectiva normalizada. Revisa la vista antes de leer.'); $('normalizedSection').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  catch (error) { status.set('recoverable', error.message); }
  finally { $('normalizeBtn').disabled = false; }
}

function renderWarnings(fields) {
  const warnings = $('fieldWarnings'); warnings.replaceChildren(); Object.entries(fields).filter(([, value]) => value.status !== 'correcto').forEach(([key, value]) => { const line = document.createElement('div'); line.textContent = `${key}: ${value.status === 'revisar' ? 'revisar el valor detectado' : 'no detectado; completar manualmente'}`; warnings.append(line); });
}
function renderMetrics(quality, result) { $('qualityGrid').innerHTML = [['Calidad', `${quality.score}/100`], ['Nitidez', quality.sharpness], ['Brillo', quality.brightness], ['Contraste', quality.contrast], ['Tiempo OCR', `${result.totalMs} ms`], ['Campos a revisar', result.incomplete]].map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join(''); }

async function readCard() {
  if (!normalizedCanvas || analysisController) return; analysisController = new AbortController(); const safety = setTimeout(() => analysisController?.abort(), 190000), lab = $('labMode').checked;
  $('readBtn').disabled = true; $('cancelBtn').hidden = false; status.set('loading', 'Tesseract.js se ejecuta localmente; ninguna imagen se envía.');
  ocrEngine = new LocalOcrEngine({ onProgress: progress => { if (progress.type === 'pass') status.set('reading', `Procesando ${progress.id}. Puedes cancelar en cualquier momento.`); else if (progress.status === 'recognizing text') status.set('reading', `OCR ${Math.round((progress.progress || 0) * 100)}% · puedes cancelar.`); } });
  try {
    currentResult = await ocrEngine.read(normalizedCanvas, { lab, signal: analysisController.signal }); fillTutor(currentResult.fields); renderWarnings(currentResult.fields); const quality = imageQuality(normalizedCanvas);
    status.set(currentResult.incomplete ? 'incomplete' : 'complete', currentResult.incomplete ? `${currentResult.incomplete} campos requieren revisión.` : `Todos los campos tienen una lectura utilizable.`);
    if (lab) { $('labSection').hidden = false; renderMetrics(quality, currentResult); const visuals = [{ label: 'Imagen normalizada', canvas: normalizedCanvas }, { label: 'Bordes detectados', canvas: edgeCanvas }, { label: 'Histograma', canvas: histogramCanvas(normalizedCanvas) }, ...currentResult.passes.slice(0, 6).map(pass => ({ label: pass.id, canvas: pass.canvas }))]; renderLabVisuals($('labVisuals'), visuals); renderPassTable($('passTable'), currentResult.passes); }
    $('tutorTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { if (error.name === 'AbortError') status.set('recoverable', 'Análisis cancelado. La imagen sigue disponible para volver a intentarlo.'); else status.set('recoverable', `${error.message} Puedes corregir manualmente o repetir la lectura.`); }
  finally { clearTimeout(safety); await ocrEngine?.terminate(); ocrEngine = null; analysisController = null; $('readBtn').disabled = false; $('cancelBtn').hidden = true; }
}

function addChild() {
  const child = { nombre: $('childName').value.trim(), edad: $('childAge').value, fechaNacimiento: $('childBirthDate').value.trim(), sexo: $('childSex').value, actividad: $('childActivity').value.trim(), relacion: $('childRelationship').value.trim(), consentimiento: $('childConsent').checked };
  if (!child.nombre) return showSave('Escribe el nombre del beneficiario.', true); if (!child.consentimiento) return showSave('Debes confirmar el consentimiento del tutor.', true); draftChildren.push(child); $('childForm').reset(); $('childActivity').value = 'Actividad JCF'; renderChildren(); showSave('Beneficiario agregado.');
}
function renderChildren() { const list = $('childrenDraft'); list.replaceChildren(); if (!draftChildren.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Aún no has agregado beneficiarios.'; list.append(empty); return; } draftChildren.forEach((child, index) => { const item = document.createElement('div'); item.className = 'draft-item'; const copy = document.createElement('div'), strong = document.createElement('strong'), meta = document.createElement('p'), button = document.createElement('button'); strong.textContent = child.nombre; meta.textContent = [child.edad ? `${child.edad} años` : child.fechaNacimiento, child.actividad].filter(Boolean).join(' · '); button.className = 'icon-button'; button.type = 'button'; button.textContent = 'Quitar'; button.addEventListener('click', () => { draftChildren.splice(index, 1); renderChildren(); }); copy.append(strong, meta); item.append(copy, button); list.append(item); }); }
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
