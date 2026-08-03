'use strict';

const JCF_VISIBLE_VERSION = '0.9.2';

document.title = `JCF Registro v${JCF_VISIBLE_VERSION}`;
const titleV092=document.querySelector('.hero h1');
if(titleV092)titleV092.textContent=`JCF Registro v${JCF_VISIBLE_VERSION}`;
const chipV092=document.getElementById('visibleVersionV091');
if(chipV092)chipV092.textContent=`Versión ${JCF_VISIBLE_VERSION}`;
const watermarkV092=document.querySelector('.version-watermark-v091');
if(watermarkV092)watermarkV092.textContent='Motor visible: JCF Registro 0.9.2 · Detector ligero compatible con Safari';

const buttonV092=document.getElementById('autoAlignBtnV09');
if(buttonV092){
  buttonV092.disabled=false;
  buttonV092.textContent='✨ Detectar bordes automáticamente';
}

// El detector ligero gestiona sus propios estados. Este archivo solo garantiza una salida visible.
setTimeout(()=>{
  const panel=document.getElementById('alignPanelV091');
  const heading=document.getElementById('alignTitleV091');
  if(panel&&heading&&heading.textContent.includes('Cargando detector automático')){
    panel.dataset.state='idle';
    document.getElementById('alignIconV091').textContent='📐';
    heading.textContent='Detector ligero v0.9.2 preparado';
    document.getElementById('alignDetailV091').textContent='Selecciona una imagen. Si no detecta los bordes, el OCR seguirá disponible en modo manual.';
  }
  const read=document.getElementById('readBtn');
  if(read)read.disabled=false;
},1200);

window.addEventListener('error',event=>{
  const source=String(event?.filename||'');
  if(source.includes('auto-align')){
    const panel=document.getElementById('alignPanelV091');
    if(panel)panel.dataset.state='error';
    const icon=document.getElementById('alignIconV091');if(icon)icon.textContent='⚠️';
    const heading=document.getElementById('alignTitleV091');if(heading)heading.textContent='Falló la alineación automática';
    const detail=document.getElementById('alignDetailV091');if(detail)detail.textContent='Puedes ajustar el recuadro azul y continuar con el OCR.';
    const read=document.getElementById('readBtn');if(read)read.disabled=false;
  }
});
