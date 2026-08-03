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

// Carga primero la corrección de nombres 0.8.1 y luego la alineación automática 0.9.0.
const readButton090=document.getElementById('readBtn');
if(readButton090)readButton090.disabled=true;

function enableRead090(){if(readButton090)readButton090.disabled=false}
function loadAutoAlign090(){
  const align=document.createElement('script');
  align.src='./auto-align-v09.js?v=090';
  align.onload=enableRead090;
  align.onerror=()=>{
    enableRead090();
    if(typeof setStatus==='function')setStatus('ocrStatus','No se cargó la alineación automática. Puedes usar el recorte manual como respaldo.','warn');
  };
  document.head.appendChild(align);
}

const correction081=document.createElement('script');
correction081.src='./ocr-v081.js?v=090';
correction081.onload=loadAutoAlign090;
correction081.onerror=()=>{
  loadAutoAlign090();
  if(typeof setStatus==='function')setStatus('ocrStatus','No se cargó la corrección de nombres. Recarga la página e inténtalo de nuevo.','warn');
};
document.head.appendChild(correction081);
