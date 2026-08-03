export async function fileToCanvas(file, maxDimension = 2600) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('No se pudo abrir la imagen.')); img.src = url; });
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height); image.src = ''; return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export function rotateCanvas(source) {
  const out = document.createElement('canvas'); out.width = source.height; out.height = source.width; const ctx = out.getContext('2d'); ctx.translate(out.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(source, 0, 0); return out;
}

export function clearCanvas(canvas) { if (!canvas) return; canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); canvas.width = 1; canvas.height = 1; }
