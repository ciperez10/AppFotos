const STATES = {
  idle: ['●', 'Esperando una imagen'], preparing: ['◌', 'Preparando imagen'], detecting: ['◌', 'Detectando bordes'],
  correction: ['◆', 'Esperando corrección'], normalizing: ['◌', 'Normalizando perspectiva'], loading: ['◌', 'Cargando OCR'],
  reading: ['◌', 'Leyendo datos'], complete: ['✓', 'Lectura terminada'], incomplete: ['!', 'Lectura incompleta'],
  recoverable: ['!', 'Error recuperable']
};

export function createStatusController({ panel, icon, text, detail }) {
  return {
    set(state, extra = '') {
      const [glyph, label] = STATES[state] || STATES.recoverable;
      panel.dataset.kind = ['preparing', 'detecting', 'normalizing', 'loading', 'reading'].includes(state) ? 'working' : state === 'complete' ? 'success' : ['correction', 'incomplete'].includes(state) ? 'warning' : state === 'recoverable' ? 'error' : 'idle';
      icon.textContent = glyph; text.textContent = label; if (extra) detail.textContent = extra;
    }
  };
}
