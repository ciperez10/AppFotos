const DEBUG_VERSION='JCF-WEB-OCR-0.6.0';
const OCR_REGIONS={
  cedula:{x:.28,y:.09,w:.70,h:.29,label:'Número de cédula'},
  fecha:{x:.245,y:.34,w:.62,h:.22,label:'Fecha de nacimiento'},
  nombre1:{x:.018,y:.785,w:.64,h:.092,label:'Nombre · línea 1'},
  nombre2:{x:.018,y:.865,w:.72,h:.115,label:'Nombre · línea 2'}
};
let lastDebug=null;

function regionCanvas(card,rx,ry,rw,rh,mode='gray'){
  const x=Math.round(card.width*rx),y=Math.round(card.height*ry),w=Math.round(card.width*rw),h=Math.round(card.height*rh);
  const scale=Math.min(3,2200/Math.max(1,w));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(card,x,y,w,h,0,0,c.width,c.height);
  enhanceCanvas(c,mode);
  return c;
}

function enhanceCanvas(canvas,mode='gray'){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data,hist=new Uint32Array(256);
  for(let i=0;i<d.length;i+=4){const g=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);hist[g]++;d[i]=d[i+1]=d[i+2]=g}
  const total=canvas.width*canvas.height;let low=0,high=255,c=0;
  for(let i=0;i<256;i++){c+=hist[i];if(c>=total*.025){low=i;break}}
  c=0;for(let i=255;i>=0;i--){c+=hist[i];if(c>=total*.025){high=i;break}}
  const span=Math.max(28,high-low);
  for(let i=0;i<d.length;i+=4){let g=Math.max(0,Math.min(255,((d[i]-low)*255)/span));g=Math.pow(g/255,.84)*255;d[i]=d[i+1]=d[i+2]=g}
  if(mode==='binary'){
    const h2=new Uint32Array(256);for(let i=0;i<d.length;i+=4)h2[Math.round(d[i])]++;
    let sum=0;for(let i=0;i<256;i++)sum+=i*h2[i];
    let sumB=0,wB=0,max=0,threshold=150;
    for(let t=0;t<256;t++){wB+=h2[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*h2[t];const mB=sumB/wB,mF=(sum-sumB)/wF,between=wB*wF*(mB-mF)*(mB-mF);if(between>max){max=between;threshold=t}}
    threshold=Math.min(210,Math.max(95,threshold));
    for(let i=0;i<d.length;i+=4){const v=d[i]>threshold?255:0;d[i]=d[i+1]=d[i+2]=v}
  }
  ctx.putImageData(img,0,0);
}

function cleanDigitText(text){return String(text||'').toUpperCase().replace(/[OQD]/g,'0').replace(/[IL|!]/g,'1').replace(/Z/g,'2').replace(/S/g,'5').replace(/G/g,'6').replace(/B/g,'8').replace(/[^\d-]/g,' ')}
function extractCedula(...texts){
  for(const raw of texts){
    const text=cleanDigitText(raw),matches=text.match(/\d{3}\s*-?\s*\d{7}\s*-?\s*\d/g)||[];
    for(const m of matches){const n=m.replace(/\D/g,'');if(n.length===11)return`${n.slice(0,3)}-${n.slice(3,10)}-${n.slice(10)}`}
    const chunks=text.match(/\d[\d\s-]{9,20}\d/g)||[];
    for(const m of chunks){const n=m.replace(/\D/g,'');if(n.length===11)return`${n.slice(0,3)}-${n.slice(3,10)}-${n.slice(10)}`}
  }
  return'';
}

function validateCedula(value){
  const n=String(value||'').replace(/\D/g,'');if(n.length!==11)return false;
  let sum=0;for(let i=0;i<10;i++){let p=Number(n[i])*(i%2===0?1:2);if(p>=10)p=Math.floor(p/10)+(p%10);sum+=p}
  return((10-(sum%10))%10)===Number(n[10]);
}

