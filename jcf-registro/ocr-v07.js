'use strict';

const DEBUG_VERSION_V07 = 'JCF-WEB-OCR-0.7.0';
const readCedulaBaseV06 = readCedula;
document.getElementById('readBtn')?.removeEventListener('click', readCedulaBaseV06);
const OCR_REGIONS_V07 = {
  cedula: {x: .28, y: .09, w: .70, h: .29, label: 'Número de cédula'},
  lugarNacimiento: {x: .245, y: .255, w: .62, h: .105, label: 'Lugar de nacimiento'},
  fecha: {x: .245, y: .335, w: .62, h: .105, label: 'Fecha de nacimiento'},
  sexo: {x: .245, y: .435, w: .25, h: .075, label: 'Sexo'},
  ocupacion: {x: .245, y: .49, w: .66, h: .105, label: 'Ocupación'},
  nombre1: {x: .018, y: .755, w: .70, h: .105, label: 'Nombres'},
  nombre2: {x: .018, y: .835, w: .76, h: .135, label: 'Apellidos'}
};

const COUNTRY_WORDS = new Set([
  'CUBA', 'HAITI', 'VENEZUELA', 'COLOMBIA', 'MEXICO', 'ESPAÑA', 'ESTADOS UNIDOS',
  'REPUBLICA DOMINICANA', 'PUERTO RICO', 'PANAMA', 'HONDURAS', 'NICARAGUA',
  'GUATEMALA', 'ECUADOR', 'PERU', 'CHILE', 'ARGENTINA', 'BRASIL'
]);

