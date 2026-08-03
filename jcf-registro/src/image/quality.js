export function imageQuality(canvas) {
  const sample = document.createElement('canvas'), width = Math.min(420, canvas.width), height = Math.round(canvas.height * width / canvas.width);
  sample.width = width; sample.height = height; const ctx = sample.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height); let sum = 0, sum2 = 0, lapSum = 0, lap2 = 0, n = 0; const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i += 1) { const y = data[i * 4] * .299 + data[i * 4 + 1] * .587 + data[i * 4 + 2] * .114; lum[i] = y; sum += y; sum2 += y * y; }
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) { const i = y * width + x, l = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width]; lapSum += l; lap2 += l * l; n += 1; }
  const brightness = sum / lum.length, contrast = Math.sqrt(Math.max(0, sum2 / lum.length - brightness ** 2)), sharpness = Math.sqrt(Math.max(0, lap2 / n - (lapSum / n) ** 2));
  const score = Math.round(Math.max(0, Math.min(100, 45 + (contrast - 35) * .7 + (sharpness - 18) * .8 - Math.abs(brightness - 135) * .18)));
  return { brightness: Math.round(brightness), contrast: Math.round(contrast), sharpness: Math.round(sharpness), score, assessment: score >= 72 ? 'Buena' : score >= 48 ? 'Aceptable' : 'Revisar iluminación y enfoque' };
}

export function histogramCanvas(canvas) {
  const bins = new Uint32Array(64), ctx = canvas.getContext('2d', { willReadFrequently: true }), { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 16) bins[Math.min(63, Math.floor((data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114) / 4))] += 1;
  const out = document.createElement('canvas'); out.width = 320; out.height = 130; const o = out.getContext('2d'), max = Math.max(...bins); o.fillStyle = '#f4f7f9'; o.fillRect(0, 0, out.width, out.height); o.fillStyle = '#0AAEF3'; bins.forEach((v, i) => o.fillRect(i * 5, out.height - v / max * 112, 4, v / max * 112)); return out;
}
