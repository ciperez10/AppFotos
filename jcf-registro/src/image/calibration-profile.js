const STORAGE_KEY = 'jcf-card-calibration-v2';
const APPLY_DISTANCE = .035, MERGE_DISTANCE = .05, MAX_TEMPLATES = 12;

// Ejemplo anónimo inicial. Solo se usa en encuadres geométricamente parecidos.
// Contiene posiciones y desplazamientos normalizados, nunca fotografía ni texto.
const PORTRAIT_RECTANGLE_SEED = {
  samples: 1,
  anchor: [
    { x: .107143, y: .392857 },
    { x: .964286, y: .392857 },
    { x: .964286, y: .858929 },
    { x: .107143, y: .858929 }
  ],
  correction: [
    { x: -.048055, y: -.019472 },
    { x: -.06153, y: -.005163 },
    { x: -.091207, y: -.086498 },
    { x: -.028977, y: -.108755 }
  ]
};

const clamp = (value, maximum) => Math.max(2, Math.min(maximum - 2, value));
const profileKey = (width, height, strategy) => `${height >= width ? 'portrait' : 'landscape'}:${strategy || 'unknown'}`;
const normalized = (corners, width, height) => corners.map(point => ({ x: point.x / width, y: point.y / height }));
const cloneTemplate = template => ({ samples: template.samples, anchor: template.anchor.map(point => ({ ...point })), correction: template.correction.map(point => ({ ...point })) });

function distance(first, second) {
  const sum = first.reduce((total, point, index) => total + (point.x - second[index].x) ** 2 + (point.y - second[index].y) ** 2, 0);
  return Math.sqrt(sum / (first.length * 2));
}

function readProfiles(storage) {
  try { return JSON.parse(storage?.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function initialTemplates(key) {
  return key === 'portrait:rectangle' ? [cloneTemplate(PORTRAIT_RECTANGLE_SEED)] : [];
}

function closestTemplate(templates, anchor) {
  return templates.reduce((best, template, index) => {
    const currentDistance = distance(template.anchor, anchor);
    return !best || currentDistance < best.distance ? { template, index, distance: currentDistance } : best;
  }, null);
}

export function applyCalibration(corners, width, height, strategy, storage = globalThis.localStorage) {
  const unchanged = { corners: (corners || []).map(point => ({ ...point })), applied: false, samples: 0 };
  if (corners?.length !== 4) return unchanged;
  const key = profileKey(width, height, strategy), profiles = readProfiles(storage), templates = profiles[key] || initialTemplates(key);
  const match = closestTemplate(templates, normalized(corners, width, height));
  if (!match || match.distance > APPLY_DISTANCE) return unchanged;
  return {
    corners: corners.map((point, index) => ({
      x: clamp(point.x + match.template.correction[index].x * width, width),
      y: clamp(point.y + match.template.correction[index].y * height, height)
    })),
    applied: true,
    samples: match.template.samples || 1
  };
}

export function learnCalibration(automatic, corrected, width, height, strategy, storage = globalThis.localStorage) {
  if (automatic?.length !== 4 || corrected?.length !== 4 || !storage) return null;
  const key = profileKey(width, height, strategy), profiles = readProfiles(storage), templates = profiles[key] || initialTemplates(key);
  const anchor = normalized(automatic, width, height);
  const observed = corrected.map((point, index) => ({ x: (point.x - automatic[index].x) / width, y: (point.y - automatic[index].y) / height }));
  const match = closestTemplate(templates, anchor);
  let learned;
  if (match && match.distance <= MERGE_DISTANCE) {
    const samples = Math.min((match.template.samples || 0) + 1, 10), previousWeight = samples - 1;
    learned = {
      samples,
      anchor: anchor.map((point, index) => ({
        x: (match.template.anchor[index].x * previousWeight + point.x) / samples,
        y: (match.template.anchor[index].y * previousWeight + point.y) / samples
      })),
      correction: observed.map((point, index) => ({
        x: (match.template.correction[index].x * previousWeight + point.x) / samples,
        y: (match.template.correction[index].y * previousWeight + point.y) / samples
      }))
    };
    templates[match.index] = learned;
  } else {
    learned = { samples: 1, anchor, correction: observed };
    templates.push(learned);
  }
  profiles[key] = templates.slice(-MAX_TEMPLATES);
  try { storage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch { return null; }
  return learned;
}
