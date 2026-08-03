import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createWorker: vi.fn(), terminate: vi.fn(), resolveWorker: null }));
vi.mock('tesseract.js', () => ({ createWorker: mocks.createWorker, OEM: { LSTM_ONLY: 1 } }));

import { LocalOcrEngine } from '../src/ocr/worker.js';

describe('cancelación del worker OCR', () => {
  it('interrumpe inmediatamente aunque Tesseract todavía esté cargando', async () => {
    mocks.createWorker.mockImplementation(() => new Promise(resolve => { mocks.resolveWorker = resolve; }));
    const engine = new LocalOcrEngine(), pending = engine.ensureWorker(new AbortController().signal);
    await engine.cancel();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    mocks.resolveWorker({ terminate: mocks.terminate });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });
});
