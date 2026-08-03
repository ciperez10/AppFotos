export const OCR_REGIONS = Object.freeze({
  cedula: { x: .33, y: .14, w: .57, h: .16, label: 'Número de cédula', psm: 7, whitelist: '0123456789-OQDIL|ZSBG ' },
  lugarNacimiento: { x: .29, y: .29, w: .60, h: .13, label: 'Lugar de nacimiento', psm: 6 },
  fechaNacimiento: { x: .29, y: .39, w: .58, h: .11, label: 'Fecha de nacimiento', psm: 6 },
  nacionalidad: { x: .40, y: .48, w: .52, h: .08, label: 'Nacionalidad', psm: 7 },
  sexo: { x: .29, y: .49, w: .25, h: .09, label: 'Sexo', psm: 7, whitelist: 'SEXO: MF' },
  sangre: { x: .47, y: .49, w: .23, h: .09, label: 'Tipo de sangre', psm: 7, whitelist: 'SANGRETIPO ABO+-:' },
  estadoCivil: { x: .62, y: .49, w: .35, h: .10, label: 'Estado civil', psm: 7 },
  ocupacion: { x: .39, y: .57, w: .53, h: .12, label: 'Ocupación', psm: 6 },
  nombres: { x: .045, y: .72, w: .68, h: .12, label: 'Nombres', psm: 6 },
  apellidos: { x: .045, y: .81, w: .72, h: .14, label: 'Apellidos', psm: 6 }
});

export function cropRegion(canvas, region, mode = 'gray') {
  const x = Math.round(region.x * canvas.width), y = Math.round(region.y * canvas.height), width = Math.round(region.w * canvas.width), height = Math.round(region.h * canvas.height);
  const out = document.createElement('canvas'); out.width = Math.max(1, width); out.height = Math.max(1, height); const ctx = out.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height), d = image.data, gray = new Uint8Array(width * height); let mean = 0;
  for (let i = 0; i < gray.length; i += 1) { const value = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114; gray[i] = value; mean += value; }
  mean /= gray.length;
  for (let i = 0; i < gray.length; i += 1) { let value = gray[i]; if (mode === 'binary') value = value > mean * .92 ? 255 : 0; else value = Math.max(0, Math.min(255, (value - mean) * 1.45 + 150)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = value; d[i * 4 + 3] = 255; }
  ctx.putImageData(image, 0, 0); return { canvas: out, coordinates: { x, y, width, height }, mode };
}