const MONTH_LIST=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','SETIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MONTH_SET=new Set(MONTH_LIST);
const MONTHS=MONTH_LIST.join('|');
const BANNED_WORDS=new Set(['REPUBLICA','DOMINICANA','JUNTA','CENTRAL','ELECTORAL','CEDULA','IDENTIDAD','NACIMIENTO','NACIONALIDAD','SEXO','SANGRE','ESTADO','CIVIL','OCUPACION','EXPIRACION','LUGAR','SOLTERO','SOLTERA','CASADO','CASADA','FECHA','CUBA','HABANA','PUBLICO','PUBLICA','EMPLEADO','EMPLEADA','COMERCIANTE','EMPRESARIO','EMPRESARIA','MEDICO','MEDICA']);
const CONNECTORS=new Set(['DE','DEL','LA','LAS','LOS','Y']);
function normalizeNameLine(line){return String(line||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-ZÑ\s]/g,' ').replace(/\s+/g,' ').trim()}
function cleanNameTokens(text){return normalizeNameLine(text).split(' ').filter(Boolean).filter(w=>w.length>1&&!MONTH_SET.has(w)&&!BANNED_WORDS.has(w))}
function scoreWindow(words,role){
  if(!words.length)return-999;let score=0;
  for(const w of words){score+=Math.min(w.length,9);if(CONNECTORS.has(w))score+=role==='surname'?3:-2;if(w.length<=2&&!CONNECTORS.has(w))score-=5}
  if(role==='given'){if(words.length>=1&&words.length<=3)score+=10;else score-=Math.abs(words.length-2)*5;if(words.some(w=>CONNECTORS.has(w)))score-=5}
  else{if(words.length>=2&&words.length<=5)score+=10;else score-=Math.abs(words.length-3)*4;if(words.some(w=>CONNECTORS.has(w)))score+=3}
  return score;
}
function bestNameWindow(text,role){
  const sourceLines=String(text||'').split(/\n+/).map(cleanNameTokens).filter(x=>x.length);
  const candidates=[];
  for(const words of sourceLines){
    const max=role==='given'?3:5,min=role==='given'?1:2;
    for(let size=min;size<=Math.min(max,words.length);size++)for(let i=0;i<=words.length-size;i++){const slice=words.slice(i,i+size);candidates.push({value:slice.join(' '),score:scoreWindow(slice,role)})}
  }
  candidates.sort((a,b)=>b.score-a.score||b.value.length-a.value.length);
  return candidates[0]?.score>3?candidates[0].value:'';
}
function chooseNameLine(passes,role){
  const choices=[];
  for(const p of passes){const value=bestNameWindow(p.text,role);if(value)choices.push({value,score:scoreWindow(value.split(' '),role)+(Number(p.confidence)||0)/12,confidence:Number(p.confidence)||0,pass:p.id})}
  choices.sort((a,b)=>b.score-a.score||b.confidence-a.confidence);
  return choices[0]||{value:'',score:0,confidence:0,pass:''};
}
function combineName(given,surname){return`${given||''} ${surname||''}`.replace(/\s+/g,' ').trim()}
function nameNeedsReview(given,surname){
  if(!given||!surname)return true;const all=combineName(given,surname).split(' '),sur=surname.split(' ');
  return all.length<3||CONNECTORS.has(sur[0])||given.length<4||surname.length<4;
}

function extractBirthDate(...texts){
  for(const raw of texts){
    const t=String(raw||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,' ').replace(/\s+/g,' ');
    const m=t.match(new RegExp('\\b([0-3]?\\d)\\s+('+MONTHS+')\\s+(19\\d{2}|20\\d{2})\\b'));
    if(m)return`${m[1].padStart(2,'0')} ${m[2].replace('SETIEMBRE','SEPTIEMBRE')} ${m[3]}`;
  }
  return'';
}

function formatCedulaInput(value){const n=value.replace(/\D/g,'').slice(0,11);if(n.length<=3)return n;if(n.length<=10)return n.slice(0,3)+'-'+n.slice(3);return n.slice(0,3)+'-'+n.slice(3,10)+'-'+n.slice(10)}
document.getElementById('cedula').addEventListener('input',e=>e.target.value=formatCedulaInput(e.target.value));
document.getElementById('readBtn').addEventListener('click',readCedula);
document.getElementById('hideDiagnosticBtn')?.addEventListener('click',()=>document.getElementById('diagnosticWrap').style.display='none');
document.getElementById('copyDiagnosticBtn')?.addEventListener('click',copyDiagnostic);
document.getElementById('shareDiagnosticBtn')?.addEventListener('click',shareDiagnostic);
document.getElementById('downloadJsonBtn')?.addEventListener('click',downloadDebugJson);
document.getElementById('downloadPngBtn')?.addEventListener('click',downloadDebugPng);

