const OCR_REGIONS={
  cedula:{x:.29,y:.10,w:.68,h:.27,label:'Número de cédula'},
  nombre:{x:.015,y:.70,w:.75,h:.295,label:'Nombre completo'},
  fecha:{x:.245,y:.33,w:.62,h:.235,label:'Fecha de nacimiento'}
};

function regionCanvas(card,rx,ry,rw,rh,mode='gray'){
  const x=Math.round(card.width*rx),y=Math.round(card.height*ry),w=Math.round(card.width*rw),h=Math.round(card.height*rh);
  const scale=Math.min(2.5,2000/Math.max(1,w));
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

const BANNED=/REPUBLICA|DOMINICANA|JUNTA|CENTRAL|ELECTORAL|CEDULA|IDENTIDAD|NACIMIENTO|NACIONALIDAD|SEXO|SANGRE|ESTADO|CIVIL|OCUPACION|EXPIRACION|LUGAR|SOLTER|CASAD|FECHA|CUBA|HABANA|PUBLICO|EMPLEADO|COMERCIANTE|EMPRESARIO|MEDICO/i;
function normalizeNameLine(line){return line.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-ZÑ\s]/g,' ').replace(/\s+/g,' ').trim()}
function extractName(...texts){
  for(const raw of texts){
    const lines=String(raw||'').split(/\n+/).map(normalizeNameLine).filter(Boolean).filter(s=>s.length>=3&&!BANNED.test(s));
    const usable=lines.filter(s=>{const words=s.split(' ').filter(Boolean);return words.length>=1&&words.length<=6&&words.every(w=>w.length>=2||w==='DE'||w==='LA'||w==='DEL')});
    if(!usable.length)continue;
    const selected=[];
    for(const line of usable){if(!selected.some(x=>x===line||x.includes(line)))selected.push(line)}
    const candidate=selected.slice(-3).join(' ').replace(/\s+/g,' ').trim();
    const words=candidate.split(' ').filter(Boolean);
    if(words.length>=2&&words.length<=8)return candidate;
  }
  return'';
}

const MONTHS='ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE';
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

async function recognize(canvas,params){const w=await getWorker(false);await w.setParameters(params);const result=await w.recognize(canvas);return result.data||{text:''}}

function drawDiagnosticRegion(ctx,canvas,region,value){
  const x=canvas.width*region.x,y=canvas.height*region.y,w=canvas.width*region.w,h=canvas.height*region.h,ok=Boolean(value);
  ctx.save();ctx.strokeStyle=ok?'#16A36A':'#F59E0B';ctx.lineWidth=Math.max(5,canvas.width*.005);ctx.setLineDash(ok?[]:[18,12]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
  const label=`${ok?'✓':'!'} ${region.label}: ${value||'NO DETECTADO'}`;ctx.font=`700 ${Math.max(22,canvas.width*.021)}px -apple-system, Arial`;const pad=12,textW=ctx.measureText(label).width,boxH=Math.max(38,canvas.height*.052),boxW=Math.min(canvas.width-x,textW+pad*2);
  ctx.fillStyle=ok?'rgba(22,163,106,.92)':'rgba(245,158,11,.94)';ctx.fillRect(x,Math.max(0,y-boxH),boxW,boxH);ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText(label,x+pad,Math.max(boxH/2,y-boxH/2),boxW-pad*2);ctx.restore();
}

function showDiagnostic(card,{cedula,nombre,fecha,rawNumber='',rawName='',rawDate=''}){
  const wrap=document.getElementById('diagnosticWrap'),canvas=document.getElementById('diagnosticCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  canvas.width=1269;canvas.height=800;ctx.drawImage(card,0,0,canvas.width,canvas.height);
  drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.cedula,cedula);drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.fecha,fecha);drawDiagnosticRegion(ctx,canvas,OCR_REGIONS.nombre,nombre);
  const report=[`Cédula: ${cedula||'NO DETECTADA'}`,`Nombre: ${nombre||'NO DETECTADO'}`,`Fecha: ${fecha||'NO DETECTADA'}`,`Texto número: ${String(rawNumber).replace(/\s+/g,' ').trim()||'—'}`,`Texto nombre: ${String(rawName).replace(/\s+/g,' ').trim()||'—'}`,`Texto fecha: ${String(rawDate).replace(/\s+/g,' ').trim()||'—'}`].join('\n');
  document.getElementById('diagnosticText').textContent=report;wrap.dataset.report=report;wrap.style.display='block';
}

async function copyDiagnostic(){const wrap=document.getElementById('diagnosticWrap'),text=wrap.dataset.report||'';try{await navigator.clipboard.writeText(text);setStatus('ocrStatus','Diagnóstico copiado. Puedes pegarlo junto con la captura.')}catch{setStatus('ocrStatus','No se pudo copiar automáticamente. Envía una captura del diagnóstico.','warn')}}

