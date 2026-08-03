function loadRecords(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return[]}}
function saveRecords(records){localStorage.setItem(STORAGE_KEY,JSON.stringify(records))}
function maskCedula(v){const n=(v||'').replace(/\D/g,'');return n.length===11?'***-*******-'+n.slice(-1):'Sin cédula'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderRecords(){
  const records=loadRecords(),list=document.getElementById('recordsList');
  document.getElementById('recordCount').textContent=String(records.length);
  if(!records.length){list.innerHTML='<div class="empty">Todavía no hay registros.</div>';return}
  list.innerHTML=records.slice().reverse().map(r=>`<div class="record"><strong>${escapeHtml(r.nino)} · ${escapeHtml(r.edad||'Edad no indicada')} años</strong><small>Tutor: ${escapeHtml(r.tutor)} · ${escapeHtml(maskCedula(r.cedula))}</small><small>${escapeHtml(r.comunidad||'Sector no indicado')} · ${escapeHtml(r.actividad)}</small></div>`).join('')
}
renderRecords();

document.getElementById('saveBtn').addEventListener('click',()=>{
  if(typeof syncTutorFullNameV07==='function')syncTutorFullNameV07();
  const nombres=document.getElementById('nombresTutor')?.value.trim()||'';
  const apellidos=document.getElementById('apellidosTutor')?.value.trim()||'';
  const tutor=[nombres,apellidos].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  const record={
    id:(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)),createdAt:new Date().toISOString(),
    nombresTutor:nombres,apellidosTutor:apellidos,tutor,
    cedula:document.getElementById('cedula').value.trim(),
    lugarNacimientoTutor:document.getElementById('lugarNacimientoTutor')?.value.trim()||'',
    fechaNacimientoTutor:document.getElementById('fechaNacimientoTutor').value.trim(),
    sexoTutor:document.getElementById('sexoTutor')?.value||'',
    ocupacionTutor:document.getElementById('ocupacionTutor')?.value.trim()||'',
    telefono:document.getElementById('telefono').value.trim(),comunidad:document.getElementById('comunidad').value.trim(),
    nino:document.getElementById('nombreNino').value.trim(),edad:document.getElementById('edad').value.trim(),sexo:document.getElementById('sexo').value,
    actividad:document.getElementById('actividad').value.trim(),consentimiento:document.getElementById('consentimiento').checked?'Sí':'No'
  };
  if(!record.tutor||!record.telefono||!record.nino){setStatus('saveStatus','Completa nombres y apellidos del tutor, teléfono y nombre del niño.','warn');return}
  if(record.consentimiento!=='Sí'){setStatus('saveStatus','El padre o tutor debe aceptar la autorización.','warn');return}
  const records=loadRecords(),duplicate=records.some(r=>r.cedula&&record.cedula&&r.cedula===record.cedula&&String(r.nino||'').toUpperCase()===record.nino.toUpperCase());
  if(duplicate&&!confirm('Parece que este tutor y niño ya están registrados. ¿Deseas guardarlo otra vez?'))return;
  records.push(record);saveRecords(records);renderRecords();setStatus('saveStatus','Registro guardado en este iPhone.');
  ['nombreNino','edad'].forEach(id=>document.getElementById(id).value='');document.getElementById('sexo').value='';document.getElementById('consentimiento').checked=false
});

function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
document.getElementById('exportBtn').addEventListener('click',async()=>{
  const records=loadRecords();if(!records.length){alert('Todavía no hay registros para exportar.');return}
  const headers=['Fecha de registro','Nombres tutor','Apellidos tutor','Cedula','Lugar nacimiento tutor','Fecha nacimiento tutor','Sexo tutor','Ocupacion tutor','Telefono','Comunidad','Niño','Edad','Sexo niño','Actividad','Consentimiento'];
  const rows=records.map(r=>[r.createdAt,r.nombresTutor||'',r.apellidosTutor||'',r.cedula,r.lugarNacimientoTutor||'',r.fechaNacimientoTutor,r.sexoTutor||'',r.ocupacionTutor||'',r.telefono,r.comunidad,r.nino,r.edad,r.sexo,r.actividad,r.consentimiento]);
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n'),file=new File([csv],'registros_jcf_'+new Date().toISOString().slice(0,10)+'.csv',{type:'text/csv;charset=utf-8'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Registros JCF'});return}catch(e){if(e.name==='AbortError')return}}
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
});
document.getElementById('clearBtn').addEventListener('click',()=>{if(confirm('¿Seguro que deseas borrar todos los registros guardados en este iPhone?')){localStorage.removeItem(STORAGE_KEY);renderRecords();setStatus('saveStatus','Los registros locales fueron borrados.','warn')}});
window.addEventListener('beforeunload',clearImageMemory);