async function recognizePass(id,canvas,params,mode){
  const started=performance.now(),w=await getWorker(false);await w.setParameters(params);const result=await w.recognize(canvas),data=result.data||{};
  return{id,mode,text:data.text||'',confidence:Number.isFinite(data.confidence)?Math.round(data.confidence*10)/10:null,ms:Math.round(performance.now()-started),width:canvas.width,height:canvas.height,psm:params.tessedit_pageseg_mode};
}
function canvasPreview(label,canvas,pass){return{label,url:canvas.toDataURL('image/jpeg',.82),confidence:pass?.confidence??null,ms:pass?.ms??null,text:String(pass?.text||'').replace(/\s+/g,' ').trim(),width:canvas.width,height:canvas.height}}
function canvasQuality(canvas){
  const probe=document.createElement('canvas'),max=420,scale=Math.min(1,max/canvas.width);probe.width=Math.max(1,Math.round(canvas.width*scale));probe.height=Math.max(1,Math.round(canvas.height*scale));const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,probe.width,probe.height);const d=ctx.getImageData(0,0,probe.width,probe.height).data;let sum=0,sum2=0,edges=0,count=0;
  for(let y=0;y<probe.height;y+=2)for(let x=0;x<probe.width;x+=2){const i=(y*probe.width+x)*4,g=.299*d[i]+.587*d[i+1]+.114*d[i+2];sum+=g;sum2+=g*g;count++;if(x+2<probe.width){const j=(y*probe.width+x+2)*4,g2=.299*d[j]+.587*d[j+1]+.114*d[j+2];edges+=Math.abs(g-g2)}}
  const brightness=sum/count,contrast=Math.sqrt(Math.max(0,sum2/count-brightness*brightness)),sharpness=edges/count;probe.width=1;probe.height=1;
  return{brightness:Math.round(brightness*10)/10,contrast:Math.round(contrast*10)/10,sharpness:Math.round(sharpness*10)/10,assessment:sharpness<10?'posible desenfoque':brightness<65?'imagen oscura':brightness>215?'imagen muy clara':'calidad aceptable'};
}

