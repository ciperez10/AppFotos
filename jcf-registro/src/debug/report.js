import { APP_LABEL, BUILD_ID, VERSION } from '../version.js';
import { fieldDifferences } from '../ui/form.js';

export function buildTechnicalReport({ result, corrected, quality, corners, input, note }) {
  const detected = Object.fromEntries(Object.entries(result.fields).map(([key, value]) => [key, { value: value.value, status: value.status, confidence: value.confidence, timeMs: value.timeMs, algorithm: value.algorithm, raw: value.raw, rules: value.rules }]));
  return { product: APP_LABEL, version: VERSION, build: BUILD_ID, createdAt: new Date().toISOString(), browser: navigator.userAgent, language: navigator.language, totalTimeMs: result.totalMs, quality, corners, input: { source: input.source, size: input.size, type: input.type }, detected, corrected: { nombres: corrected.nombres, apellidos: corrected.apellidos, cedula: corrected.cedula, lugarNacimiento: corrected.lugarNacimiento, fechaNacimiento: corrected.fechaNacimiento, nacionalidad: corrected.nacionalidad, sexo: corrected.sexo, tipoSangre: corrected.tipoSangre, estadoCivil: corrected.estadoCivil, ocupacion: corrected.ocupacion }, differences: fieldDifferences(result.fields, corrected), note: String(note || '').trim(), passes: result.passes.map(({ canvas, ...pass }) => pass), privacy: 'No incluye teléfono, comunidad, beneficiarios ni otros registros.' };
}

export function reportAsText(report) {
  const lines = [`${report.product} · INFORME TÉCNICO`, `Versión: ${report.version}`, `Compilación: ${report.build}`, `Fecha: ${report.createdAt}`, `Navegador: ${report.browser}`, `Tiempo total: ${report.totalTimeMs} ms`, `Calidad: ${report.quality.assessment} (${report.quality.score}/100)`, '', 'DETECTADO'];
  Object.entries(report.detected).forEach(([key, value]) => lines.push(`${key}: ${value.value || 'NO DETECTADO'} · ${value.status} · ${value.confidence || 0}% · ${value.algorithm}`));
  lines.push('', 'CORREGIDO', ...Object.entries(report.corrected).map(([key, value]) => `${key}: ${value || '—'}`), '', `DIFERENCIAS: ${JSON.stringify(report.differences)}`, '', `COORDENADAS: ${JSON.stringify(report.corners)}`, '', `NOTA: ${report.note || '—'}`, '', report.privacy); return lines.join('\n');
}
