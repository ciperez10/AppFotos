'use strict';

const JCF_OCR_VERSION = 'JCF-WEB-OCR-0.8.0';
const readCedulaV07 = readCedula;
document.getElementById('readBtn')?.removeEventListener('click', readCedulaV07);

const V08_REGIONS = {
  cedula: {x:.33,y:.16,w:.55,h:.14,label:'Número de cédula'},
  lugarNacimiento: {x:.31,y:.34,w:.55,h:.075,label:'Lugar de nacimiento'},
  fechaNacimiento: {x:.31,y:.415,w:.53,h:.075,label:'Fecha de nacimiento'},
  nacionalidad: {x:.43,y:.49,w:.47,h:.07,label:'Nacionalidad'},
  identidad: {x:.30,y:.505,w:.68,h:.105,label:'Sexo · sangre · estado civil'},
  ocupacion: {x:.42,y:.595,w:.48,h:.075,label:'Ocupación'},
  nombres: {x:.05,y:.755,w:.58,h:.085,label:'Nombres'},
  apellidos: {x:.05,y:.835,w:.65,h:.10,label:'Apellidos'},
  nombreBloque: {x:.035,y:.735,w:.72,h:.22,label:'Bloque de nombres'},
  centro: {x:.28,y:.30,w:.69,h:.39,label:'Bloque central'}
};

const V08_COUNTRIES = [
  'REPUBLICA DOMINICANA','ESTADOS UNIDOS','PUERTO RICO','VENEZUELA','COLOMBIA','MEXICO',
  'ESPAÑA','PANAMA','HONDURAS','NICARAGUA','GUATEMALA','ECUADOR','PERU','CHILE','ARGENTINA',
  'BRASIL','HAITI','CUBA'
];
const V08_CIVIL = ['SOLTERO','SOLTERA','CASADO','CASADA','DIVORCIADO','DIVORCIADA','VIUDO','VIUDA','UNION LIBRE'];
const V08_CONNECTORS = new Set(['DE','DEL','LA','LAS','LOS','Y']);
let lastLabAssets = null;

function injectV08Fields(){
  const place = document.getElementById('lugarNacimientoTutor');
  const occupation = document.getElementById('ocupacionTutor');
  if(place && !document.getElementById('nacionalidadTutor')){
    place.insertAdjacentHTML('afterend', '<label for="nacionalidadTutor">Nacionalidad</label><input id="nacionalidadTutor" placeholder="Ej.: República Dominicana"/>');
  }
  const sex = document.getElementById('sexoTutor');
  if(sex && !document.getElementById('tipoSangreTutor')){
    const row = sex.closest('.row');
    row?.insertAdjacentHTML('afterend','<div class="row"><div><label for="tipoSangreTutor">Tipo de sangre</label><input id="tipoSangreTutor" placeholder="Ej.: O+"/></div><div><label for="estadoCivilTutor">Estado civil</label><input id="estadoCivilTutor" placeholder="Ej.: Soltero"/></div></div>');
  }
  if(occupation && !document.getElementById('labModeToggle')){
    const uploadCard = document.getElementById('readBtn')?.closest('.card');
    const fileBox = uploadCard?.querySelector('.file-box');
    fileBox?.insertAdjacentHTML('afterend','<label class="lab-switch"><input id="labModeToggle" type="checkbox" checked/><span><strong>🧪 Modo laboratorio</strong><small>Más comprobaciones y diagnóstico completo. Puede tardar unos segundos más.</small></span></label>');
  }
  const diagnostic = document.getElementById('diagnosticWrap');
  if(diagnostic && !document.getElementById('labVisuals')){
    const cropsTitle = [...diagnostic.querySelectorAll('h4')].find(x=>/Recortes/i.test(x.textContent));
    cropsTitle?.insertAdjacentHTML('beforebegin','<h4>Laboratorio de imagen</h4><div class="lab-grid" id="labVisuals"></div><h4>Decisiones, reglas y ganadores</h4><div class="lab-decisions" id="labDecisions"></div>');
  }
}
injectV08Fields();

