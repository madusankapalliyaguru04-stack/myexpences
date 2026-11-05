/* Shared helpers: used by the page and by the service worker (no DOM access here). */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('expdb',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(k){const d=await idb();return new Promise(res=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined)})}
async function idbSet(k,v){const d=await idb();return new Promise(res=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>res()})}
const fmtRs=n=>'Rs. '+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});

function monthSummary(tx,cm,mk,accts){
  const l=tx.filter(t=>t.date.startsWith(mk));let i=0,e=0;const by={};
  l.forEach(t=>{if(t.type==='i')i+=t.amt;else{e+=t.amt;by[t.cat]=(by[t.cat]||0)+t.amt}});
  const top=Object.keys(by).sort((a,b)=>by[b]-by[a])[0];
  const [y,m]=mk.split('-');
  const name=new Date(+y,+m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const lines=['Income '+fmtRs(i)+' • Spent '+fmtRs(e)+' • Balance '+fmtRs(i-e)];
  (accts||[]).forEach(a=>{
    let ai=0,ae=0;
    l.filter(t=>(t.acct||'a1')===a.id).forEach(t=>{if(t.type==='i')ai+=t.amt;else ae+=t.amt});
    if(ai||ae)lines.push(a.nm+': in '+fmtRs(ai)+' • out '+fmtRs(ae));
  });
  if(top)lines.push('Top spending: '+(cm[top]||'Other')+' ('+fmtRs(by[top])+')');
  return{title:'Monthly summary – '+name,body:lines.join('\n')};
}
function dueKeys(now){
  const p=n=>String(n).padStart(2,'0'),y=now.getFullYear(),m=now.getMonth(),out=[];
  if(now.getDate()===new Date(y,m+1,0).getDate())out.push(y+'-'+p(m+1));
  if(now.getDate()<=3){const q=new Date(y,m-1,1);out.push(q.getFullYear()+'-'+p(q.getMonth()+1))}
  return out;
}
async function runCheck(reg){
  if(!('Notification' in self)||Notification.permission!=='granted')return false;
  const tx=(await idbGet('tx'))||[],cm=(await idbGet('catmap'))||{},ac=(await idbGet('accts'))||[],done=(await idbGet('notified'))||[];
  for(const mk of dueKeys(new Date())){
    if(done.includes(mk)||!tx.some(t=>t.date.startsWith(mk)))continue;
    const s=monthSummary(tx,cm,mk,ac);
    await reg.showNotification(s.title,{body:s.body,icon:'icon-192.png',badge:'icon-192.png',tag:'month-'+mk});
    done.push(mk);await idbSet('notified',done);return true;
  }
  return false;
}