function drawDiagnosticRegion(ctx,canvas,region,value,review=false){
  const x=canvas.width*region.x,y=canvas.height*region.y,w=canvas.width*region.w,h=canvas.height*region.h,ok=Boolean(value)&&!review;
  ctx.save();ctx.strokeStyle=ok?'#16A36A':'#F59E0B';ctx.lineWidth=Math.max(5,canvas.width*.005);ctx.setLineDash(ok?[]:[18,12]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
  const prefix=ok?'✓':review?'?':'!';const label=`${prefix} ${region.label}: ${value||'NO DETECTADO'}`;ctx.font=`700 ${Math.max(20,canvas.width*.019)}px -apple-system, Arial`;const pad=10,textW=ctx.measureText(label).width,boxH=Math.max(36,canvas.height*.048),boxW=Math.min(canvas.width-x,textW+pad*2);
  ctx.fillStyle=ok?'rgba(22,163,106,.92)':'rgba(245,158,11,.94)';ctx.fillRect(x,Math.max(0,y-boxH),boxW,boxH);ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText(label,x+pad,Math.max(boxH/2,y-boxH/2),boxW-pad*2);ctx.restore();
}
function newSessionId(){return(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0,18)}
function renderDebugCrops(previews){const grid=document.getElementById('debugCrops');grid.innerHTML='';for(const p of previews){const item=document.createElement('div');item.className='debug-crop';const img=document.createElement('img');img.src=p.url;img.alt=p.label;const title=document.createElement('strong');title.textContent=p.label;const meta=document.createElement('small');meta.textContent=`Confianza: ${p.confidence??'—'}% · ${p.ms??'—'} ms · ${p.width}×${p.height}`;const raw=document.createElement('code');raw.textContent=p.text||'Sin texto';item.append(title,img,meta,raw);grid.appendChild(item)}}
function compactPass(p){return{id:p.id,mode:p.mode,confidence:p.confidence,ms:p.ms,width:p.width,height:p.height,psm:p.psm,text:String(p.text||'').trim()}}
function showDiagnostic(card,result,passes,previews,meta){
  const wrap=document.getElementById('diagnosticWrap'),canvas=document.getElementById('diagnosticCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});canvas.width=1269;canvas.height=800;ctx.drawImage(card,0,0,canvas.width,canvas.height);
  drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.cedula,result.cedula,!result.cedulaValid);drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.fecha,result.fecha,false);drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.nombre1,result.given,result.nameReview);drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.nombre2,result.surname,result.nameReview);
  const sessionId=newSessionId(),quality=canvasQuality(card),payload={version:DEBUG_VERSION,sessionId,createdAt:new Date().toISOString(),detected:result,corrected:null,meta:{...meta,quality,userAgent:navigator.userAgent,language:navigator.language,online:navigator.onLine},regions:OCR_REGIONS,passes:passes.map(compactPass)};
  lastDebug={payload,pngDataUrl:canvas.toDataURL('image/png')};
  const summary=[`Versión: ${DEBUG_VERSION}`,`Sesión: ${sessionId}`,`Cédula: ${result.cedula||'NO DETECTADA'} (${result.cedulaValid?'dígito verificador válido':'REVISAR'})`,`Nombre línea 1: ${result.given||'NO DETECTADA'}`,`Nombre línea 2: ${result.surname||'NO DETECTADA'}`,`Nombre combinado: ${result.nombre||'NO DETECTADO'}${result.nameReview?' (REVISAR)':''}`,`Fecha: ${result.fecha||'NO DETECTADA'}`,`Calidad: brillo ${quality.brightness}, contraste ${quality.contrast}, nitidez ${quality.sharpness} · ${quality.assessment}`,`Tiempo total: ${meta.totalMs} ms`,`Imagen fuente: ${meta.sourceWidth}×${meta.sourceHeight} · rotación ${meta.rotation}°`,`Recorte: ${meta.cropRatio} (objetivo 1.586)`,'','PASES OCR:',...passes.map(p=>`[${p.id}] conf=${p.confidence??'—'}% tiempo=${p.ms}ms tamaño=${p.width}×${p.height}\n${String(p.text||'').trim()||'—'}`)].join('\n');
  document.getElementById('diagnosticText').textContent=summary;document.getElementById('diagnosticMeta').innerHTML=`<span>v${DEBUG_VERSION.split('-').pop()}</span><span>Sesión ${sessionId}</span><span>${meta.totalMs} ms</span><span>${quality.assessment}</span>`;renderDebugCrops(previews);wrap.style.display='block';wrap.scrollIntoView({behavior:'smooth',block:'start'});
}
function currentCorrected(){return{cedula:document.getElementById('cedula').value.trim(),nombre:document.getElementById('nombreTutor').value.trim().toUpperCase(),fecha:document.getElementById('fechaNacimientoTutor').value.trim().toUpperCase()}}
function buildDebugPayload(){if(!lastDebug)return null;const payload=JSON.parse(JSON.stringify(lastDebug.payload)),corrected=currentCorrected();payload.corrected=corrected;payload.differences={cedula:payload.detected.cedula!==corrected.cedula,nombre:payload.detected.nombre!==corrected.nombre,fecha:payload.detected.fecha!==corrected.fecha};return payload}
function debugText(){const p=buildDebugPayload();if(!p)return'';return[`JCF REGISTRO · INFORME OCR`,`Versión: ${p.version}`,`Sesión: ${p.sessionId}`,`Fecha: ${p.createdAt}`,'',`DETECTADO`,`Cédula: ${p.detected.cedula||'NO DETECTADA'} · verificación ${p.detected.cedulaValid?'válida':'revisar'}`,`Nombre 1: ${p.detected.given||'NO DETECTADO'}`,`Nombre 2: ${p.detected.surname||'NO DETECTADO'}`,`Nombre: ${p.detected.nombre||'NO DETECTADO'}${p.detected.nameReview?' · REVISAR':''}`,`Nacimiento: ${p.detected.fecha||'NO DETECTADA'}`,'',`CORREGIDO POR EL USUARIO`,`Cédula: ${p.corrected.cedula||'—'}`,`Nombre: ${p.corrected.nombre||'—'}`,`Nacimiento: ${p.corrected.fecha||'—'}`,'',`DIFERENCIAS: ${JSON.stringify(p.differences)}`,'',`META: ${JSON.stringify(p.meta)}`,'',...p.passes.map(x=>`[${x.id}] conf=${x.confidence??'—'}% ${x.ms}ms ${x.width}x${x.height}\n${x.text||'—'}`)].join('\n')}
async function copyDiagnostic(){const text=debugText();if(!text){setStatus('ocrStatus','Todavía no hay diagnóstico para copiar.','warn');return}try{await navigator.clipboard.writeText(text);setStatus('ocrStatus','Informe técnico copiado. Corrige los campos antes de copiar para incluir la comparación.')}catch{setStatus('ocrStatus','No se pudo copiar automáticamente. Usa “Compartir informe”.','warn')}}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function dataUrlToBlob(dataUrl){const [head,data]=dataUrl.split(','),mime=head.match(/:(.*?);/)?.[1]||'image/png',bytes=atob(data),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:mime})}
function downloadDebugJson(){const p=buildDebugPayload();if(!p)return setStatus('ocrStatus','Todavía no hay diagnóstico para descargar.','warn');downloadBlob(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),`jcf-ocr-${p.sessionId}.json`)}
function downloadDebugPng(){if(!lastDebug)return setStatus('ocrStatus','Todavía no hay imagen de diagnóstico.','warn');downloadBlob(dataUrlToBlob(lastDebug.pngDataUrl),`jcf-ocr-${lastDebug.payload.sessionId}.png`)}
async function shareDiagnostic(){
  const p=buildDebugPayload();if(!p)return setStatus('ocrStatus','Todavía no hay diagnóstico para compartir.','warn');const png=dataUrlToBlob(lastDebug.pngDataUrl),json=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),files=[new File([png],`jcf-ocr-${p.sessionId}.png`,{type:'image/png'}),new File([json],`jcf-ocr-${p.sessionId}.json`,{type:'application/json'})],text=debugText();
  try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files}))){await navigator.share({title:'Diagnóstico JCF Registro OCR',text,files});setStatus('ocrStatus','Informe compartido.')}else{await navigator.clipboard.writeText(text);downloadBlob(png,files[0].name);setStatus('ocrStatus','Tu navegador no permitió compartir archivos; copié el texto y descargué la imagen.','warn')}}catch(err){if(err?.name!=='AbortError')setStatus('ocrStatus','No se pudo compartir. Puedes descargar la imagen y el JSON por separado.','warn')}
}