function normV08(value){return String(value||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[|_~]/g,' ').replace(/\s+/g,' ').trim()}
function cleanAlphaV08(value){return normV08(value).replace(/[^A-ZÑ(),+\-\s]/g,' ').replace(/\s+/g,' ').trim()}
function linesV08(value){return String(value||'').split(/\n+/).map(normV08).filter(Boolean)}
function isGibberishV08(value){
  const words=cleanAlphaV08(value).split(' ').filter(Boolean);if(!words.length)return true;
  const good=words.filter(w=>V08_CONNECTORS.has(w)||(/[AEIOU]/.test(w)&&w.length>=2)).length;
  return good/words.length<.6;
}
function formatTitleV08(value){return cleanAlphaV08(value).toLowerCase().replace(/(^|[\s,()])([a-zñ])/g,(_,a,b)=>a+b.toUpperCase())}

function cropV08(card,region,mode='gray'){return regionCanvas(card,region.x,region.y,region.w,region.h,mode)}
function cloneCanvasV08(source){const c=document.createElement('canvas');c.width=source.width;c.height=source.height;c.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);return c}
function grayCanvasV08(source){const c=cloneCanvasV08(source);enhanceCanvas(c,'gray');return c}
function binaryCanvasV08(source){const c=cloneCanvasV08(source);enhanceCanvas(c,'binary');return c}
function edgeCanvasV08(source){
  const max=900,scale=Math.min(1,max/source.width),c=document.createElement('canvas');c.width=Math.round(source.width*scale);c.height=Math.round(source.height*scale);
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,c.width,c.height);const img=ctx.getImageData(0,0,c.width,c.height),d=img.data,out=new Uint8ClampedArray(d.length);
  const lum=(x,y)=>{const i=(Math.max(0,Math.min(c.height-1,y))*c.width+Math.max(0,Math.min(c.width-1,x)))*4;return .299*d[i]+.587*d[i+1]+.114*d[i+2]};
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const gx=lum(x+1,y)-lum(x-1,y),gy=lum(x,y+1)-lum(x,y-1),v=Math.min(255,Math.hypot(gx,gy)*1.7),i=(y*c.width+x)*4;out[i]=out[i+1]=out[i+2]=v;out[i+3]=255}
  ctx.putImageData(new ImageData(out,c.width,c.height),0,0);return c;
}
function histogramCanvasV08(source){
  const hist=new Uint32Array(256),probe=document.createElement('canvas'),scale=Math.min(1,600/source.width);probe.width=Math.round(source.width*scale);probe.height=Math.round(source.height*scale);const pctx=probe.getContext('2d',{willReadFrequently:true});pctx.drawImage(source,0,0,probe.width,probe.height);const d=pctx.getImageData(0,0,probe.width,probe.height).data;for(let i=0;i<d.length;i+=4)hist[Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])]++;
  const c=document.createElement('canvas');c.width=900;c.height=420;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#D8E8F1';ctx.strokeRect(50,25,820,330);const max=Math.max(...hist);ctx.fillStyle='#0AAEF3';for(let i=0;i<256;i++){const h=hist[i]/max*310;ctx.fillRect(50+i*(820/256),345-h,Math.max(1,820/256),h)}ctx.fillStyle='#10204F';ctx.font='28px Arial';ctx.fillText('Histograma de luminosidad',50,395);probe.width=1;probe.height=1;return c;
}
function imageUrlV08(canvas,quality=.84){return canvas.toDataURL('image/jpeg',quality)}

async function recognizeV08(id,canvas,params,mode){
  const started=performance.now(),w=await getWorker(false);await w.setParameters({...params,tessedit_char_whitelist:params.tessedit_char_whitelist??''});const result=await w.recognize(canvas),data=result.data||{};
  const blocks=Array.isArray(data.blocks)?data.blocks:[],lines=Array.isArray(data.lines)?data.lines:[],words=Array.isArray(data.words)?data.words:[];
  return{id,mode,text:data.text||'',confidence:Number.isFinite(data.confidence)?Math.round(data.confidence*10)/10:null,ms:Math.round(performance.now()-started),width:canvas.width,height:canvas.height,psm:params.tessedit_pageseg_mode,lineCount:lines.length,wordCount:words.length,blockCount:blocks.length};
}
function compactV08(p){return{id:p.id,mode:p.mode,confidence:p.confidence,ms:p.ms,width:p.width,height:p.height,psm:p.psm,lineCount:p.lineCount,wordCount:p.wordCount,blockCount:p.blockCount,text:String(p.text||'').trim()}}
function previewV08(label,canvas,pass){return{label,url:imageUrlV08(canvas),confidence:pass?.confidence??null,ms:pass?.ms??null,text:String(pass?.text||'').replace(/\s+/g,' ').trim(),width:canvas.width,height:canvas.height}}

