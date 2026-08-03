'use strict';

// Compatibilidad: esta ruta antes cargaba OpenCV. Desde v0.9.2 solo carga el detector ligero.
const AUTO_ALIGN_VERSION = 'JCF-AUTO-ALIGN-0.9.2-LITE';
let liteAlignReadyResolveV092;
let liteAlignReadyRejectV092;
const liteAlignReadyV092 = new Promise((resolve,reject)=>{
  liteAlignReadyResolveV092=resolve;
  liteAlignReadyRejectV092=reject;
});

function setBridgeStateV092(state,title,detail){
  const panel=document.getElementById('alignPanelV091');
  const icon=document.getElementById('alignIconV091');
  const heading=document.getElementById('alignTitleV091');
  const copy=document.getElementById('alignDetailV091');
  if(panel)panel.dataset.state=state;
  if(icon)icon.textContent=state==='success'?'✅':state==='error'?'⚠️':'⏳';
  if(heading)heading.textContent=title;
  if(copy)copy.textContent=detail;
}

async function detectCardCornersV09(){
  try{
    await Promise.race([
      liteAlignReadyV092,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('El detector ligero tardó demasiado en cargar')),6000))
    ]);
    if(typeof window.detectCardLiteV092!=='function')throw new Error('Detector ligero no disponible');
    return await window.detectCardLiteV092();
  }catch(error){
    const read=document.getElementById('readBtn');
    if(read)read.disabled=false;
    setBridgeStateV092('error','Detector automático no disponible','Puedes continuar con el recorte manual; el OCR permanece desbloqueado.');
    if(typeof setStatus==='function')setStatus('ocrStatus','No cargó el detector automático. Ajusta el recuadro azul y pulsa “Leer cédula”.','warn');
    return false;
  }
}

setBridgeStateV092('working','Cargando detector ligero v0.9.2…','Sin OpenCV; debe terminar en pocos segundos.');
const liteScriptV092=document.createElement('script');
liteScriptV092.src='./auto-align-lite-v092.js?v=092-final';
liteScriptV092.onload=()=>{
  liteAlignReadyResolveV092(true);
  const read=document.getElementById('readBtn');
  if(read)read.disabled=false;
};
liteScriptV092.onerror=()=>{
  liteAlignReadyRejectV092(new Error('No se descargó auto-align-lite-v092.js'));
  const read=document.getElementById('readBtn');
  if(read)read.disabled=false;
  setBridgeStateV092('error','Falló la carga del detector','Usa el recorte manual; la lectura sigue disponible.');
};
document.head.appendChild(liteScriptV092);

// Respaldo adicional: nunca mantener el botón de lectura bloqueado por la alineación.
setTimeout(()=>{
  const read=document.getElementById('readBtn');
  if(read)read.disabled=false;
},6500);