function normalizeOCRText(value) {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|_~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPersonLineV07(value) {
  let line = normalizeOCRText(value)
    .replace(/[^A-ZÑ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  line = line
    .replace(/\b([A-ZÑ]{3,})(DEL|DE|LA|LAS|LOS)\b/g, '$1 $2')
    .replace(/\b(PEREZ)(DE)\b/g, '$1 $2');
  const words = line.split(' ').filter(Boolean).filter(word => {
    if (MONTH_SET.has(word) || BANNED_WORDS.has(word)) return false;
    if (word.length === 1) return false;
    return true;
  });
  return words.join(' ');
}

function uniqueNameLinesV07(text) {
  const out = [];
  for (const raw of String(text || '').split(/\n+/)) {
    const line = cleanPersonLineV07(raw);
    if (!line) continue;
    if (!out.some(existing => existing === line)) out.push(line);
  }
  return out;
}

function tokenQualityV07(word) {
  if (CONNECTORS.has(word)) return 3;
  let score = Math.min(word.length, 10);
  if (!/[AEIOU]/.test(word)) score -= 7;
  if (!/[BCDFGHJKLMNÑPQRSTVWXYZ]/.test(word)) score -= 5;
  if (/^(AA|EE|II|OO|UU)/.test(word)) score -= 3;
  return score;
}

function scoreNameCandidateV07(value, role) {
  const words = cleanPersonLineV07(value).split(' ').filter(Boolean);
  if (!words.length) return -999;
  let score = words.reduce((sum, word) => sum + tokenQualityV07(word), 0);
  if (role === 'given') {
    score += words.length >= 1 && words.length <= 3 ? 18 : -Math.abs(words.length - 2) * 8;
    if (words.some(word => CONNECTORS.has(word))) score -= 8;
  } else {
    score += words.length >= 1 && words.length <= 5 ? 12 : -Math.abs(words.length - 3) * 6;
    if (words.some(word => CONNECTORS.has(word))) score += 6;
  }
  return score;
}

function pickGivenV07(givenPasses, combinedPasses) {
  const candidates = [];
  const add = (value, confidence, source, priority = 0) => {
    value = cleanPersonLineV07(value);
    if (!value) return;
    const words = value.split(' ');
    for (let size = 1; size <= Math.min(3, words.length); size++) {
      for (let i = 0; i <= words.length - size; i++) {
        const candidate = words.slice(i, i + size).join(' ');
        candidates.push({value: candidate, score: scoreNameCandidateV07(candidate, 'given') + priority + (confidence || 0) / 15, source});
      }
    }
  };
  for (const pass of givenPasses) uniqueNameLinesV07(pass.text).forEach(line => add(line, pass.confidence, pass.id, 14));
  for (const pass of combinedPasses) {
    const lines = uniqueNameLinesV07(pass.text);
    if (lines[0]) add(lines[0], pass.confidence, pass.id, 10);
  }
  candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
  return candidates[0] || {value: '', score: 0, source: ''};
}

function pickSurnameV07(surnamePasses, combinedPasses, given) {
  const candidates = [];
  const add = (value, confidence, source, priority = 0) => {
    value = cleanPersonLineV07(value);
    if (!value || value === given) return;
    const words = value.split(' ');
    for (let size = 1; size <= Math.min(5, words.length); size++) {
      for (let i = 0; i <= words.length - size; i++) {
        const candidate = words.slice(i, i + size).join(' ');
        if (candidate === given) continue;
        candidates.push({value: candidate, score: scoreNameCandidateV07(candidate, 'surname') + priority + (confidence || 0) / 15, source});
      }
    }
  };
  for (const pass of surnamePasses) uniqueNameLinesV07(pass.text).forEach(line => add(line, pass.confidence, pass.id, 18));
  for (const pass of combinedPasses) {
    const lines = uniqueNameLinesV07(pass.text);
    lines.slice(1).forEach(line => add(line, pass.confidence, pass.id, 10));
    if (lines.length === 1 && lines[0] !== given) add(lines[0], pass.confidence, pass.id, 4);
  }
  candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
  return candidates[0] || {value: '', score: 0, source: ''};
}

function extractBirthPlaceV07(...texts) {
  for (const raw of texts) {
    const lines = String(raw || '').split(/\n+/).map(normalizeOCRText).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].replace(/LUGAR\s+(DE\s+)?NACIMIENTO\s*:?/g, '').trim();
      if (!line && lines[i + 1]) line = lines[i + 1];
      line = line.replace(/FECHA\s+(DE\s+)?NACIMIENTO.*$/g, '').trim();
      if (!line || /LUGAR|FECHA|NACIMIENTO|NACIONALIDAD/.test(line)) continue;
      const words = line.replace(/[^A-ZÑ\s,]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      if (words.length < 2) continue;
      const normalized = words.join(' ');
      let result = normalized;
      for (const country of COUNTRY_WORDS) {
        if (normalized.endsWith(country) && normalized !== country) {
          result = normalized.slice(0, -country.length).trim().replace(/,$/, '') + ', ' + country;
          break;
        }
      }
      return result;
    }
  }
  return '';
}

function extractSexV07(...texts) {
  for (const raw of texts) {
    const text = normalizeOCRText(raw).replace(/[^A-ZÑ:\s]/g, ' ');
    const explicit = text.match(/SEXO\s*:?\s*([MF])/);
    if (explicit) return explicit[1];
    const single = text.match(/(?:^|\s)([MF])(?:\s|$)/);
    if (single) return single[1];
  }
  return '';
}

function extractOccupationV07(...texts) {
  for (const raw of texts) {
    let text = normalizeOCRText(raw)
      .replace(/OCUPACION\s*:?/g, ' ')
      .replace(/FECHA\s+(DE\s+)?EXPIRACION.*$/g, ' ')
      .replace(/[^A-ZÑ()\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || /^(OCUPACION|FECHA|EXPIRACION)$/.test(text)) continue;
    const words = text.split(' ').filter(word => !['OCUPACION', 'FECHA', 'EXPIRACION'].includes(word));
    if (words.length) return words.slice(0, 6).join(' ');
  }
  return '';
}

function setTutorNamesV07(given, surname, review) {
  const givenInput = document.getElementById('nombresTutor');
  const surnameInput = document.getElementById('apellidosTutor');
  const fullInput = document.getElementById('nombreTutor');
  if (givenInput) {
    if (given) givenInput.value = given;
    givenInput.classList.toggle('field-ok', Boolean(given) && !review);
  }
  if (surnameInput) {
    if (surname) surnameInput.value = surname;
    surnameInput.classList.toggle('field-ok', Boolean(surname) && !review);
  }
  if (fullInput) fullInput.value = combineName(givenInput?.value || given, surnameInput?.value || surname);
}

function syncTutorFullNameV07() {
  const given = document.getElementById('nombresTutor')?.value.trim() || '';
  const surname = document.getElementById('apellidosTutor')?.value.trim() || '';
  const full = document.getElementById('nombreTutor');
  if (full) full.value = combineName(given, surname);
}

document.getElementById('nombresTutor')?.addEventListener('input', syncTutorFullNameV07);
document.getElementById('apellidosTutor')?.addEventListener('input', syncTutorFullNameV07);

const showDiagnosticBaseV07 = showDiagnostic;
showDiagnostic = function(card, result, passes, previews, meta) {
  showDiagnosticBaseV07(card, result, passes, previews, meta);
  const canvas = document.getElementById('diagnosticCanvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V07.lugarNacimiento, result.lugarNacimiento, false);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V07.sexo, result.sexo, false);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V07.ocupacion, result.ocupacion, false);
  }
  if (lastDebug?.payload) {
    lastDebug.payload.version = DEBUG_VERSION_V07;
    lastDebug.payload.detected = result;
    lastDebug.payload.regions = OCR_REGIONS_V07;
    lastDebug.pngDataUrl = canvas.toDataURL('image/png');
  }
};

currentCorrected = function() {
  syncTutorFullNameV07();
  return {
    cedula: document.getElementById('cedula')?.value.trim() || '',
    nombres: document.getElementById('nombresTutor')?.value.trim().toUpperCase() || '',
    apellidos: document.getElementById('apellidosTutor')?.value.trim().toUpperCase() || '',
    nombre: document.getElementById('nombreTutor')?.value.trim().toUpperCase() || '',
    fecha: document.getElementById('fechaNacimientoTutor')?.value.trim().toUpperCase() || '',
    lugarNacimiento: document.getElementById('lugarNacimientoTutor')?.value.trim().toUpperCase() || '',
    sexo: document.getElementById('sexoTutor')?.value || '',
    ocupacion: document.getElementById('ocupacionTutor')?.value.trim().toUpperCase() || ''
  };
};

buildDebugPayload = function() {
  if (!lastDebug) return null;
  const payload = JSON.parse(JSON.stringify(lastDebug.payload));
  payload.version = DEBUG_VERSION_V07;
  const corrected = currentCorrected();
  payload.corrected = corrected;
  payload.differences = {
    cedula: payload.detected.cedula !== corrected.cedula,
    nombres: payload.detected.given !== corrected.nombres,
    apellidos: payload.detected.surname !== corrected.apellidos,
    fecha: payload.detected.fecha !== corrected.fecha,
    lugarNacimiento: payload.detected.lugarNacimiento !== corrected.lugarNacimiento,
    sexo: payload.detected.sexo !== corrected.sexo,
    ocupacion: payload.detected.ocupacion !== corrected.ocupacion
  };
  return payload;
};

debugText = function() {
  const p = buildDebugPayload();
  if (!p) return '';
  return [
    'JCF REGISTRO · INFORME OCR',
    `Versión: ${p.version}`,
    `Sesión: ${p.sessionId}`,
    `Fecha: ${p.createdAt}`,
    '',
    'DETECTADO',
    `Cédula: ${p.detected.cedula || 'NO DETECTADA'} · verificación ${p.detected.cedulaValid ? 'válida' : 'revisar'}`,
    `Nombres: ${p.detected.given || 'NO DETECTADOS'}`,
    `Apellidos: ${p.detected.surname || 'NO DETECTADOS'}`,
    `Nacimiento: ${p.detected.fecha || 'NO DETECTADA'}`,
    `Lugar de nacimiento: ${p.detected.lugarNacimiento || 'NO DETECTADO'}`,
    `Sexo: ${p.detected.sexo || 'NO DETECTADO'}`,
    `Ocupación: ${p.detected.ocupacion || 'NO DETECTADA'}`,
    '',
    'CORREGIDO POR EL USUARIO',
    `Cédula: ${p.corrected.cedula || '—'}`,
    `Nombres: ${p.corrected.nombres || '—'}`,
    `Apellidos: ${p.corrected.apellidos || '—'}`,
    `Nacimiento: ${p.corrected.fecha || '—'}`,
    `Lugar de nacimiento: ${p.corrected.lugarNacimiento || '—'}`,
    `Sexo: ${p.corrected.sexo || '—'}`,
    `Ocupación: ${p.corrected.ocupacion || '—'}`,
    '',
    `DIFERENCIAS: ${JSON.stringify(p.differences)}`,
    '',
    `META: ${JSON.stringify(p.meta)}`,
    '',
    ...p.passes.map(x => `[${x.id}] conf=${x.confidence ?? '—'}% ${x.ms}ms ${x.width}x${x.height}\n${x.text || '—'}`)
  ].join('\n');
};

readCedula = async function() {
  if (!sourceImage) {
    setStatus('ocrStatus', 'Primero toma o selecciona una fotografía.', 'warn');
    return;
  }
  const started = performance.now();
  const sourceWidth = sourceImage.naturalWidth;
  const sourceHeight = sourceImage.naturalHeight;
  const cropRatio = (crop.w / Math.max(1, crop.h)).toFixed(3);
  const rotationUsed = rotation;
  const btn = document.getElementById('readBtn');
  btn.disabled = true;
  setProgress('ocrProgress', 'ocrBar', 3);
  setStatus('ocrStatus', 'Preparando la imagen y sus zonas…');

  let card;
  const canvases = [];
  const passes = [];
  const previews = [];
  const make = (rx, ry, rw, rh, mode) => {
    const canvas = regionCanvas(card, rx, ry, rw, rh, mode);
    canvases.push(canvas);
    return canvas;
  };
  const run = async(id, canvas, params, mode, progress) => {
    const pass = await recognizePass(id, canvas, params, mode);
    passes.push(pass);
    previews.push(canvasPreview(id, canvas, pass));
    setProgress('ocrProgress', 'ocrBar', progress);
    return pass;
  };

  try {
    card = makeCardCanvas();
    canvases.push(card);

    const numberGray = make(.29, .10, .68, .27, 'gray');
    const numberBinary = make(.29, .10, .68, .27, 'binary');
    const numberWide = make(.22, .07, .76, .32, 'gray');

    const givenGray = make(.015, .748, .72, .125, 'gray');
    const givenBinary = make(.015, .748, .72, .125, 'binary');
    const surnameGray = make(.015, .825, .78, .16, 'gray');
    const surnameBinary = make(.015, .825, .78, .16, 'binary');
    const nameCombinedGray = make(.008, .73, .80, .265, 'gray');
    const nameCombinedBinary = make(.008, .73, .80, .265, 'binary');

    const placeGray = make(.24, .245, .64, .125, 'gray');
    const placeBinary = make(.24, .245, .64, .125, 'binary');
    const dateGray = make(.24, .325, .64, .13, 'gray');
    const dateBinary = make(.24, .325, .64, .13, 'binary');
    const sexGray = make(.245, .425, .30, .09, 'gray');
    const occupationGray = make(.24, .475, .70, .135, 'gray');
    const occupationBinary = make(.24, .475, .70, .135, 'binary');

    const number1 = await run('numero_gris', numberGray, {tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789- OQDILZSBG'}, 'gray', 8);
    const number2 = await run('numero_binario', numberBinary, {tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789- OQDILZSBG'}, 'binary', 14);
    const number3 = await run('numero_amplio', numberWide, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '0123456789- OQDILZSBG'}, 'gray', 20);

    const given1 = await run('nombres_gris', givenGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'gray', 27);
    const given2 = await run('nombres_binario', givenBinary, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'binary', 34);
    const surname1 = await run('apellidos_gris', surnameGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'gray', 41);
    const surname2 = await run('apellidos_binario', surnameBinary, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'binary', 48);
    const combined1 = await run('nombre_completo_gris', nameCombinedGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'gray', 54);
    const combined2 = await run('nombre_completo_binario', nameCombinedBinary, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'binary', 60);

    const place1 = await run('lugar_nacimiento_gris', placeGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ, '}, 'gray', 66);
    const place2 = await run('lugar_nacimiento_binario', placeBinary, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ, '}, 'binary', 71);
    const date1 = await run('fecha_gris', dateGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'gray', 77);
    const date2 = await run('fecha_binaria', dateBinary, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '}, 'binary', 82);
    const sex1 = await run('sexo_gris', sexGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ: '}, 'gray', 87);
    const occupation1 = await run('ocupacion_gris', occupationGray, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ() '}, 'gray', 92);
    const occupation2 = await run('ocupacion_binaria', occupationBinary, {tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ() '}, 'binary', 96);

    const cedula = extractCedula(number1.text, number2.text, number3.text);
    const givenPick = pickGivenV07([given1, given2], [combined1, combined2]);
    const surnamePick = pickSurnameV07([surname1, surname2], [combined1, combined2], givenPick.value);
    let given = givenPick.value;
    let surname = surnamePick.value;
    if (surname === given) surname = '';
    const nombre = combineName(given, surname);
    const fecha = extractBirthDate(date1.text, date2.text);
    const lugarNacimiento = extractBirthPlaceV07(place1.text, place2.text);
    const sexo = extractSexV07(sex1.text);
    const ocupacion = extractOccupationV07(occupation1.text, occupation2.text);
    const cedulaValid = validateCedula(cedula);
    const surnameWords = surname.split(' ').filter(Boolean);
    const nameReview = !given || !surname || surname === given || nombre.split(' ').length < 3 || CONNECTORS.has(surnameWords[surnameWords.length - 1]);

    const result = {
      cedula,
      cedulaValid,
      given,
      surname,
      nombre,
      fecha,
      lugarNacimiento,
      sexo,
      ocupacion,
      nameReview,
      givenPass: givenPick.source,
      surnamePass: surnamePick.source
    };

    const setField = (id, value, review = false) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (value) element.value = value;
      element.classList.toggle('field-ok', Boolean(value) && !review);
    };
    setField('cedula', cedula, !cedulaValid);
    setTutorNamesV07(given, surname, nameReview);
    setField('fechaNacimientoTutor', fecha);
    setField('lugarNacimientoTutor', lugarNacimiento);
    setField('sexoTutor', sexo);
    setField('ocupacionTutor', ocupacion);

    const meta = {
      totalMs: Math.round(performance.now() - started),
      sourceWidth,
      sourceHeight,
      rotation: rotationUsed,
      cropRatio,
      cardWidth: card.width,
      cardHeight: card.height,
      displayScale: display.scale,
      crop: {x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h)}
    };

    showDiagnostic(card, result, passes, previews, meta);
    setProgress('ocrProgress', 'ocrBar', 100);

    const warnings = [];
    if (!cedula) warnings.push('no se detectó la cédula');
    else if (!cedulaValid) warnings.push('la cédula requiere revisión');
    if (!given) warnings.push('faltaron los nombres');
    if (!surname) warnings.push('faltaron los apellidos');
    if (!fecha) warnings.push('faltó la fecha');
    if (!lugarNacimiento) warnings.push('faltó el lugar de nacimiento');
    if (!sexo) warnings.push('faltó el sexo');
    if (!ocupacion) warnings.push('faltó la ocupación');

    if (!warnings.length) {
      setStatus('ocrStatus', 'Lectura completada. Revisa cada campo y comparte el paquete de depuración si algo salió mal.');
    } else {
      setStatus('ocrStatus', `Lectura con observaciones: ${warnings.join('; ')}. Corrige los campos y comparte el informe.`, 'warn');
    }
  } catch (error) {
    console.error(error);
    setStatus('ocrStatus', 'No pude completar la lectura. Prueba con la cédula ocupando casi todo el recuadro y sin reflejos.', 'error');
  } finally {
    for (const canvas of canvases) {
      if (canvas) { canvas.width = 1; canvas.height = 1; }
    }
    clearImageMemory();
    document.getElementById('editorWrap').style.display = 'none';
    const camera = document.getElementById('cedulaCamara');
    const gallery = document.getElementById('cedulaFoto');
    if (camera) camera.value = '';
    if (gallery) gallery.value = '';
    btn.disabled = false;
    setTimeout(() => setProgress('ocrProgress', 'ocrBar', null), 1000);
  }
};

document.getElementById('readBtn')?.addEventListener('click', readCedula);
