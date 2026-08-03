import { describe, expect, it } from 'vitest';
import { parseBirthDate, parseBirthPlace, parseBlood, parseCivil, parseOccupation, parseSex } from '../src/ocr/parsers.js';
import { OCR_FIXTURES } from './fixtures.js';

describe('parsers anclados a etiquetas', () => {
  it('extrae lugar entre sus etiquetas y conserva ciudad y país', () => { expect(parseBirthPlace(OCR_FIXTURES.identity).value).toBe('PUERTO CLARO, ISLA PRUEBA'); });
  it('rechaza ruido repetitivo como lugar', () => { expect(parseBirthPlace(OCR_FIXTURES.noisyPlace).status).toBe('no detectado'); });
  it('no confunde nacimiento con expiración', () => { expect(parseBirthDate(OCR_FIXTURES.identity).value).toBe('29/02/2000'); });
  it('solo extrae sexo asociado a SEXO', () => { expect(parseSex('NOMBRE FALSO M').value).toBe(''); expect(parseSex(OCR_FIXTURES.identity).value).toBe('F'); });
  it('separa sangre y estado civil, incluso en recortes de valor aislado', () => { expect(parseBlood(OCR_FIXTURES.identity).value).toBe('AB+'); expect(parseBlood('O-').value).toBe('O-'); expect(parseCivil(OCR_FIXTURES.identity).value).toBe('SOLTERA'); expect(parseCivil('CASADO').value).toBe('CASADO'); });
  it('conserva una ocupación válida y rechaza etiquetas ajenas', () => { expect(parseOccupation(OCR_FIXTURES.identity).value).toBe('EMPLEADO (A) PUBLICO'); expect(parseOccupation('OCUPACIÓN: NACIONALIDAD REPÚBLICA DOMINICANA FECHA DE EXPIRACIÓN').value).toBe(''); });
});
