'use strict';

const DEBUG_VERSION_V08 = 'JCF-WEB-OCR-0.8.0';
const readCedulaV07 = readCedula;
document.getElementById('readBtn')?.removeEventListener('click', readCedulaV07);

const OCR_REGIONS_V08 = {
  cedula: {x: .365, y: .165, w: .455, h: .125, label: 'Número de cédula'},
  lugarNacimiento: {x: .305, y: .285, w: .56, h: .105, label: 'Lugar de nacimiento'},
  fecha: {x: .305, y: .375, w: .54, h: .105, label: 'Fecha de nacimiento'},
  sexo: {x: .305, y: .505, w: .22, h: .07, label: 'Sexo'},
  ocupacion: {x: .305, y: .565, w: .52, h: .085, label: 'Ocupación'},
  nombre1: {x: .065, y: .725, w: .45, h: .085, label: 'Nombres'},
  nombre2: {x: .065, y: .795, w: .49, h: .09, label: 'Apellidos'}
};

function editDistanceV08(a, b) {
  a = String(a || ''); b = String(b || '');
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}

function saneWordsV08(value) {
  const words = cleanPersonLineV07(value).split(' ').filter(Boolean);
  if (!words.length) return false;
  return words.every(word => CONNECTORS.has(word) || (word.length >= 3 && /[AEIOU]/.test(word)));
}

function candidateLinesV08(pass, role) {
  const lines = uniqueNameLinesV07(pass?.text || '');
  const out = [];
  for (let index = 0; index < lines.length; index++) {
    const words = lines[index].split(' ').filter(Boolean);
    if (role === 'given') {
      for (let size = 1; size <= Math.min(3, words.length); size++) {
        const value = words.slice(0, size).join(' ');
        if (saneWordsV08(value) && !value.split(' ').some(x => CONNECTORS.has(x))) out.push({value, confidence: pass.confidence || 0, source: pass.id, position: index});
      }
    } else {
      for (let start = 0; start < words.length; start++) {
        for (let size = 1; size <= Math.min(5, words.length - start); size++) {
          const value = words.slice(start, start + size).join(' '), parts = value.split(' ');
          if (!saneWordsV08(value)) continue;
          if (CONNECTORS.has(parts[parts.length - 1])) continue;
          out.push({value, confidence: pass.confidence || 0, source: pass.id, position: index});
        }
      }
    }
  }
  return out;
}