function extractLabelValueV08(text,label,nextLabels=[]){
  const t=normV08(text),escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),next=nextLabels.length?'(?='+nextLabels.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+'|$)':'$';
  const m=t.match(new RegExp(escaped+'\\s*:?\\s*(.*?)'+next));return m?m[1].trim():'';
}
function candidateLinesV08(...texts){return texts.flatMap(linesV08).map(x=>x.replace(/^(LUGAR|FECHA|NACIONALIDAD|SEXO|SANGRE|ESTADO CIVIL|OCUPACION)( DE NACIMIENTO)?\s*:?/,'').trim()).filter(Boolean)}

function extractPlaceV08(directTexts,centerTexts,rules){
  const candidates=[];
  for(const t of [...directTexts,...centerTexts]){
    const anchored=extractLabelValueV08(t,'LUGAR DE NACIMIENTO',['FECHA DE NACIMIENTO','NACIONALIDAD']);if(anchored)candidates.push(anchored);
    candidates.push(...candidateLinesV08(t));
  }
  const scored=candidates.map(value=>{let v=cleanAlphaV08(value).replace(/FECHA.*$/,'').trim();let score=0;if(isGibberishV08(v))score-=30;for(const country of V08_COUNTRIES){if(v.endsWith(country)){score+=40;if(v!==country)v=v.slice(0,-country.length).trim().replace(/,$/,'')+', '+country;break}}const words=v.split(' ').filter(Boolean);score+=Math.min(words.length,5)*3;if(/LUGAR|NACIMIENTO|FECHA|NACIONALIDAD/.test(v))score-=35;return{value:v,score}}).filter(x=>x.value);
  scored.sort((a,b)=>b.score-a.score);const best=scored[0];if(best?.score>5){rules.push(`Lugar de nacimiento elegido por plantilla/etiqueta: ${best.value}`);return best.value}return'';
}
function extractDateV08(...texts){const value=extractBirthDate(...texts);return value}
function extractNationalityV08(...texts){
  const all=texts.map(normV08);for(const t of all){const anchored=extractLabelValueV08(t,'NACIONALIDAD',['SEXO','SANGRE','ESTADO CIVIL','OCUPACION']);for(const country of V08_COUNTRIES)if(anchored.includes(country))return country;for(const country of V08_COUNTRIES)if(t.includes('NACIONALIDAD '+country))return country}return'';
}
function extractSexV08(...texts){for(const t0 of texts){const t=normV08(t0).replace(/0/g,'O');const m=t.match(/SEXO\s*:?\s*([MF])/);if(m)return m[1]}return''}
function extractBloodV08(...texts){for(const t0 of texts){const t=normV08(t0).replace(/0/g,'O');const m=t.match(/SANGRE\s*:?\s*(AB|A|B|O)\s*([+\-])/);if(m)return m[1]+m[2]}return''}
function extractCivilV08(...texts){for(const t0 of texts){const t=normV08(t0);const anchored=extractLabelValueV08(t,'ESTADO CIVIL',['OCUPACION','FECHA DE EXPIRACION']);for(const state of V08_CIVIL)if(anchored.includes(state)||t.includes('ESTADO CIVIL '+state))return state}return''}
function extractOccupationV08(directTexts,centerTexts){
  const texts=[...directTexts,...centerTexts];for(const t0 of texts){const t=normV08(t0),anchored=extractLabelValueV08(t,'OCUPACION',['FECHA DE EXPIRACION']);let v=(anchored||t).replace(/OCUPACION\s*:?/g,' ').replace(/FECHA DE EXPIRACION.*$/,' ').replace(/NACIONALIDAD.*$/,' ').replace(/SEXO.*$/,' ').replace(/ESTADO CIVIL.*$/,' ').replace(/[^A-ZÑ()\s]/g,' ').replace(/\s+/g,' ').trim();if(v&&v.split(' ').length<=7&&!isGibberishV08(v))return v}return'';
}

