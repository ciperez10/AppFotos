const _buildDebugPayloadBase=buildDebugPayload;
buildDebugPayload=function(){
  const payload=_buildDebugPayloadBase();
  if(!payload)return null;
  payload.userNote=document.getElementById('debugNote')?.value.trim()||'';
  payload.meta.input={...(typeof lastInputMeta==='object'&&lastInputMeta?lastInputMeta:{source:'desconocido'})};
  return payload;
};
const _debugTextBase=debugText;
debugText=function(){
  const base=_debugTextBase();
  const payload=buildDebugPayload();
  if(!payload)return base;
  const input=payload.meta.input||{};
  return `${base}\n\nNOTA DEL USUARIO\n${payload.userNote||'—'}\n\nORIGEN DE IMAGEN\nFuente: ${input.source||'desconocido'}\nTipo: ${input.type||'—'}\nTamaño: ${input.size||0} bytes\nÚltima modificación: ${input.lastModified||'—'}`;
};

// Ajustes 0.7.1 derivados de diagnósticos reales.
pickSurnameV07=function(surnamePasses,combinedPasses,given){
  const candidates=[],givenTokens=new Set(cleanPersonLineV07(given).split(' ').filter(Boolean));
  const add=(value,confidence,source,priority=0)=>{
    value=cleanPersonLineV07(value);if(!value||value===given)return;
    const words=value.split(' ');
    for(let size=1;size<=Math.min(5,words.length);size++)for(let i=0;i<=words.length-size;i++){
      const candidateWords=words.slice(i,i+size),candidate=candidateWords.join(' ');
      if(candidate===given)continue;
      const overlap=candidateWords.filter(word=>givenTokens.has(word)).length/candidateWords.length;
      if(overlap>=.6)continue;
      candidates.push({value:candidate,score:scoreNameCandidateV07(candidate,'surname')+priority+(confidence||0)/15,source});
    }
  };
  for(const pass of surnamePasses)uniqueNameLinesV07(pass.text).forEach(line=>add(line,pass.confidence,pass.id,18));
  for(const pass of combinedPasses){const lines=uniqueNameLinesV07(pass.text);lines.slice(1).forEach(line=>add(line,pass.confidence,pass.id,10));if(lines.length===1&&lines[0]!==given)add(lines[0],pass.confidence,pass.id,4)}
  candidates.sort((a,b)=>b.score-a.score||b.value.length-a.value.length);
  const best=candidates[0];if(!best)return{value:'',score:0,source:''};
  const words=best.value.split(' '),last=words[words.length-1];
  if(CONNECTORS.has(last))return{value:'',score:best.score,source:best.source};
  if(words.length===1&&String(best.source).startsWith('nombre_completo')&&best.score<35)return{value:'',score:best.score,source:best.source};
  return best;
};

extractOccupationV07=function(...texts){
  for(const raw of texts){
    const normalized=normalizeOCRText(raw),explicit=normalized.match(/OCUPACION\s*:?\s*(.*?)(?=FECHA\s+(?:DE\s+)?EXPIRACION|$)/);
    let text=(explicit?explicit[1]:normalized).replace(/FECHA\s+(DE\s+)?EXPIRACION.*$/g,' ').replace(/SEXO.*$/g,' ').replace(/[^A-ZÑ()\s]/g,' ').replace(/\s+/g,' ').trim();
    if(!text||/^(OCUPACION|FECHA|EXPIRACION)$/.test(text))continue;
    const words=text.split(' ').filter(word=>!['OCUPACION','FECHA','EXPIRACION'].includes(word));
    if(words.length)return words.slice(0,6).join(' ');
  }
  return'';
};

const _showDiagnosticV07=showDiagnostic;
showDiagnostic=function(card,result,passes,previews,meta){
  _showDiagnosticV07(card,result,passes,previews,meta);
  const canvas=document.getElementById('diagnosticCanvas'),ctx=canvas?.getContext('2d');
  if(ctx){
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(card,0,0,canvas.width,canvas.height);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.cedula,result.cedula,!result.cedulaValid);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.lugarNacimiento,result.lugarNacimiento,false);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.fecha,result.fecha,false);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.sexo,result.sexo,false);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.ocupacion,result.ocupacion,false);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.nombre1,result.given,result.nameReview);
    drawDiagnosticRegion(ctx,canvas,OCR_REGIONS_V07.nombre2,result.surname,result.nameReview);
  }
  if(lastDebug?.payload){lastDebug.payload.version='JCF-WEB-OCR-0.7.1';lastDebug.payload.detected=result;lastDebug.payload.regions=OCR_REGIONS_V07;lastDebug.pngDataUrl=canvas.toDataURL('image/png')}
  const metaEl=document.getElementById('diagnosticMeta');
  if(metaEl&&lastDebug?.payload)metaEl.innerHTML=`<span>v0.7.1</span><span>Sesión ${lastDebug.payload.sessionId}</span><span>${meta.totalMs} ms</span><span>${lastDebug.payload.meta.quality?.assessment||'diagnóstico'}</span>`;
  const textEl=document.getElementById('diagnosticText');if(textEl)textEl.textContent=debugText();
};
