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
