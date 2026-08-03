import { createWorker, OEM } from 'tesseract.js';
import { nameConsensus } from './consensus.js';
import { parseBirthDate, parseBirthPlace, parseBlood, parseCedula, parseCivil, parseNationality, parseOccupation, parseSex } from './parsers.js';
import { OCR_REGIONS, cropRegion } from './regions.js';

const PARSERS = { cedula: parseCedula, lugarNacimiento: parseBirthPlace, fechaNacimiento: parseBirthDate, nacionalidad: parseNationality, sexo: parseSex, sangre: parseBlood, estadoCivil: parseCivil, ocupacion: parseOccupation };
const timeout = (ms, message) => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(message), { code: 'TIMEOUT' })), ms));

export class LocalOcrEngine {
  constructor({ onProgress = () => {}, passTimeoutMs = 22000 } = {}) { this.onProgress = onProgress; this.passTimeoutMs = passTimeoutMs; this.worker = null; this.cancelled = false; this.cancelWorkerCreation = null; }
  async ensureWorker(signal) {
    if (this.worker) return this.worker; if (signal?.aborted || this.cancelled) throw new DOMException('Análisis cancelado', 'AbortError');
    const creation = createWorker('spa', OEM.LSTM_ONLY, { logger: message => this.onProgress({ type: 'worker', ...message }) });
    let abortListener;
    const cancellation = new Promise((_, reject) => {
      const rejectCancellation = () => reject(new DOMException('Análisis cancelado', 'AbortError'));
      this.cancelWorkerCreation = rejectCancellation; abortListener = rejectCancellation; signal?.addEventListener('abort', abortListener, { once: true });
    });
    try {
      const created = await Promise.race([creation, timeout(35000, 'El lector OCR no terminó de cargar.'), cancellation]);
      if (signal?.aborted || this.cancelled) { await created.terminate(); throw new DOMException('Análisis cancelado', 'AbortError'); }
      this.worker = created; return created;
    } catch (error) {
      creation.then(created => created.terminate()).catch(() => {}); throw error;
    } finally {
      if (abortListener) signal?.removeEventListener('abort', abortListener); this.cancelWorkerCreation = null;
    }
  }
  async terminate() { const worker = this.worker; this.worker = null; if (worker) { try { await worker.terminate(); } catch { /* Worker already stopped. */ } } }
  async cancel() { this.cancelled = true; this.cancelWorkerCreation?.(); await this.terminate(); }
  async pass(id, regionKey, crop, config, signal) {
    if (signal?.aborted || this.cancelled) throw new DOMException('Análisis cancelado', 'AbortError'); const started = performance.now();
    try {
      const worker = await this.ensureWorker(signal); await worker.setParameters({ tessedit_pageseg_mode: String(config.psm || 6), preserve_interword_spaces: '1', ...(config.whitelist ? { tessedit_char_whitelist: config.whitelist } : {}) });
      const result = await Promise.race([worker.recognize(crop.canvas), timeout(this.passTimeoutMs, `El pase ${id} agotó su tiempo.`)]);
      return { id, region: regionKey, mode: crop.mode, coordinates: crop.coordinates, text: String(result.data.text || '').trim(), confidence: Math.round(result.data.confidence || 0), ms: Math.round(performance.now() - started), algorithm: `Tesseract PSM ${config.psm || 6} · ${crop.mode}`, status: 'ok', canvas: crop.canvas };
    } catch (error) {
      if (error.code === 'TIMEOUT') { await this.terminate(); return { id, region: regionKey, mode: crop.mode, coordinates: crop.coordinates, text: '', confidence: 0, ms: Math.round(performance.now() - started), algorithm: `Tesseract PSM ${config.psm || 6} · ${crop.mode}`, status: 'timeout', error: error.message, canvas: crop.canvas }; }
      if (signal?.aborted || this.cancelled || error.name === 'AbortError') throw new DOMException('Análisis cancelado', 'AbortError');
      await this.terminate(); return { id, region: regionKey, mode: crop.mode, coordinates: crop.coordinates, text: '', confidence: 0, ms: Math.round(performance.now() - started), algorithm: `Tesseract PSM ${config.psm || 6} · ${crop.mode}`, status: 'error', error: error.message, canvas: crop.canvas };
    }
  }
  async read(normalizedCanvas, { lab = false, signal } = {}) {
    this.cancelled = false; const started = performance.now(), passes = [], modes = lab ? ['gray', 'binary'] : ['gray'];
    for (const [regionKey, config] of Object.entries(OCR_REGIONS)) {
      const regionModes = (!lab && ['nombres', 'apellidos'].includes(regionKey)) ? ['gray', 'binary'] : modes;
      for (const mode of regionModes) {
        if (signal?.aborted) throw new DOMException('Análisis cancelado', 'AbortError'); const crop = cropRegion(normalizedCanvas, config, mode), id = `${regionKey}_${mode}`;
        this.onProgress({ type: 'pass', id, completed: passes.length, total: Object.keys(OCR_REGIONS).length * modes.length }); passes.push(await this.pass(id, regionKey, crop, config, signal));
      }
    }
    const fields = {};
    for (const [key, parser] of Object.entries(PARSERS)) {
      const relevant = passes.filter(pass => pass.region === key), raw = relevant.map(pass => pass.text).filter(Boolean).join('\n'), parsed = parser(raw), winner = relevant.sort((a, b) => b.confidence - a.confidence)[0];
      fields[key] = { ...parsed, raw, confidence: winner?.confidence || 0, timeMs: relevant.reduce((sum, pass) => sum + pass.ms, 0), algorithm: winner?.algorithm || 'Sin resultado' };
    }
    const names = nameConsensus(passes.filter(pass => pass.region === 'nombres').map(pass => ({ value: pass.text, confidence: pass.confidence, source: pass.algorithm })), 'given');
    const surnames = nameConsensus(passes.filter(pass => pass.region === 'apellidos').map(pass => ({ value: pass.text, confidence: pass.confidence, source: pass.algorithm })), 'surname', names.value);
    fields.nombres = { ...names, raw: passes.filter(pass => pass.region === 'nombres').map(pass => pass.text).join('\n'), timeMs: passes.filter(pass => pass.region === 'nombres').reduce((sum, pass) => sum + pass.ms, 0) };
    fields.apellidos = { ...surnames, raw: passes.filter(pass => pass.region === 'apellidos').map(pass => pass.text).join('\n'), timeMs: passes.filter(pass => pass.region === 'apellidos').reduce((sum, pass) => sum + pass.ms, 0) };
    const incomplete = Object.values(fields).filter(fieldValue => fieldValue.status !== 'correcto').length; await this.terminate();
    return { fields, passes, totalMs: Math.round(performance.now() - started), incomplete };
  }
}