async function readCedula(){
  if(!sourceImage){setStatus('ocrStatus','Primero toma o selecciona una fotografía.','warn');return}
  const btn=document.getElementById('readBtn');btn.disabled=true;setProgress('ocrProgress','ocrBar',3);setStatus('ocrStatus','Preparando la imagen…');
  let card,numberGray,numberBinary,numberWide,nameGray,nameBinary,dateGray,fullC;
  try{
    card=makeCardCanvas();
    numberGray=regionCanvas(card,.29,.10,.68,.27,'gray');numberBinary=regionCanvas(card,.29,.10,.68,.27,'binary');numberWide=regionCanvas(card,.22,.07,.76,.32,'gray');
    nameGray=regionCanvas(card,.015,.70,.75,.295,'gray');nameBinary=regionCanvas(card,.015,.70,.75,.295,'binary');
    dateGray=regionCanvas(card,.245,.33,.62,.235,'gray');
    setProgress('ocrProgress','ocrBar',8);
    const number1=await recognize(numberGray,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789- OQDILZSBG'});setProgress('ocrProgress','ocrBar',22);
    const number2=await recognize(numberBinary,{tessedit_pageseg_mode:Tesseract.PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789- OQDILZSBG'});setProgress('ocrProgress','ocrBar',35);
    const number3=await recognize(numberWide,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'0123456789- OQDILZSBG'});setProgress('ocrProgress','ocrBar',48);
    const name1=await recognize(nameGray,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '});setProgress('ocrProgress','ocrBar',62);
    const name2=await recognize(nameBinary,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '});setProgress('ocrProgress','ocrBar',75);
    const date1=await recognize(dateGray,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '});
    let cedula=extractCedula(number1.text,number2.text,number3.text),nombre=extractName(name1.text,name2.text),fecha=extractBirthDate(date1.text),fullText='';
    if(!cedula||!nombre||!fecha){
      fullC=document.createElement('canvas');fullC.width=1269;fullC.height=800;fullC.getContext('2d',{willReadFrequently:true}).drawImage(card,0,0,fullC.width,fullC.height);enhanceCanvas(fullC,'gray');
      const full=await recognize(fullC,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,preserve_interword_spaces:'1'});fullText=full.text||'';
      cedula=cedula||extractCedula(fullText);fecha=fecha||extractBirthDate(date1.text,fullText);
      if(!nombre){const lower=regionCanvas(card,0,.66,.82,.34,'gray');const lowerData=await recognize(lower,{tessedit_pageseg_mode:Tesseract.PSM.SPARSE_TEXT,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ '});nombre=extractName(lowerData.text);lower.width=1;lower.height=1}
    }
    if(cedula){const e=document.getElementById('cedula');e.value=cedula;e.classList.add('field-ok')}else{document.getElementById('cedula').classList.remove('field-ok')}
    if(nombre){const e=document.getElementById('nombreTutor');e.value=nombre;e.classList.add('field-ok')}else{document.getElementById('nombreTutor').classList.remove('field-ok')}
    if(fecha){const e=document.getElementById('fechaNacimientoTutor');e.value=fecha;e.classList.add('field-ok')}else{document.getElementById('fechaNacimientoTutor').classList.remove('field-ok')}
    showDiagnostic(card,{cedula,nombre,fecha,rawNumber:[number1.text,number2.text,number3.text].join(' | '),rawName:[name1.text,name2.text].join(' | '),rawDate:date1.text});
    setProgress('ocrProgress','ocrBar',100);
    if(cedula&&nombre)setStatus('ocrStatus','Lectura completada. Revisa los datos y mira el diagnóstico debajo.');
    else{const missing=[!cedula?'número de cédula':'',!nombre?'nombre':'',!fecha?'fecha':''].filter(Boolean).join(', ');setStatus('ocrStatus',`Lectura incompleta: faltó ${missing}. Mira los recuadros del diagnóstico y envíame una captura.`,'warn')}
  }catch(err){console.error(err);setStatus('ocrStatus','No pude leer la imagen. Prueba con más luz, menos inclinación y la cédula ocupando casi toda la foto.','error')}
  finally{
    [numberGray,numberBinary,numberWide,nameGray,nameBinary,dateGray,fullC,card].forEach(c=>{if(c){c.width=1;c.height=1}});
    clearImageMemory();document.getElementById('editorWrap').style.display='none';
    const camera=document.getElementById('cedulaCamara'),gallery=document.getElementById('cedulaFoto');if(camera)camera.value='';if(gallery)gallery.value='';
    btn.disabled=false;setTimeout(()=>setProgress('ocrProgress','ocrBar',null),1000);
  }
}

function clearImageMemory(){sourceImage=null;if(imageObjectUrl){URL.revokeObjectURL(imageObjectUrl);imageObjectUrl=null}cropCanvas.width=1;cropCanvas.height=1}