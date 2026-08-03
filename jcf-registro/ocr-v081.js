'use strict';
const JCF_OCR_VERSION_081='JCF-WEB-OCR-0.8.1';
let lastNameConsensusV081={};
function normalized081(v){return cleanPersonLineV07(v).replace(/\s+/g,' ').trim()}
function candidateScore081(value,role,given,hasLong){
  const words=normalized081(value).split(' ').filter(Boolean);if(!words.length)return-999;
  let score=scoreNameCandidateV07(value,role),short=words.filter(w=>!CONNECTORS.has(w)&&w.length<=3).length,long=words.filter(w=>!CONNECTORS.has(w)&&w.length>=4).length;
  if(role==='given'){
    score+=words.length===2?60:words.length===3?35:words.length===1?0:-20;
    score+=long*9-short*22;
    if(words.some(w=>CONNECTORS.has(w)))score-=30;
    if(hasLong&&words.length===1)score-=70;
    if(words.length===1&&words[0].length<=3)score-=65;
  }else{
    if(words.length>=2&&words.length<=5)score+=45;
    if(words.some(w=>CONNECTORS.has(w)))score+=18;
    if(hasLong&&words.length===1)score-=35;
    const gt=new Set(normalized081(given).split(' ').filter(Boolean)),overlap=words.filter(w=>gt.has(w)).length/words.length;
    if(overlap>=.5)score-=100;else if(overlap>0)score-=25;
  }
  return score;
}
consensusNameV08=function(entries,role,given=''){
  const clean=entries.map(e=>({...e,value:normalized081(e.value)})).filter(e=>e.value);if(!clean.length)return{value:'',confidence:0,source:''};
  const hasLong=clean.some(e=>e.value.split(' ').length>=2),groups=new Map();
  for(const e of clean){if(!groups.has(e.value))groups.set(e.value,[]);groups.get(e.value).push(e)}
  const ranked=[...groups].map(([value,list])=>{
    const conf=Math.max(...list.map(e=>Number(e.confidence)||0)),sources=[...new Set(list.map(e=>e.source||''))];
    const avg=list.reduce((s,e)=>s+(Number(e.confidence)||0),0)/list.length;
    const score=candidateScore081(value,role,given,hasLong)+conf+avg*.35+(list.length-1)*38+(sources.length-1)*24;
    return{value,list,conf,sources,score};
  }).sort((a,b)=>b.score-a.score||b.list.length-a.list.length||b.conf-a.conf||b.value.length-a.value.length);
  const win=ranked[0];lastNameConsensusV081[role]={winner:win.value,count:win.list.length,score:Math.round(win.score*10)/10,candidates:ranked.slice(0,6).map(x=>({value:x.value,count:x.list.length,confidence:x.conf,score:Math.round(x.score*10)/10}))};
  return{value:win.value,confidence:win.conf,source:win.sources.join(',')};
};
const show081=showDiagnostic;
showDiagnostic=function(card,result,passes,previews,meta){show081(card,result,passes,previews,meta);if(lastDebug?.payload){lastDebug.payload.version=JCF_OCR_VERSION_081;lastDebug.payload.nameConsensus=lastNameConsensusV081}const m=document.getElementById('diagnosticMeta')?.querySelector('span');if(m)m.textContent='v0.8.1';const t=document.getElementById('diagnosticText');if(t)t.textContent=debugText()};
const payload081=buildDebugPayload;
buildDebugPayload=function(){const p=payload081();if(p){p.version=JCF_OCR_VERSION_081;p.nameConsensus=lastNameConsensusV081}return p};
