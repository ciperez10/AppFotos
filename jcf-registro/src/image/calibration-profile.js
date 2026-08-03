const STORAGE_KEY = 'jcf-card-calibration-v1';

// Punto de partida anónimo obtenido de una corrección real en formato vertical.
// Solo son desplazamientos normalizados; no contienen fotografías ni texto de la cédula.
const PORTRAIT_RECTANGLE_SEED = {
  samples: 1,
  correction: [
    { x: -.048055, y: -.019472 },
    { x: -.06153, y: -.005163 },
    { x: -.091207, y: -.086498 },
    { x: -.028977, y: -.108755 }
  ]
};

const clamp = (value, maximum) => Math.max(2, Math.min(maximum - 2, value));
const profileKey = (width, height, strategy) => `${height >= width ? 'portrait' : 'landscape'}:${strategy || 'unknown'}`;

function readProfiles(storage) {
  try { return JSON.parse(storage?.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function initialProfile(key) {
  return key === 'portrait:rectangle' ? PORTRAIT_RECTANGLE_SEED : null;
}

export function applyCalibration(corners, width, height, strategy, storage = globalThis.localStorage) {
  const key = profileKey(width, height, strategy), profiles = readProfiles(storage), profile = profiles[key] || initialProfile(key);
  if (!profile?.correction?.length || corners?.length !== 4) return { corners: corners.map(point => ({ ...point })), applied: false, samples: 0 };
  return {
    corners: corners.map((point, index) => ({
      x: clamp(point.x + profile.correction[index].x * width, width),
      y: clamp(point.y + profile.correction[index].y * height, height)
    })),
    applied: true,
    samples: profile.samples || 1
  };
}

export function learnCalibration(automatic, corrected, width, height, strategy, storage = globalThis.localStorage) {
  if (automatic?.length !== 4 || corrected?.length !== 4 || !storage) return null;
  const key = profileKey(width, height, strategy), profiles = readProfiles(storage), previous = profiles[key] || initialProfile(key);
  const observed = corrected.map((point, index) => ({ x: (point.x - automatic[index].x) / width, y: (point.y - automatic[index].y) / height }));
  const samples = Math.min((previous?.samples || 0) + 1, 10), previousWeight = samples - 1;
  const correction = observed.map((point, index) => ({
    x: ((previous?.correction?.[index]?.x || 0) * previousWeight + point.x) / samples,
    y: ((previous?.correction?.[index]?.y || 0) * previousWeight + point.y) / samples
  }));
  profiles[key] = { samples, correction };
  try { storage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch { return null; }
  return profiles[key];
}
