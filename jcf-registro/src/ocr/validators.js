export const MONTHS = Object.freeze({ ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 });
export const BLOOD_TYPES = Object.freeze(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']);
export const CIVIL_STATES = Object.freeze(['SOLTERO', 'SOLTERA', 'CASADO', 'CASADA']);
export const LABEL_WORDS = new Set(['REPUBLICA', 'NACIONALIDAD', 'OCUPACION', 'FECHA', 'SEXO', 'SANGRE', 'NACIMIENTO', 'EXPIRACION', 'CEDULA', 'IDENTIDAD']);

export const fold = value => String(value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9Ñ+\-(),/:|\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const displayText = value => String(value || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ+\-(),/\s]/gi, ' ').replace(/\s+/g, ' ').trim();

export function formatCedula(value) { const digits = String(value || '').replace(/\D/g, ''); return digits.length === 11 ? `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}` : ''; }
export function cedulaCheckDigit(value) { const digits = String(value || '').replace(/\D/g, ''); if (digits.length !== 11) return false; let total = 0; for (let i = 0; i < 10; i += 1) { let product = Number(digits[i]) * (i % 2 === 0 ? 1 : 2); if (product >= 10) product -= 9; total += product; } return (10 - total % 10) % 10 === Number(digits[10]); }
export function normalizeCedulaOCR(value) { const numeric = String(value || '').toUpperCase().replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/G/g, '6').replace(/B/g, '8').replace(/\D/g, ''); return { value: formatCedula(numeric), complete: numeric.length === 11, valid: numeric.length === 11 && cedulaCheckDigit(numeric), rules: ['Confusiones OCR corregidas solo en zona numérica', numeric.length !== 11 ? 'No se inventaron dígitos faltantes' : null].filter(Boolean) }; }

export function normalizeDate(value) {
  const text = fold(value); let day, month, year;
  const slash = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/), words = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})\\s+(\\d{4})\\b`));
  if (slash) [, day, month, year] = slash; else if (words) { day = words[1]; month = MONTHS[words[2]]; year = words[3]; } else return { value: '', valid: false };
  const d = Number(day), m = Number(month), y = Number(year), date = new Date(Date.UTC(y, m - 1, d)), valid = y >= 1900 && y <= new Date().getUTCFullYear() && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return { value: valid ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : '', valid };
}
export function validSex(value) { return ['M', 'F'].includes(String(value || '').toUpperCase()) ? String(value).toUpperCase() : ''; }
export function validBlood(value) { const v = fold(value).replace(/0/g, 'O').replace(/\s/g, ''); return BLOOD_TYPES.includes(v) ? v : ''; }
export function validCivil(value) { const v = fold(value); return CIVIL_STATES.find(state => v === state || v.includes(state)) || ''; }
export function textualQuality(value) { const words = fold(value).replace(/[^A-ZÑ\s]/g, ' ').split(' ').filter(Boolean); if (!words.length) return 0; const vowel = words.filter(w => /[AEIOUÁÉÍÓÚ]/.test(w)).length / words.length, repeatedNoise = words.some(w => /^[ILJ]{4,}$/.test(w)); return Math.max(0, Math.min(100, Math.round(vowel * 65 + Math.min(35, words.join('').length * 1.5) - (repeatedNoise ? 80 : 0)))); }
