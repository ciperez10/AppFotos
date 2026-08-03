'use strict';
// El informe compartido usa la imagen marcada principal; las demás vistas permanecen visibles en el laboratorio.
contactSheetV08 = function(annotated){ return cloneCanvasV08(annotated); };

// La fecha conserva sus números; los demás campos siguen usando formato de lectura humana.
const fillFieldsV08Base = fillFieldsV08;
fillFieldsV08 = function(result){
  fillFieldsV08Base(result);
  const date = document.getElementById('fechaNacimientoTutor');
  if(date){
    date.value = result.fechaNacimiento || '';
    date.classList.toggle('field-ok', Boolean(result.fechaNacimiento));
  }
};

// Carga la corrección 0.8.1 antes de permitir una nueva lectura.
const readButton081=document.getElementById('readBtn');
if(readButton081)readButton081.disabled=true;
const correction081=document.createElement('script');
correction081.src='./ocr-v081.js?v=082';
correction081.onload=()=>{if(readButton081)readButton081.disabled=false};
correction081.onerror=()=>{
  if(readButton081)readButton081.disabled=false;
  if(typeof setStatus==='function')setStatus('ocrStatus','No se cargó la corrección de nombres. Recarga la página e inténtalo de nuevo.','warn');
};
document.head.appendChild(correction081);
