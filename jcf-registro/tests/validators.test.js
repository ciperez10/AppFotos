import { describe, expect, it } from 'vitest';
import { cedulaCheckDigit, formatCedula, normalizeCedulaOCR, normalizeDate, validBlood, validCivil, validSex } from '../src/ocr/validators.js';

describe('cédula dominicana', () => {
  it('formatea exactamente once dígitos', () => { expect(formatCedula('99999999990')).toBe('999-9999999-0'); expect(formatCedula('123')).toBe(''); });
  it('valida el dígito verificador y rechaza el incorrecto', () => { expect(cedulaCheckDigit('99999999990')).toBe(true); expect(cedulaCheckDigit('99999999991')).toBe(false); });
  it('corrige confusiones solo en la zona numérica sin inventar dígitos', () => { expect(normalizeCedulaOCR('999-9999999-O').value).toBe('999-9999999-0'); expect(normalizeCedulaOCR('99O-9999999').value).toBe(''); });
});

describe('validadores de campos', () => {
  it('normaliza fechas reales y rechaza fechas imposibles', () => { expect(normalizeDate('29 FEBRERO 2000').value).toBe('29/02/2000'); expect(normalizeDate('31/02/2000').valid).toBe(false); expect(normalizeDate('11/12/2000').value).toBe('11/12/2000'); });
  it('acepta solamente M o F', () => { expect(validSex('m')).toBe('M'); expect(validSex('X')).toBe(''); });
  it('valida sangre y estado civil', () => { expect(validBlood('ab +')).toBe('AB+'); expect(validBlood('C+')).toBe(''); expect(validCivil('CASADA')).toBe('CASADA'); expect(validCivil('UNIÓN LIBRE')).toBe(''); });
});