function cleanNameLineV08(value){return normV08(value).replace(/[^A-ZÑ\s]/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(w=>w.length>1&&!MONTH_SET.has(w)&&!BANNED_WORDS.has(w)).join(' ')}
function nameLinesV08(text){return String(text||'').split(/\n+/).map(cleanNameLineV08).filter(x=>x&&x.split(' ').length<=6)}
function editDistanceV08(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n]}
function scoreNameLineV08(line,role){const words=line.split(' ');let s=words.reduce((a,w)=>a+Math.min(w.length,10),0);if(role==='given'){s+=words.length<=3?16:-12;if(words.some(w=>V08_CONNECTORS.has(w)))s-=8}else{s+=words.length<=5?15:-10;if(words.some(w=>V08_CONNECTORS.has(w)))s+=7;if(V08_CONNECTORS.has(words.at(-1)))s-=30}return s}
function extractNamePairV08(passes,rules){
  const pairs=[],givenCandidates=[],surnameCandidates=[];
  for(const p of passes){const lines=nameLinesV08(p.text);if(lines[0])givenCandidates.push({value:lines[0],pass:p.id,confidence:p.confidence||0});if(lines[1])surnameCandidates.push({value:lines[1],pass:p.id,confidence:p.confidence||0});if(lines.length>=2)pairs.push({given:lines[0],surname:lines[1],pass:p.id,score:(p.confidence||0)+scoreNameLineV08(lines[0],'given')+scoreNameLineV08(lines[1],'surname')})}
  pairs.sort((a,b)=>b.score-a.score);let pair=pairs[0]||{given:'',surname:'',pass:'',score:0};
  if(!pair.given&&givenCandidates.length){givenCandidates.sort((a,b)=>(b.confidence+scoreNameLineV08(b.value,'given'))-(a.confidence+scoreNameLineV08(a.value,'given')));pair.given=givenCandidates[0].value;pair.pass=givenCandidates[0].pass}
  if(!pair.surname&&surnameCandidates.length){surnameCandidates.sort((a,b)=>(b.confidence+scoreNameLineV08(b.value,'surname'))-(a.confidence+scoreNameLineV08(a.value,'surname')));pair.surname=surnameCandidates[0].value}
  const alternatives=surnameCandidates.map(x=>x.value);
  if(pair.surname.startsWith('F')){const pAlt=alternatives.find(x=>x.startsWith('P')&&x.length===pair.surname.length&&editDistanceV08(x,pair.surname)<=1);if(pAlt){rules.push(`Consenso entre pases corrigió ${pair.surname} → ${pAlt}`);pair.surname=pAlt}}
  const givenSet=new Set(pair.given.split(' ')),surWords=pair.surname.split(' '),overlap=surWords.filter(w=>givenSet.has(w)).length/Math.max(1,surWords.length);if(overlap>=.5){rules.push('Apellido rechazado por repetir los nombres');pair.surname=''}
  if(V08_CONNECTORS.has(pair.surname.split(' ').at(-1))){rules.push('Apellido rechazado por terminar en conector');pair.surname=''}
  if(pair.given&&pair.surname)rules.push(`Bloque de nombres ganador: ${pair.pass}`);
  return pair;
}

function setFieldV08(id,value,review=false){const e=document.getElementById(id);if(!e)return;if(value!==undefined&&value!==null&&value!=='')e.value=formatTitleV08(value);e.classList.toggle('field-ok',Boolean(value)&&!review)}
function syncFullNameV08(){const n=document.getElementById('nombresTutor')?.value.trim()||'',a=document.getElementById('apellidosTutor')?.value.trim()||'',f=document.getElementById('nombreTutor');if(f)f.value=[n,a].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()}
function fillFieldsV08(result){
  setFieldV08('nombresTutor',result.nombres,result.nameReview);setFieldV08('apellidosTutor',result.apellidos,result.nameReview);syncFullNameV08();
  const ced=document.getElementById('cedula');if(ced){if(result.cedula)ced.value=result.cedula;ced.classList.toggle('field-ok',Boolean(result.cedula)&&result.cedulaValid)}
  setFieldV08('lugarNacimientoTutor',result.lugarNacimiento,false);setFieldV08('fechaNacimientoTutor',result.fechaNacimiento,false);setFieldV08('nacionalidadTutor',result.nacionalidad,false);
  const sex=document.getElementById('sexoTutor');if(sex){if(result.sexo)sex.value=result.sexo;sex.classList.toggle('field-ok',Boolean(result.sexo))}
  const blood=document.getElementById('tipoSangreTutor');if(blood){if(result.sangre)blood.value=result.sangre;blood.classList.toggle('field-ok',Boolean(result.sangre))}
  setFieldV08('estadoCivilTutor',result.estadoCivil,false);setFieldV08('ocupacionTutor',result.ocupacion,false);
}