async function readCedula(){
  if(!sourceImage){setStatus('ocrStatus','Primero toma o selecciona una fotografía.','warn');return}
  const started=performance.now(),sourceWidth=sourceImage.naturalWidth,sourceHeight=sourceImage.naturalHeight,cropRatio=(crop.w/Math.max(1,crop.h)).toFixed(3),rotationUsed=rotation,btn=document.getElementById('readBtn');btn.disabled=true;setProgress('ocrProgress','ocrBar',3);setStatus('ocrStatus','Preparando la imagen…');
  let card,numberGray,numberBinary,numberWide,givenGray,givenBinary,surnameGray,surnameBinary,nameCombined,dateGray,dateBinary,fullC;const passes=[];const previews=[];
  try{
    card=makeCardCanvas();
    numberGray=regionCanvas(card,.29,.10,.68,.27,'gray');numberBinary=regionCanvas(card,.29,.10,.68,.27,'binary');numberWide=regionCanvas(card,.22,.07,.76,.32,'gray');
    givenGray=regionCanvas(card,.018,.775,.64,.105,'gray');givenBinary=regionCanvas(card,.018,.775,.64,.105,'binary');surnameGray=regionCanvas(card,.018,.858,.72,.125,'gray');surnameBinary=regionCanvas(card,.018,.858,.72,.125,'binary');nameCombined=regionCanvas(card,.01,.75,.75,.245,'gray');
    dateGray=regionCanvas(card,.245,.34,.62,.22,'gray');dateBinary=regionCanvas(card,.245,.34,.62,.22,'binary');
    const run=async(id,canvas,params,mode,progress)=>{const p=await recognizePass(id,canvas,params,mode);passes.push(p);previews.push(canvasPreview(id,canvas,p));setProgress('ocrProgress','ocrBar',progress);return p};
    const number1=await run('numero_gris',numberGray,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789- OQDILZSBG'},'gray',14);
    const number2=await run('numero_binario',numberBinary,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789- OQDILZSBG'},'binary',24);
    const number3=await run('numero_amplio',numberWide,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'0123456789- OQDILZSBG'},'gray',34);
    const given1=await run('nombre_linea1_gris',givenGray,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'gray',44);
    const given2=await run('nombre_linea1_binario',givenBinary,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'binary',54);
    const surname1=await run('nombre_linea2_gris',surnameGray,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'gray',64);
    const surname2=await run('nombre_linea2_binario',surnameBinary,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'binary',72);
    const combined=await run('nombre_bloque_completo',nameCombined,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'gray',80);
    const date1=await run('fecha_gris',dateGray,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'gray',88);
    const date2=await run('fecha_binaria',dateBinary,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '},'binary',93);
    let cedula=extractCedula(number1.text,number2.text,number3.text),givenPick=chooseNameLine([given1,given2,combined],'given'),surnamePick=chooseNameLine([surname1,surname2,combined],'surname'),given=givenPick.value,surname=surnamePick.value,fecha=extractBirthDate(date1.text,date2.text),fullText='';
    if(!cedula||!given||!surname||!fecha){fullC=document.createElement('canvas');fullC.width=1269;fullC.height=800;fullC.getContext('2d',{willReadFrequently:true}).drawImage(card,0,0,fullC.width,fullC.height);enhanceCanvas(fullC,'gray');const full=await recognizePass('cedula_completa',fullC,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,preserve_interword_spaces:'1'},'gray');passes.push(full);previews.push(canvasPreview('cedula_completa',fullC,full));fullText=full.text||'';cedula=cedula||extractCedula(fullText);fecha=fecha||extractBirthDate(fullText);if(!given)given=bestNameWindow(fullText,'given');if(!surname)surname=bestNameWindow(fullText,'surname')}
    const nombre=combineName(given,surname),cedulaValid=validateCedula(cedula),nameReview=nameNeedsReview(given,surname),result={cedula,cedulaValid,given,surname,nombre,fecha,nameReview,givenPass:givenPick.pass,surnamePass:surnamePick.pass};
    const setField=(id,value,review=false)=>{const e=document.getElementById(id);if(value)e.value=value;e.classList.toggle('field-ok',Boolean(value)&&!review)};setField('cedula',cedula,!cedulaValid);setField('nombreTutor',nombre,nameReview);setField('fechaNacimientoTutor',fecha,false);
    const meta={totalMs:Math.round(performance.now()-started),sourceWidth,sourceHeight,rotation:rotationUsed,cropRatio,cardWidth:card.width,cardHeight:card.height,displayScale:display.scale,crop:{x:Math.round(crop.x),y:Math.round(crop.y),w:Math.round(crop.w),h:Math.round(crop.h)}};
    showDiagnostic(card,result,passes,previews,meta);setProgress('ocrProgress','ocrBar',100);
    const warnings=[];if(!cedula)warnings.push('no se detectó la cédula');else if(!cedulaValid)warnings.push('el dígito verificador de la cédula no coincide');if(!nombre)warnings.push('no se detectó el nombre');else if(nameReview)warnings.push('el nombre puede estar incompleto');if(!fecha)warnings.push('no se detectó la fecha');
    if(!warnings.length)setStatus('ocrStatus','Lectura completada. Revisa los campos; después puedes compartir el paquete de depuración.');else setStatus('ocrStatus',`Lectura con observaciones: ${warnings.join('; ')}. Corrige los campos y comparte el diagnóstico para seguir mejorando.`,'warn');
  }catch(err){console.error(err);setStatus('ocrStatus','No pude leer la imagen. Prueba con más luz, menos inclinación y la cédula ocupando casi toda la foto.','error')}
  finally{[numberGray,numberBinary,numberWide,givenGray,givenBinary,surnameGray,surnameBinary,nameCombined,dateGray,dateBinary,fullC,card].forEach(c=>{if(c){c.width=1;c.height=1}});clearImageMemory();document.getElementById('editorWrap').style.display='none';const camera=document.getElementById('cedulaCamara'),gallery=document.getElementById('cedulaFoto');if(camera)camera.value='';if(gallery)gallery.value='';btn.disabled=false;setTimeout(()=>setProgress('ocrProgress','ocrBar',null),1000)}
}

function clearImageMemory(){sourceImage=null;if(imageObjectUrl){URL.revokeObjectURL(imageObjectUrl);imageObjectUrl=null}cropCanvas.width=1;cropCanvas.height=1}
