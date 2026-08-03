import { strToU8, zipSync } from 'fflate';
import { OCR_REGIONS } from '../ocr/regions.js';
import { annotatedCanvas } from './visuals.js';
import { reportAsText } from './report.js';

const canvasBytes = canvas => new Promise((resolve, reject) => canvas.toBlob(async blob => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('No se pudo codificar la imagen.')), 'image/png'));
const download = (blob, name) => { const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); };

export async function exportDebugPackage({ normalized, result, report }) {
  const files = { 'informe.txt': strToU8(reportAsText(report)), 'informe.json': strToU8(JSON.stringify(report, null, 2)), 'imagen-normalizada-marcada.png': await canvasBytes(annotatedCanvas(normalized, result.fields)) };
  for (const [key, region] of Object.entries(OCR_REGIONS)) { const canvas = document.createElement('canvas'), x = Math.round(region.x * normalized.width), y = Math.round(region.y * normalized.height); canvas.width = Math.round(region.w * normalized.width); canvas.height = Math.round(region.h * normalized.height); canvas.getContext('2d').drawImage(normalized, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height); files[`recortes/${key}.png`] = await canvasBytes(canvas); canvas.width = canvas.height = 1; }
  const zipped = zipSync(files, { level: 6 }), file = new File([zipped], `jcf-diagnostico-${Date.now()}.zip`, { type: 'application/zip' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { try { await navigator.share({ title: 'Diagnóstico JCF Registro', text: 'Paquete técnico solicitado por el usuario.', files: [file] }); return 'shared'; } catch (error) { if (error.name === 'AbortError') return 'cancelled'; } }
  download(file, file.name); return 'downloaded';
}
