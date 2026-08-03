'use strict';

const JCF_VISIBLE_VERSION = '0.9.1';

function setAlignUiV091(state, title, detail){
  const panel = document.getElementById('alignPanelV091');
  const icon = document.getElementById('alignIconV091');
  const heading = document.getElementById('alignTitleV091');
  const text = document.getElementById('alignDetailV091');
  if(!panel || !icon || !heading || !text) return;
  panel.dataset.state = state;
  icon.textContent = state === 'success' ? '✅' : state === 'error' ? '⚠️' : state === 'working' ? '⏳' : 'ℹ️';
  heading.textContent = title;
  text.textContent = detail;
}

const versionChipV091 = document.getElementById('visibleVersionV091');
if(versionChipV091) versionChipV091.textContent = `Versión ${JCF_VISIBLE_VERSION}`;
document.title = `JCF Registro v${JCF_VISIBLE_VERSION}`;

const alignButtonV091 = document.getElementById('autoAlignBtnV09');

if(typeof detectCardCornersV09 === 'function'){
  const detectCardCornersBaseV091 = detectCardCornersV09;
  detectCardCornersV09 = async function(){
    if(!sourceImage){
      setAlignUiV091('idle','Detector automático listo','Primero toma una foto o elige una imagen.');
      if(typeof setStatus === 'function') setStatus('ocrStatus','Primero toma o selecciona una fotografía.','warn');
      return false;
    }
    const started = performance.now();
    setAlignUiV091('working','Detectando los cuatro bordes…','No muevas el recuadro mientras se analiza la imagen.');
    try{
      const ok = await detectCardCornersBaseV091();
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      if(ok){
        setAlignUiV091('success','Alineación automática lista',`Perspectiva corregida en ${seconds} s. Debes ver un contorno verde sobre la cédula.`);
      }else{
        setAlignUiV091('error','No se detectaron los cuatro bordes','Usa “Detectar bordes” otra vez o ajusta manualmente el recuadro azul.');
      }
      return ok;
    }catch(error){
      console.error('Error visible de alineación:', error);
      setAlignUiV091('error','Falló el detector automático',String(error?.message || 'Usa el recorte manual como respaldo.'));
      return false;
    }
  };

  if(alignButtonV091){
    alignButtonV091.disabled = false;
    alignButtonV091.addEventListener('click',()=>detectCardCornersV09());
  }
  setAlignUiV091('idle','Detector automático cargado','Selecciona una imagen. La aplicación intentará alinearla sola.');
}else{
  setAlignUiV091('error','La alineación automática no cargó','Recarga esta página. Si persiste, envía una captura donde se vea la versión 0.9.1.');
  if(alignButtonV091) alignButtonV091.disabled = true;
}

window.addEventListener('error', event => {
  const source = String(event?.filename || '');
  if(source.includes('opencv') || source.includes('auto-align')){
    setAlignUiV091('error','Error al cargar el detector',event.message || 'Safari bloqueó uno de los componentes.');
  }
});