function consensusNameV08(entries, role, given = '') {
  const givenTokens = new Set(cleanPersonLineV07(given).split(' ').filter(Boolean));
  const filtered = entries.filter(entry => {
    const value = cleanPersonLineV07(entry.value);
    if (!value) return false;
    const words = value.split(' ');
    if (role === 'surname') {
      const overlap = words.filter(x => givenTokens.has(x)).length / words.length;
      if (overlap >= .5 || value === given) return false;
    }
    return true;
  }).map(entry => ({...entry, value: cleanPersonLineV07(entry.value)}));
  if (!filtered.length) return {value: '', confidence: 0, source: ''};

  const clusters = [];
  for (const entry of filtered) {
    let cluster = clusters.find(group => editDistanceV08(group.seed, entry.value) <= Math.max(1, Math.floor(Math.max(group.seed.length, entry.value.length) * .10)));
    if (!cluster) { cluster = {seed: entry.value, entries: []}; clusters.push(cluster); }
    cluster.entries.push(entry);
  }

  for (const cluster of clusters) {
    const variants = new Map();
    for (const entry of cluster.entries) {
      const sourceBonus = /completo/.test(entry.source) ? 6 : 3;
      const roleScore = scoreNameCandidateV07(entry.value, role);
      const score = (entry.confidence || 0) + sourceBonus + roleScore;
      variants.set(entry.value, (variants.get(entry.value) || 0) + score);
    }
    cluster.best = [...variants.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
    cluster.score = [...variants.values()].reduce((a, b) => a + b, 0) + cluster.entries.length * 12;
  }
  clusters.sort((a, b) => b.score - a.score || b.best[1] - a.best[1]);
  const winner = clusters[0], exact = winner.entries.filter(x => x.value === winner.best[0]);
  return {value: winner.best[0], confidence: Math.max(...exact.map(x => x.confidence || 0), 0), source: exact.map(x => x.source).join(',')};
}

function normalizeFieldV08(value) {
  return normalizeOCRText(value).replace(/[^A-ZÑ,()\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function textQualityV08(value) {
  const words = normalizeFieldV08(value).replace(/[(),]/g, ' ').split(' ').filter(Boolean);
  if (!words.length) return -100;
  let score = 0;
  for (const word of words) {
    score += Math.min(word.length, 9);
    if (word.length > 2 && /[AEIOU]/.test(word)) score += 5;
    if (word.length > 3 && !/[AEIOU]/.test(word)) score -= 12;
    if (/^(LJI|III|JJJ|LLL|TTT|DII|LOL)$/.test(word)) score -= 15;
  }
  return score;
}

function countryMatchV08(text) {
  const normalized = normalizeFieldV08(text);
  const countries = [...COUNTRY_WORDS].sort((a, b) => b.length - a.length);
  return countries.find(country => normalized.includes(country)) || '';
}

function extractBirthPlaceV08(...texts) {
  const candidates = [];
  for (const raw of texts) {
    const normalized = normalizeOCRText(raw);
    const lines = String(raw || '').split(/\n+/).map(normalizeFieldV08).filter(Boolean);
    const explicit = normalized.match(/LUGAR\s+(?:DE\s+)?NACIMIENTO\s*:?\s*(.*?)(?=FECHA\s+(?:DE\s+)?NACIMIENTO|$)/);
    if (explicit?.[1]) lines.push(normalizeFieldV08(explicit[1]));
    for (const lineRaw of lines) {
      let line = lineRaw.replace(/LUGAR\s+(?:DE\s+)?NACIMIENTO\s*:?/g, ' ').replace(/FECHA\s+(?:DE\s+)?NACIMIENTO.*$/g, ' ').replace(/\s+/g, ' ').trim();
      if (!line || /^(LUGAR|NACIMIENTO|FECHA)$/.test(line)) continue;
      const country = countryMatchV08(line);
      let score = textQualityV08(line) + (country ? 40 : 0);
      if (/NACIONALIDAD|REPUBLICA DOMINICANA/.test(line) && country !== 'REPUBLICA DOMINICANA') score -= 30;
      if (line.split(' ').length < 2) score -= 20;
      candidates.push({line, country, score});
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 18) return '';
  let line = best.line.replace(/^(LUGAR|DE|NACIMIENTO)\s+/g, '').trim();
  if (best.country && line.endsWith(best.country) && line !== best.country) {
    line = `${line.slice(0, -best.country.length).trim().replace(/,$/, '')}, ${best.country}`;
  }
  return line;
}

function extractSexV08(...texts) {
  for (const raw of texts) {
    const text = normalizeOCRText(raw).replace(/[^A-ZÑ:\s]/g, ' ');
    const match = text.match(/SEXO\s*:?\s*([MF])/);
    if (match) return match[1];
  }
  for (const raw of texts) {
    const text = normalizeOCRText(raw).replace(/[^A-ZÑ\s]/g, ' ');
    const single = text.match(/(?:^|\s)([MF])(?:\s|$)/);
    if (single) return single[1];
  }
  return '';
}

function extractOccupationV08(...texts) {
  const candidates = [];
  for (const raw of texts) {
    const normalized = normalizeOCRText(raw);
    const explicit = normalized.match(/OCUPACION\s*:?\s*(.*?)(?=FECHA\s+(?:DE\s+)?EXPIRACION|$)/);
    const sources = [explicit?.[1] || '', ...String(raw || '').split(/\n+/)];
    for (let line of sources) {
      line = normalizeFieldV08(line)
        .replace(/OCUPACION\s*:?/g, ' ')
        .replace(/FECHA\s+(?:DE\s+)?EXPIRACION.*$/g, ' ')
        .replace(/NACIONALIDAD.*$/g, ' ')
        .replace(/SEXO.*$/g, ' ')
        .replace(/ESTADO\s+CIVIL.*$/g, ' ')
        .replace(/\s+/g, ' ').trim();
      if (!line || /^(OCUPACION|FECHA|EXPIRACION)$/.test(line)) continue;
      let score = textQualityV08(line);
      if (/EMPLEAD|COMERCIANTE|EMPRESARI|MEDIC|ABOGAD|ESTUDIANTE|INGENIER|PROFESOR|CONTADOR|CHOFER|AMA DE CASA/.test(line)) score += 35;
      if (/NACIONALIDAD|REPUBLICA|DOMINICANA|SEXO|SANGRE|ESTADO|CIVIL/.test(line)) score -= 45;
      candidates.push({line: line.split(' ').slice(0, 7).join(' '), score});
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 20 ? candidates[0].line : '';
}

function setFieldV08(id, value, review = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.value = value || '';
  element.classList.toggle('field-ok', Boolean(value) && !review);
}

const showDiagnosticBeforeV08 = showDiagnostic;
showDiagnostic = function(card, result, passes, previews, meta) {
  showDiagnosticBeforeV08(card, result, passes, previews, meta);
  const canvas = document.getElementById('diagnosticCanvas'), ctx = canvas?.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(card, 0, 0, canvas.width, canvas.height);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.cedula, result.cedula, !result.cedulaValid);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.lugarNacimiento, result.lugarNacimiento, false);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.fecha, result.fecha, false);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.sexo, result.sexo, false);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.ocupacion, result.ocupacion, false);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.nombre1, result.given, result.nameReview);
    drawDiagnosticRegion(ctx, canvas, OCR_REGIONS_V08.nombre2, result.surname, result.nameReview);
  }
  if (lastDebug?.payload) {
    lastDebug.payload.version = DEBUG_VERSION_V08;
    lastDebug.payload.detected = result;
    lastDebug.payload.regions = OCR_REGIONS_V08;
    lastDebug.pngDataUrl = canvas.toDataURL('image/png');
  }
  const metaEl = document.getElementById('diagnosticMeta');
  if (metaEl && lastDebug?.payload) metaEl.innerHTML = `<span>v0.8.0</span><span>Sesión ${lastDebug.payload.sessionId}</span><span>${meta.totalMs} ms</span><span>${lastDebug.payload.meta.quality?.assessment || 'diagnóstico'}</span>`;
  const textEl = document.getElementById('diagnosticText');
  if (textEl) textEl.textContent = debugText();
};

