import { describe, expect, it } from 'vitest';
import { nameConsensus } from '../src/ocr/consensus.js';
import { OCR_FIXTURES } from './fixtures.js';

describe('consenso de nombres', () => {
  it('prefiere una alternativa repetida de dos palabras sobre ruido corto', () => { expect(nameConsensus(OCR_FIXTURES.names, 'given').value).toBe('LUMA TERA'); });
  it('rechaza candidatos sin vocales', () => { expect(nameConsensus([{ value: 'XZQ', confidence: 99, source: 'ruido' }], 'given').status).toBe('no detectado'); });
  it('no reutiliza los nombres como apellidos', () => { const result = nameConsensus([{ value: 'LUMA TERA', confidence: 97, source: 'ruido' }, { value: 'DE LA MONTA', confidence: 70, source: 'gris' }], 'surname', 'LUMA TERA'); expect(result.value).toBe('DE LA MONTA'); });
  it('rechaza apellidos que terminan en conector', () => { const result = nameConsensus([{ value: 'MONTA DE', confidence: 95, source: 'ruido' }, { value: 'NOVA LUZ', confidence: 65, source: 'gris' }], 'surname', 'LUMA TERA'); expect(result.value).toBe('NOVA LUZ'); });
});
