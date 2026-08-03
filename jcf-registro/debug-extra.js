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