const buildDebugPayloadBeforeV08 = buildDebugPayload;
buildDebugPayload = function() {
  const payload = buildDebugPayloadBeforeV08();
  if (payload) payload.version = DEBUG_VERSION_V08;
  return payload;
};

readCedula = async function() {
  if (!sourceImage) { setStatus('ocrStatus', 'Primero toma o selecciona una fotografía.', 'warn'); return; }
  const started = performance.now(), sourceWidth = sourceImage.naturalWidth, sourceHeight = sourceImage.naturalHeight;
  const cropRatio = (crop.w / Math.max(1, crop.h)).toFixed(3), rotationUsed = rotation, btn = document.getElementById('readBtn');
  btn.disabled = true; setProgress('ocrProgress', 'ocrBar', 3); setStatus('ocrStatus', 'Leyendo las zonas calibradas de la cédula…');
  let card; const canvases = [], passes = [], previews = [];
  const make = (r, mode) => { const c = regionCanvas(card, r.x, r.y, r.w, r.h, mode); canvases.push(c); return c; };
  const custom = (x, y, w, h, mode) => { const c = regionCanvas(card, x, y, w, h, mode); canvases.push(c); return c; };
  const run = async(id, canvas, params, mode, progress) => { const p = await recognizePass(id, canvas, params, mode); passes.push(p); previews.push(canvasPreview(id, canvas, p)); setProgress('ocrProgress', 'ocrBar', progress); return p; };
  try {
    card = makeCardCanvas(); canvases.push(card);
    const numberGray = make(OCR_REGIONS_V08.cedula, 'gray'), numberBinary = make(OCR_REGIONS_V08.cedula, 'binary'), numberWide = custom(.31, .12, .58, .21, 'gray');
    const givenGray = make(OCR_REGIONS_V08.nombre1, 'gray'), givenBinary = make(OCR_REGIONS_V08.nombre1, 'binary');
    const surnameGray = make(OCR_REGIONS_V08.nombre2, 'gray'), surnameBinary = make(OCR_REGIONS_V08.nombre2, 'binary');
    const namesGray = custom(.055, .71, .52, .19, 'gray'), namesBinary = custom(.055, .71, .52, .19, 'binary');
    const placeBlock = make(OCR_REGIONS_V08.lugarNacimiento, 'gray'), placeValue = custom(.31, .325, .47, .065, 'gray'), placeBinary = custom(.31, .325, .47, .065, 'binary');
    const dateBlock = make(OCR_REGIONS_V08.fecha, 'gray'), dateValue = custom(.31, .415, .42, .07, 'gray'), dateBinary = custom(.31, .415, .42, .07, 'binary');
    const sexRow = make(OCR_REGIONS_V08.sexo, 'gray'), sexWide = custom(.30, .49, .38, .10, 'gray');
    const occupationBlock = make(OCR_REGIONS_V08.ocupacion, 'gray'), occupationValue = custom(.43, .57, .40, .075, 'gray'), occupationBinary = custom(.43, .57, .40, .075, 'binary');

    const digits = '0123456789- OQDILZSBG';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ ';
    const alnum = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ,():- ';
    const pNum1 = await run('numero_estrecho_gris', numberGray, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:digits}, 'gray', 7);
    const pNum2 = await run('numero_estrecho_binario', numberBinary, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:digits}, 'binary', 12);
    const pNum3 = await run('numero_respaldo', numberWide, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:digits}, 'gray', 17);
    const pGiven1 = await run('nombres_gris_v08', givenGray, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters}, 'gray', 23);
    const pGiven2 = await run('nombres_binario_v08', givenBinary, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters}, 'binary', 29);
    const pSur1 = await run('apellidos_gris_v08', surnameGray, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters}, 'gray', 35);
    const pSur2 = await run('apellidos_binario_v08', surnameBinary, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters}, 'binary', 41);
    const pNames1 = await run('nombres_completos_gris_v08', namesGray, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:letters}, 'gray', 47);
    const pNames2 = await run('nombres_completos_binario_v08', namesBinary, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:letters}, 'binary', 53);
    const pPlace1 = await run('lugar_bloque_v08', placeBlock, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:alnum}, 'gray', 59);
    const pPlace2 = await run('lugar_valor_gris_v08', placeValue, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters+', '}, 'gray', 64);
    const pPlace3 = await run('lugar_valor_binario_v08', placeBinary, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters+', '}, 'binary', 69);
    const pDate1 = await run('fecha_bloque_v08', dateBlock, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:alnum}, 'gray', 74);
    const pDate2 = await run('fecha_valor_gris_v08', dateValue, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:alnum}, 'gray', 79);
    const pDate3 = await run('fecha_valor_binario_v08', dateBinary, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:alnum}, 'binary', 84);
    const pSex1 = await run('sexo_fila_v08', sexRow, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'SEXO: MF'}, 'gray', 88);
    const pSex2 = await run('sexo_amplio_v08', sexWide, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:letters+':'}, 'gray', 91);
    const pOcc1 = await run('ocupacion_bloque_v08', occupationBlock, {tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:letters+'():'}, 'gray', 94);
    const pOcc2 = await run('ocupacion_valor_gris_v08', occupationValue, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters+'()'}, 'gray', 97);
    const pOcc3 = await run('ocupacion_valor_binario_v08', occupationBinary, {tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:letters+'()'}, 'binary', 99);

    const cedula = extractCedula(pNum1.text, pNum2.text, pNum3.text);
    const givenEntries = [pGiven1,pGiven2].flatMap(p => candidateLinesV08(p,'given'));
    for (const p of [pNames1,pNames2]) { const lines = uniqueNameLinesV07(p.text); if (lines[0]) givenEntries.push(...candidateLinesV08({...p,text:lines[0]},'given')); }
    const givenPick = consensusNameV08(givenEntries,'given');
    const surnameEntries = [pSur1,pSur2].flatMap(p => candidateLinesV08(p,'surname'));
    for (const p of [pNames1,pNames2]) { const lines = uniqueNameLinesV07(p.text); for (const line of lines.slice(1)) surnameEntries.push(...candidateLinesV08({...p,text:line},'surname')); }
    const surnamePick = consensusNameV08(surnameEntries,'surname',givenPick.value);
    const given = givenPick.value, surname = surnamePick.value, nombre = combineName(given,surname);
    const fecha = extractBirthDate(pDate1.text,pDate2.text,pDate3.text);
    const lugarNacimiento = extractBirthPlaceV08(pPlace1.text,pPlace2.text,pPlace3.text,pDate1.text);
    const sexo = extractSexV08(pSex1.text,pSex2.text);
    const ocupacion = extractOccupationV08(pOcc1.text,pOcc2.text,pOcc3.text);
    const cedulaValid = validateCedula(cedula), surnameWords = surname.split(' ').filter(Boolean);
    const nameReview = !given || !surname || nombre.split(' ').length < 3 || CONNECTORS.has(surnameWords[surnameWords.length-1]) || surname.split(' ').some(x=>given.split(' ').includes(x));
    const result = {cedula,cedulaValid,given,surname,nombre,fecha,lugarNacimiento,sexo,ocupacion,nameReview,givenPass:givenPick.source,surnamePass:surnamePick.source};

    setFieldV08('cedula',cedula,!cedulaValid); setTutorNamesV07(given,surname,nameReview);
    setFieldV08('fechaNacimientoTutor',fecha); setFieldV08('lugarNacimientoTutor',lugarNacimiento);
    setFieldV08('sexoTutor',sexo); setFieldV08('ocupacionTutor',ocupacion);
    const meta = {totalMs:Math.round(performance.now()-started),sourceWidth,sourceHeight,rotation:rotationUsed,cropRatio,cardWidth:card.width,cardHeight:card.height,displayScale:display.scale,crop:{x:Math.round(crop.x),y:Math.round(crop.y),w:Math.round(crop.w),h:Math.round(crop.h)},calibration:'dominican-id-front-v08'};
    showDiagnostic(card,result,passes,previews,meta); setProgress('ocrProgress','ocrBar',100);
    const warnings=[];
    if(!cedula)warnings.push('no se detectó la cédula');else if(!cedulaValid)warnings.push('la cédula requiere revisión');
    if(!given)warnings.push('faltaron los nombres');if(!surname)warnings.push('faltaron los apellidos');else if(nameReview)warnings.push('revisa nombres y apellidos');
    if(!lugarNacimiento)warnings.push('faltó el lugar de nacimiento');if(!fecha)warnings.push('faltó la fecha');if(!sexo)warnings.push('faltó el sexo');if(!ocupacion)warnings.push('faltó la ocupación');
    setStatus('ocrStatus',warnings.length?`Lectura con observaciones: ${warnings.join('; ')}. Corrige los campos y comparte el informe.`:'Lectura completada. Revisa cada campo antes de guardar.',warnings.length?'warn':'ok');
  } catch(error) {
    console.error(error); setStatus('ocrStatus','No pude completar la lectura. Prueba con la cédula completa, recta y sin reflejos.','error');
  } finally {
    for(const canvas of canvases){if(canvas){canvas.width=1;canvas.height=1;}}
    clearImageMemory(); document.getElementById('editorWrap').style.display='none';
    const camera=document.getElementById('cedulaCamara'),gallery=document.getElementById('cedulaFoto');if(camera)camera.value='';if(gallery)gallery.value='';
    btn.disabled=false; setTimeout(()=>setProgress('ocrProgress','ocrBar',null),1000);
  }
};

document.getElementById('readBtn')?.addEventListener('click',readCedula);
