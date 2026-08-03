import { cleanNameCandidate } from './parsers.js';
import { fold } from './validators.js';

const CONNECTORS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);
const distance = (a, b) => { const x = fold(a), y = fold(b), row = Array.from({ length: y.length + 1 }, (_, i) => i); for (let i = 1; i <= x.length; i += 1) { let previous = row[0]; row[0] = i; for (let j = 1; j <= y.length; j += 1) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (x[i - 1] === y[j - 1] ? 0 : 1)); previous = old; } } return row[y.length]; };
const similar = (a, b) => distance(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) * .16));

export function scoreNameCandidate(value, role = 'given', given = '') {
  const clean = cleanNameCandidate(value), words = clean.split(' ').filter(Boolean); if (!words.length) return -999;
  let score = words.reduce((sum, word) => sum + Math.min(10, word.length), 0) + Math.min(20, clean.length / 2);
  if (words.every(word => /[AEIOUÁÉÍÓÚÜ]/i.test(word) || CONNECTORS.has(fold(word)))) score += 16; else score -= 28;
  if (role === 'given') { if (words.length >= 2 && words.length <= 3) score += 24; if (words.length === 1 && words[0].length <= 3) score -= 35; }
  if (role === 'surname') { if (words.some(word => CONNECTORS.has(fold(word)))) score += 9; if (CONNECTORS.has(fold(words.at(-1)))) score -= 80; const givenTokens = new Set(fold(given).split(' ')), overlap = words.filter(word => givenTokens.has(fold(word))).length; if (overlap) score -= overlap * 45; }
  return score;
}

export function nameConsensus(candidates, role = 'given', given = '') {
  const clean = candidates.map(candidate => ({ ...candidate, value: cleanNameCandidate(candidate.value) })).filter(candidate => candidate.value).map(candidate => ({ ...candidate, score: scoreNameCandidate(candidate.value, role, given) }));
  clean.forEach(candidate => { const repeats = clean.filter(other => other !== candidate && similar(candidate.value, other.value)).length; candidate.score += repeats * 28 + (Number(candidate.confidence) || 0) * .22; candidate.repeats = repeats; });
  clean.sort((a, b) => b.score - a.score || b.value.length - a.value.length); const best = clean[0], second = clean[1];
  if (!best || best.score < 5) return { value: '', status: 'no detectado', confidence: 0, algorithm: '', rules: ['Ningún candidato superó las reglas de calidad'], candidates: clean };
  const close = second && Math.abs(best.score - second.score) < 10 && !similar(best.value, second.value);
  return { value: best.value, status: close ? 'revisar' : 'correcto', confidence: Math.round(Math.min(99, Math.max(1, best.score))), algorithm: best.source || 'consenso', rules: ['Se premiaron repeticiones y líneas completas', role === 'surname' ? 'Se evitó repetir tokens de los nombres' : 'Se penalizaron fragmentos cortos y ruido', close ? 'Dos candidatos distintos obtuvieron puntuaciones similares' : null].filter(Boolean), candidates: clean };
}