function renderLabVisualsV08(assets){
  const grid=document.getElementById('labVisuals');if(!grid)return;grid.innerHTML='';for(const a of assets){const d=document.createElement('div');d.className='lab-item';d.innerHTML=`<strong>${a.label}</strong><img alt="${a.label}" src="${a.url}"><small>${a.meta||''}</small>`;grid.appendChild(d)}
}
function renderDecisionsV08(decisions,rules){const el=document.getElementById('labDecisions');if(!el)return;el.innerHTML=[...decisions.map(x=>`<div><strong>${x.field}</strong><span>Ganador: ${x.winner||'ninguno'}</span><small>${x.reason||''}</small></div>`),...rules.map(x=>`<div class="rule"><strong>Regla aplicada</strong><span>${x}</span></div>`)].join('')}
function drawRegionV08(ctx,canvas,region,value,review=false){drawDiagnosticRegion(ctx,canvas,region,value,review)}
function contactSheetV08(annotated,assets){
  const c=document.createElement('canvas');c.width=1586;c.height=2200;const ctx=c.getContext('2d');ctx.fillStyle='#F3F9FD';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#10204F';ctx.font='700 44px Arial';ctx.fillText('JCF Registro · Laboratorio OCR 0.8.0',40,58);ctx.drawImage(annotated,0,90,1586,1000);
  const positions=[[0,1120],[793,1120],[0,1650],[793,1650]];assets.slice(0,4).forEach((a,i)=>{const img=new Image();img.src=a.url;ctx.fillStyle='#fff';ctx.fillRect(positions[i][0]+10,positions[i][1],773,500);ctx.font='700 26px Arial';ctx.fillStyle='#10204F';ctx.fillText(a.label,positions[i][0]+30,positions[i][1]+38);ctx.drawImage(img,positions[i][0]+20,positions[i][1]+55,753,425)});return c;
}

function correctedV08(){syncFullNameV08();return{cedula:document.getElementById('cedula')?.value.trim()||'',nombres:normV08(document.getElementById('nombresTutor')?.value),apellidos:normV08(document.getElementById('apellidosTutor')?.value),lugarNacimiento:normV08(document.getElementById('lugarNacimientoTutor')?.value),fechaNacimiento:normV08(document.getElementById('fechaNacimientoTutor')?.value),nacionalidad:normV08(document.getElementById('nacionalidadTutor')?.value),sexo:document.getElementById('sexoTutor')?.value||'',sangre:normV08(document.getElementById('tipoSangreTutor')?.value),estadoCivil:normV08(document.getElementById('estadoCivilTutor')?.value),ocupacion:normV08(document.getElementById('ocupacionTutor')?.value)}}

function showDiagnosticV08(card,result,passes,previews,meta,decisions,rules,labAssets,labEnabled){
  const wrap=document.getElementById('diagnosticWrap'),canvas=document.getElementById('diagnosticCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});canvas.width=1269;canvas.height=800;ctx.drawImage(card,0,0,canvas.width,canvas.height);
  drawRegionV08(ctx,canvas,V08_REGIONS.cedula,result.cedula,!result.cedulaValid);drawRegionV08(ctx,canvas,V08_REGIONS.lugarNacimiento,result.lugarNacimiento,false);drawRegionV08(ctx,canvas,V08_REGIONS.fechaNacimiento,result.fechaNacimiento,false);drawRegionV08(ctx,canvas,V08_REGIONS.nacionalidad,result.nacionalidad,false);drawRegionV08(ctx,canvas,V08_REGIONS.identidad,[result.sexo,result.sangre,result.estadoCivil].filter(Boolean).join(' · '),false);drawRegionV08(ctx,canvas,V08_REGIONS.ocupacion,result.ocupacion,false);drawRegionV08(ctx,canvas,V08_REGIONS.nombres,result.nombres,result.nameReview);drawRegionV08(ctx,canvas,V08_REGIONS.apellidos,result.apellidos,result.nameReview);
  const sessionId=newSessionId(),quality=canvasQuality(card),payload={version:JCF_OCR_VERSION,sessionId,createdAt:new Date().toISOString(),detected:result,corrected:null,differences:null,userNote:'',meta:{...meta,quality,userAgent:navigator.userAgent,language:navigator.language,online:navigator.onLine,input:{...(typeof lastInputMeta==='object'&&lastInputMeta?lastInputMeta:{source:'desconocido'})}},regions:V08_REGIONS,decisions,rulesApplied:rules,passes:passes.map(compactV08)};
  const annotated=cloneCanvasV08(canvas),sheet=labEnabled?contactSheetV08(annotated,labAssets):annotated;lastDebug={payload,pngDataUrl:sheet.toDataURL('image/png')};lastLabAssets=labAssets;
  renderDebugCrops(previews);renderLabVisualsV08(labAssets);renderDecisionsV08(decisions,rules);
  document.getElementById('diagnosticMeta').innerHTML=`<span>v0.8.0</span><span>Sesión ${sessionId}</span><span>${meta.totalMs} ms</span><span>${quality.assessment}</span><span>${passes.reduce((a,p)=>a+p.wordCount,0)} palabras</span>`;
  document.getElementById('diagnosticText').textContent=debugTextV08();wrap.style.display='block';wrap.scrollIntoView({behavior:'smooth',block:'start'});
  [annotated,sheet].forEach(x=>{if(x!==canvas){x.width=1;x.height=1}});
}
function buildPayloadV08(){if(!lastDebug)return null;const p=JSON.parse(JSON.stringify(lastDebug.payload)),c=correctedV08();p.corrected=c;p.userNote=document.getElementById('debugNote')?.value.trim()||'';p.differences={};for(const k of Object.keys(c))p.differences[k]=normV08(p.detected[k])!==normV08(c[k]);return p}
function debugTextV08(){const p=buildPayloadV08();if(!p)return'';return['JCF REGISTRO · INFORME OCR LABORATORIO',`Versión: ${p.version}`,`Sesión: ${p.sessionId}`,`Fecha: ${p.createdAt}`,'','DETECTADO',...Object.entries(p.detected).filter(([k])=>!['cedulaValid','nameReview'].includes(k)).map(([k,v])=>`${k}: ${v||'NO DETECTADO'}`),`Cédula verificada: ${p.detected.cedulaValid?'SÍ':'NO'}`,'','CORREGIDO POR EL USUARIO',...Object.entries(p.corrected).map(([k,v])=>`${k}: ${v||'—'}`),'',`DIFERENCIAS: ${JSON.stringify(p.differences)}`,'',`DECISIONES: ${JSON.stringify(p.decisions)}`,`REGLAS: ${JSON.stringify(p.rulesApplied)}`,'',`META: ${JSON.stringify(p.meta)}`,'',...p.passes.map(x=>`[${x.id}] conf=${x.confidence??'—'}% ${x.ms}ms ${x.width}x${x.height} líneas=${x.lineCount} palabras=${x.wordCount}\n${x.text||'—'}`),'',`NOTA DEL USUARIO: ${p.userNote||'—'}`].join('\n')}
buildDebugPayload=buildPayloadV08;debugText=debugTextV08;

async function readCedulaV08(){
  if(!sourceImage){setStatus('ocrStatus','Primero toma o selecciona una fotografía.','warn');return}
  const labEnabled=document.getElementById('labModeToggle')?.checked!==false,started=performance.now(),sourceWidth=sourceImage.naturalWidth,sourceHeight=sourceImage.naturalHeight,cropRatio=(crop.w/Math.max(1,crop.h)).toFixed(3),rotationUsed=rotation,btn=document.getElementById('readBtn');btn.disabled=true;setProgress('ocrProgress','ocrBar',2);setStatus('ocrStatus',labEnabled?'Modo laboratorio: analizando plantilla, contrastes y campos…':'Analizando cédula…');
  const canvases=[],passes=[],previews=[],rules=[],decisions=[];let card;
  try{
    card=makeCardCanvas();const make=(region,mode)=>{const c=cropV08(card,region,mode);canvases.push(c);return c};
    const fields={numG:make(V08_REGIONS.cedula,'gray'),numB:make(V08_REGIONS.cedula,'binary'),placeG:make(V08_REGIONS.lugarNacimiento,'gray'),placeB:make(V08_REGIONS.lugarNacimiento,'binary'),dateG:make(V08_REGIONS.fechaNacimiento,'gray'),dateB:make(V08_REGIONS.fechaNacimiento,'binary'),identityG:make(V08_REGIONS.identidad,'gray'),identityB:make(V08_REGIONS.identidad,'binary'),occG:make(V08_REGIONS.ocupacion,'gray'),occB:make(V08_REGIONS.ocupacion,'binary'),nameG:make(V08_REGIONS.nombreBloque,'gray'),nameB:make(V08_REGIONS.nombreBloque,'binary'),centerG:make(V08_REGIONS.centro,'gray'),centerB:make(V08_REGIONS.centro,'binary')};
    const run=async(id,key,psm,whitelist,mode,progress)=>{const p=await recognizeV08(id,fields[key],{tessedit_pageseg_mode:psm,tessedit_char_whitelist:whitelist||'',preserve_interword_spaces:'1'},mode);passes.push(p);previews.push(previewV08(id,fields[key],p));setProgress('ocrProgress','ocrBar',progress);return p};
    const numG=await run('numero_gris','numG',Tesseract.PSM.SINGLE_LINE,'0123456789- OQDILZSBG','gray',8),numB=await run('numero_binario','numB',Tesseract.PSM.SINGLE_LINE,'0123456789- OQDILZSBG','binary',14);
    const placeG=await run('lugar_valor_gris','placeG',Tesseract.PSM.SINGLE_LINE,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ, ','gray',20),placeB=await run('lugar_valor_binario','placeB',Tesseract.PSM.SINGLE_LINE,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ, ','binary',26);
    const dateG=await run('fecha_valor_gris','dateG',Tesseract.PSM.SINGLE_LINE,'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ ','gray',32),dateB=await run('fecha_valor_binaria','dateB',Tesseract.PSM.SINGLE_LINE,'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ ','binary',38);
    const identityG=await run('identidad_gris','identityG',Tesseract.PSM.SPARSE_TEXT,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ0123456789:+-() ','gray',44),identityB=await run('identidad_binaria','identityB',Tesseract.PSM.SPARSE_TEXT,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ0123456789:+-() ','binary',50);
    const occG=await run('ocupacion_valor_gris','occG',Tesseract.PSM.SINGLE_LINE,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ() ','gray',56),occB=await run('ocupacion_valor_binaria','occB',Tesseract.PSM.SINGLE_LINE,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ() ','binary',62);
    const nameG=await run('nombres_bloque_gris','nameG',Tesseract.PSM.SPARSE_TEXT,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ ','gray',70),nameB=await run('nombres_bloque_binario','nameB',Tesseract.PSM.SPARSE_TEXT,'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ ','binary',78);
    const centerG=await run('centro_etiquetas_gris','centerG',Tesseract.PSM.SPARSE_TEXT,'','gray',86),centerB=await run('centro_etiquetas_binario','centerB',Tesseract.PSM.SPARSE_TEXT,'','binary',93);
    const centerTexts=[centerG.text,centerB.text],cedula=extractCedula(numG.text,numB.text,...centerTexts),cedulaValid=validateCedula(cedula);decisions.push({field:'Cédula',winner:cedula?([numG,numB].sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0].id):'',reason:cedulaValid?'Formato y dígito verificador válidos':'Requiere revisión'});
    const lugarNacimiento=extractPlaceV08([placeG.text,placeB.text],centerTexts,rules);decisions.push({field:'Lugar de nacimiento',winner:lugarNacimiento?'plantilla + etiqueta':'',reason:lugarNacimiento||'No detectado'});
    const fechaNacimiento=extractDateV08(dateG.text,dateB.text,...centerTexts);decisions.push({field:'Fecha de nacimiento',winner:fechaNacimiento?'fecha_valor/centro':'',reason:fechaNacimiento||'No detectada'});
    const nacionalidad=extractNationalityV08(identityG.text,identityB.text,...centerTexts),sexo=extractSexV08(identityG.text,identityB.text,...centerTexts),sangre=extractBloodV08(identityG.text,identityB.text,...centerTexts),estadoCivil=extractCivilV08(identityG.text,identityB.text,...centerTexts),ocupacion=extractOccupationV08([occG.text,occB.text],centerTexts);
    decisions.push({field:'Identidad',winner:'identidad + centro',reason:[nacionalidad,sexo,sangre,estadoCivil].filter(Boolean).join(' · ')||'No detectado'});decisions.push({field:'Ocupación',winner:ocupacion?'ocupacion_valor/centro':'',reason:ocupacion||'No detectada'});
    const namePair=extractNamePairV08([nameG,nameB],rules),nombres=namePair.given,apellidos=namePair.surname,nombre=[nombres,apellidos].filter(Boolean).join(' '),nameReview=!nombres||!apellidos;decisions.push({field:'Nombres y apellidos',winner:namePair.pass,reason:nombre||'No detectado'});
    const result={cedula,cedulaValid,nombres,apellidos,nombre,lugarNacimiento,fechaNacimiento,nacionalidad,sexo,sangre,estadoCivil,ocupacion,nameReview};fillFieldsV08(result);
    const labAssets=[];if(labEnabled){const gray=grayCanvasV08(card),binary=binaryCanvasV08(card),edges=edgeCanvasV08(card),hist=histogramCanvasV08(card);canvases.push(gray,binary,edges,hist);labAssets.push({label:'Imagen normalizada',url:imageUrlV08(card),meta:`${card.width}×${card.height}`},{label:'Contraste en gris',url:imageUrlV08(gray),meta:'Normalización de iluminación'},{label:'Blanco y negro',url:imageUrlV08(binary),meta:'Umbral adaptado'},{label:'Mapa de bordes',url:imageUrlV08(edges),meta:'Nitidez y líneas'},{label:'Histograma',url:imageUrlV08(hist),meta:'Distribución de luz'})}else labAssets.push({label:'Imagen normalizada',url:imageUrlV08(card),meta:`${card.width}×${card.height}`});
    const meta={totalMs:Math.round(performance.now()-started),sourceWidth,sourceHeight,rotation:rotationUsed,cropRatio,templateRatioTarget:1.586,cropRatioError:Math.round(Math.abs(Number(cropRatio)-1.586)*1000)/1000,cardWidth:card.width,cardHeight:card.height,displayScale:display.scale,crop:{x:Math.round(crop.x),y:Math.round(crop.y),w:Math.round(crop.w),h:Math.round(crop.h)},labMode:labEnabled};showDiagnosticV08(card,result,passes,previews,meta,decisions,rules,labAssets,labEnabled);setProgress('ocrProgress','ocrBar',100);
    const missing=[];if(!cedulaValid)missing.push('cédula');if(!nombres||!apellidos)missing.push('nombre/apellidos');if(!lugarNacimiento)missing.push('lugar de nacimiento');if(!fechaNacimiento)missing.push('fecha');if(!sexo)missing.push('sexo');if(!ocupacion)missing.push('ocupación');setStatus('ocrStatus',missing.length?`Lectura con observaciones: revisa ${missing.join(', ')}. Corrige los campos y comparte el paquete de laboratorio.`:'Lectura completa. Revisa los campos y comparte el paquete de laboratorio cuando quieras. ',missing.length?'warn':'ok');
  }catch(err){console.error(err);setStatus('ocrStatus','No pude completar la lectura. Ajusta el recorte exactamente a los bordes de la cédula e inténtalo otra vez.','error')}
  finally{for(const c of canvases){c.width=1;c.height=1}if(card){card.width=1;card.height=1}clearImageMemory();document.getElementById('editorWrap').style.display='none';const cam=document.getElementById('cedulaCamara'),gal=document.getElementById('cedulaFoto');if(cam)cam.value='';if(gal)gal.value='';btn.disabled=false;setTimeout(()=>setProgress('ocrProgress','ocrBar',null),1000)}
}
readCedula=readCedulaV08;
document.getElementById('readBtn')?.addEventListener('click',readCedulaV08);
