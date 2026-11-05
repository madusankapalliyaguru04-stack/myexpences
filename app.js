(()=>{
'use strict';

/* ================= helpers ================= */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const SIN=/[\u0D80-\u0DFF]/;               // used only to migrate old saved names
const KEY='expenses_v1',CK='cats_v1',AK='accts_v1',CUR='acct_cur';
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
};
const money=n=>'Rs. '+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const mkey=d=>ymd(d).slice(0,7);
const fmtDate=s=>{const[p,q,r]=s.split('-');return new Date(+p,+q-1,+r).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ================= defaults & state ================= */
const defCats=()=>({
  e:[['e0','🍽️','Food'],['e1','🚌','Transport'],['e2','🛒','Shopping'],['e3','💡','Bills'],['e4','🏠','Home'],['e5','💊','Health'],['e6','🎬','Fun'],['e7','📚','Education']].map(([id,ic,nm])=>({id,ic,nm})),
  i:[['i0','💼','Salary'],['i1','🎁','Gifts'],['i2','📈','Business'],['i3','💰','Other']].map(([id,ic,nm])=>({id,ic,nm}))
});
const defAccts=()=>[{id:'a1',ic:'💵',nm:'Cash'},{id:'a2',ic:'🏦',nm:'Bank'}];
const EMOJIS=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment('🍽️☕🍔🍕🍎🥗🍺🛒👕👟💄🧴💡💧📱💻🌐🚌🚗⛽🚲✈️🏠🛋️🔧🧹💊🏥💪🎬🎮🎵📚🎓🐶👶🎁💼📈💰🏦💳🧾🙏🛍️🎉✂️🚬📦')].map(x=>x.segment);
const AEMOJIS=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment('💵🏦💳👛🪙💰🐷🏧📱💼🏠🚗✈️🎓🛒🎁📈🧾🎯🍽️💡🏥🎮👶🐶')].map(x=>x.segment);

const now0=new Date();
const S={tx:[],C:defCats(),A:defAccts(),acc:'a1',type:'e',cat:'e0',view:'home',
  mo:new Date(now0.getFullYear(),now0.getMonth(),1),editC:false,smode:'m'};

const acctOf=id=>S.A.find(a=>a.id===id)||S.A[0];
const txOf=()=>S.tx.filter(t=>(t.acct||'a1')===S.acc);
const cof=t=>(S.C[t.type]||[]).find(c=>c.id===t.cat)||{ic:'📦',nm:'Other'};
const sums=l=>{let i=0,e=0;l.forEach(t=>t.type==='i'?i+=t.amt:e+=t.amt);return{i,e}};
const sorted=l=>[...l].sort((a,b)=>b.date.localeCompare(a.date)||(+b.id||0)-(+a.id||0));

/* ================= storage ================= */
function fixNames(list,defs){list.forEach(x=>{const d=defs.find(d=>d.id===x.id);if(d&&SIN.test(x.nm))x.nm=d.nm})}
function load(){
  const raw=LS.get(KEY,[]);
  S.tx=(Array.isArray(raw)?raw:[]).filter(t=>t&&typeof t.date==='string'&&Number.isFinite(+t.amt)&&(t.type==='e'||t.type==='i'))
    .map(t=>({...t,amt:+t.amt,cat:typeof t.cat==='number'?t.type+t.cat:t.cat,acct:t.acct||'a1'}));
  const c=LS.get(CK,null);if(c&&Array.isArray(c.e)&&Array.isArray(c.i))S.C=c;
  const d=defCats();fixNames(S.C.e,d.e);fixNames(S.C.i,d.i);
  const a=LS.get(AK,null);if(Array.isArray(a)&&a.length)S.A=a;
  defAccts().forEach(x=>{if(!S.A.find(y=>y.id===x.id))S.A.push(x)});
  fixNames(S.A,defAccts());
  const cur=LS.get(CUR,'a1');S.acc=S.A.find(x=>x.id===cur)?cur:'a1';
}
function mirror(){ // copy to IndexedDB so the service worker can build notifications
  try{
    const cm={};['e','i'].forEach(k=>S.C[k].forEach(c=>cm[c.id]=c.ic+' '+c.nm));
    idbSet('tx',S.tx);idbSet('catmap',cm);idbSet('accts',S.A);
  }catch(e){}
}
function persist(key,val){if(!LS.set(key,val))toast('Could not save data');mirror()}
const saveTx=()=>persist(KEY,S.tx),saveCats=()=>persist(CK,S.C),saveAccts=()=>persist(AK,S.A);

/* ================= UI helpers ================= */
let toastT;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),1800)}

let onDismiss=null;
function sheet(html,dismiss){$('#sheetBody').innerHTML=html;onDismiss=dismiss||null;$('#sheet').classList.add('on')}
function closeSheet(){const f=onDismiss;onDismiss=null;$('#sheet').classList.remove('on');if(f)f()}
function confirmBox(title,msg,okLabel,danger){
  return new Promise(res=>{
    sheet(`<h3>${esc(title)}</h3><p class="sm">${esc(msg)}</p><button class="btn ${danger?'d':''}" id="cOk">${esc(okLabel)}</button><button class="btn g" id="cNo">Cancel</button>`,()=>res(false));
    $('#cOk').onclick=()=>{onDismiss=null;closeSheet();res(true)};
    $('#cNo').onclick=closeSheet;
  });
}

/* ================= rendering ================= */
const itemHTML=t=>{const c=cof(t);
  return`<div class="item"><div class="ic">${esc(c.ic)}</div><div class="m"><b>${esc(t.note||c.nm)}</b><span>${esc(c.nm)} • ${fmtDate(t.date)}</span></div><div class="amt ${t.type}">${t.type==='e'?'−':'+'}${money(t.amt)}</div><button class="del" data-a="del" data-id="${esc(t.id)}" aria-label="Delete transaction">✕</button></div>`};

function renderAccounts(){
  const bal=id=>S.tx.filter(t=>(t.acct||'a1')===id).reduce((s,t)=>s+(t.type==='i'?t.amt:-t.amt),0);
  $('#hAcc').innerHTML=S.A.map(a=>`<button class="acard ${a.id===S.acc?'on':''}" data-ac="${a.id}"><span class="ic">${esc(a.ic)}</span><span><small>${esc(a.nm)}</small><b>${money(bal(a.id))}</b></span></button>`).join('')+'<button class="acard plus" data-a="newacc"><span class="ic">＋</span><span><b>New account</b></span></button>';
  const tabs=S.A.map(a=>`<button class="${a.id===S.acc?'on':''}" data-ac="${a.id}">${esc(a.ic)} ${esc(a.nm)}</button>`).join('');
  $$('.acctabs').forEach(el=>el.innerHTML=tabs);
}
function renderHome(){
  const a=acctOf(S.acc),n=new Date(),own=txOf(),s=sums(own.filter(t=>t.date.startsWith(mkey(n))));
  $('#hLbl').textContent=a.nm+' • '+n.toLocaleDateString('en-US',{month:'long'})+' balance';
  $('#hBal').textContent=money(s.i-s.e);$('#hIn').textContent=money(s.i);$('#hEx').textContent=money(s.e);
  const r=sorted(own).slice(0,6);
  $('#hList').innerHTML=r.length?r.map(itemHTML).join(''):'<div class="empty">No transactions yet.<br>Tap “Add” below to log your first one.</div>';
}
function renderHistory(){
  const l=sorted(txOf().filter(t=>t.date.startsWith(mkey(S.mo)))),s=sums(l);
  $('#hsIn').textContent=money(s.i);$('#hsEx').textContent=money(s.e);$('#hsBl').textContent=money(s.i-s.e);
  $('#mList').innerHTML=l.length?l.map(itemHTML).join(''):'<div class="empty">No transactions this month.</div>';
}
function range(){
  if(S.smode==='r')return[$('#rF').value||'0000-01-01',$('#rT').value||'9999-12-31'];
  const l=new Date(S.mo.getFullYear(),S.mo.getMonth()+1,0);return[mkey(S.mo)+'-01',ymd(l)];
}
function renderStat(){
  const[f,t]=range(),l=txOf().filter(x=>x.date>=f&&x.date<=t),s=sums(l),ex=l.filter(x=>x.type==='e');
  $('#sIn').textContent=money(s.i);$('#sEx').textContent=money(s.e);$('#sBl').textContent=money(s.i-s.e);
  const by={};ex.forEach(x=>by[x.cat]=(by[x.cat]||0)+x.amt);
  const ks=Object.keys(by).sort((a,b)=>by[b]-by[a]);
  const nm=k=>{const c=S.C.e.find(c=>c.id===k)||{ic:'📦',nm:'Other'};return esc(c.ic+' '+c.nm)};
  const today=ymd(new Date());let end=t<today?t:today;if(end<f)end=t;
  const days=Math.max(1,Math.round((new Date(end)-new Date(f))/864e5)+1);
  const big=ex.slice().sort((a,b)=>b.amt-a.amt)[0];
  const rate=s.i>0?Math.round((s.i-s.e)/s.i*100)+'%':'—';
  const row=(k,v)=>`<div class="st"><span>${k}</span><b>${v}</b></div>`;
  $('#sStats').innerHTML=l.length
    ?row('Transactions',l.length)+row('Avg. daily spending',money(s.e/days))+row('Savings rate',rate)+(ks.length?row('Top category',nm(ks[0])):'')+(big?row('Largest expense',money(big.amt)):'')
    :'<div class="empty">No transactions in this period.</div>';
  $('#sBars').innerHTML=ks.length
    ?ks.map(k=>`<div class="bar"><div class="t"><span>${nm(k)}</span><span>${money(by[k])}</span></div><div class="tr"><div class="f" style="width:${s.e?by[k]/s.e*100:0}%"></div></div></div>`).join('')
    :'<div class="empty">No spending data.</div>';
}
function renderCats(){
  const l=S.C[S.type];if(!l.find(c=>c.id===S.cat))S.cat=l[0].id;
  $('#aCats').innerHTML=l.map(c=>`<button class="${c.id===S.cat?'on':''}" data-c="${c.id}"><span>${esc(c.ic)}</span>${esc(c.nm)}${S.editC&&c.id[0]==='c'?`<i class="x" data-xc="${c.id}">✕</i>`:''}</button>`).join('')
    +'<button class="plus" data-a="newcat"><span>＋</span>New</button>';
  $('#cEdit').textContent=S.editC?'Done':'Edit';
}
function render(){
  $('#today').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  const lbl=S.mo.toLocaleDateString('en-US',{year:'numeric',month:'long'});
  $$('.mLbl').forEach(e=>e.textContent=lbl);
  renderAccounts();renderHome();renderHistory();renderStat();renderCats();
}
function go(v){
  S.view=v;
  $$('.view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v));
  $$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  $('#main').scrollTop=0;render();
}

/* ================= theme ================= */
function setTheme(t){
  document.documentElement.dataset.theme=t;
  $('#theme').textContent=t==='dark'?'☀️':'🌙';
  $('meta[name="theme-color"]').content=t==='dark'?'#0E1513':'#F2F5F3';
  try{localStorage.setItem('theme',t)}catch(e){}
}

/* ================= actions ================= */
function saveTransaction(){
  const a=parseFloat($('#aAmt').value);
  if(!(a>0)){toast('Enter a valid amount');$('#aAmt').focus();return}
  S.tx.push({id:Date.now(),type:S.type,cat:S.cat,acct:S.acc,amt:a,note:$('#aNote').value.trim(),date:$('#aDate').value||ymd(new Date())});
  saveTx();$('#aAmt').value='';$('#aNote').value='';toast('Saved');go('home');
}
async function deleteTx(id){
  if(!await confirmBox('Delete transaction?','This cannot be undone.','Delete',true))return;
  S.tx=S.tx.filter(t=>String(t.id)!==String(id));saveTx();render();toast('Deleted');
}
function newCatSheet(){
  let pick='📦';
  sheet(`<h3>New category</h3><label for="mNm">Name</label><input id="mNm" type="text" maxlength="20" placeholder="e.g. Fuel" autocomplete="off">
    <label for="mIc">Icon (type or pick any emoji)</label><input id="mIc" type="text" maxlength="4" value="${pick}"><div class="eg" id="mEg"></div>
    <button class="btn" id="mSave">Add</button><button class="btn g" id="mCan">Cancel</button>`);
  const eg=()=>$('#mEg').innerHTML=EMOJIS.map(e=>`<button data-e="${e}" class="${e===$('#mIc').value?'on':''}">${e}</button>`).join('');
  eg();
  $('#mEg').onclick=e=>{const b=e.target.closest('button');if(b){$('#mIc').value=b.dataset.e;eg()}};
  $('#mIc').oninput=eg;$('#mCan').onclick=closeSheet;
  $('#mSave').onclick=()=>{
    const nm=$('#mNm').value.trim(),ic=$('#mIc').value.trim();
    if(!nm||!ic){toast('Enter a name and icon');return}
    const id='c'+Date.now();S.C[S.type].push({id,ic,nm});S.cat=id;saveCats();closeSheet();renderCats();toast('Saved');
  };
}
async function removeCat(id){
  if(!await confirmBox('Delete category?','Past transactions are kept.','Delete',true))return;
  S.C[S.type]=S.C[S.type].filter(c=>c.id!==id);saveCats();render();
}
function settingsSheet(){
  sheet(`<h3>Settings</h3>
    <button class="btn g" data-a="manage">Manage accounts</button>
    <button class="btn g" data-a="notif">🔔 Enable month-end notifications</button>
    <button class="btn g" data-a="ntest">🔔 Send a test notification</button>
    <button class="btn g" data-a="export">Back up data (download)</button>
    <button class="btn g" data-a="import">Restore from backup</button>
    <button class="btn d" data-a="wipe">Delete all transactions</button>
    <button class="btn" data-a="close">Done</button>`);
}
function manageSheet(){
  sheet(`<h3>Accounts</h3>${S.A.map(a=>`<button class="acard mrow" data-ea="${esc(a.id)}"><span class="ic">${esc(a.ic)}</span><span><b>${esc(a.nm)}</b><small>Tap to edit</small></span></button>`).join('')}
    <button class="btn" data-a="newacc2">＋ New account</button><button class="btn g" data-a="settings">Back</button>`);
}
function accountSheet(id,fromManage){
  const ed=id?S.A.find(a=>a.id===id):null,back=()=>fromManage?manageSheet():closeSheet();
  sheet(`<h3>${ed?'Edit account':'New account'}</h3><label for="mNm">Name</label><input id="mNm" type="text" maxlength="20" placeholder="e.g. Savings, Wallet, Card" value="${ed?esc(ed.nm):''}" autocomplete="off">
    <label for="mIc">Icon (type or pick any emoji)</label><input id="mIc" type="text" maxlength="6" value="${esc(ed?ed.ic:'💳')}"><div class="eg" id="mEg"></div>
    <button class="btn" id="mSave">${ed?'Save':'Add'}</button>${ed&&ed.id[0]==='x'?'<button class="btn d" id="mDel">Delete account</button>':''}<button class="btn g" id="mCan">Cancel</button>`);
  const eg=()=>$('#mEg').innerHTML=AEMOJIS.map(e=>`<button data-e="${e}" class="${e===$('#mIc').value?'on':''}">${e}</button>`).join('');
  eg();
  $('#mEg').onclick=e=>{const b=e.target.closest('button');if(b){$('#mIc').value=b.dataset.e;eg()}};
  $('#mIc').oninput=eg;$('#mCan').onclick=back;
  $('#mSave').onclick=()=>{
    const nm=$('#mNm').value.trim(),ic=$('#mIc').value.trim();
    if(!nm||!ic){toast('Enter a name and icon');return}
    if(ed){ed.nm=nm;ed.ic=ic}
    else{const n='x'+Date.now();S.A.push({id:n,ic,nm});S.acc=n;LS.set(CUR,n)}
    saveAccts();render();back();toast('Saved');
  };
  const del=$('#mDel');
  if(del)del.onclick=async()=>{
    const n=S.tx.filter(t=>(t.acct||'a1')===id).length;
    if(!await confirmBox('Delete account?',n?`This also deletes its ${n} transaction${n>1?'s':''}. This cannot be undone.`:'This account has no transactions.','Delete',true))return;
    S.A=S.A.filter(a=>a.id!==id);S.tx=S.tx.filter(t=>(t.acct||'a1')!==id);
    if(S.acc===id){S.acc='a1';LS.set(CUR,S.acc)}
    saveAccts();saveTx();render();manageSheet();toast('Deleted');
  };
}
function exportData(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({version:2,tx:S.tx,cats:S.C,accts:S.A})],{type:'application/json'}));
  a.download='expenses-backup-'+ymd(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup file created');
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result),list=Array.isArray(d)?d:d.tx;if(!Array.isArray(list))throw 0;
      S.tx=list.filter(t=>t&&typeof t.date==='string'&&Number.isFinite(+t.amt)&&(t.type==='e'||t.type==='i'))
        .map(t=>({...t,amt:+t.amt,cat:typeof t.cat==='number'?t.type+t.cat:t.cat,acct:t.acct||'a1'}));
      if(!Array.isArray(d)){
        if(d.cats&&Array.isArray(d.cats.e)&&Array.isArray(d.cats.i)){S.C=d.cats;saveCats()}
        if(Array.isArray(d.accts)&&d.accts.length){S.A=d.accts;defAccts().forEach(x=>{if(!S.A.find(y=>y.id===x.id))S.A.push(x)});saveAccts()}
      }
      saveTx();render();toast('Data restored');
    }catch(x){toast('Invalid file')}
  };
  r.readAsText(file);
}

/* ---- notifications ---- */
const swReg=()=>navigator.serviceWorker?navigator.serviceWorker.ready:null;
async function regPeriodic(reg){try{if(reg&&'periodicSync' in reg)await reg.periodicSync.register('month-end',{minInterval:12*3600*1000})}catch(e){}}
async function enableNotif(){
  if(!('Notification' in window)||!navigator.serviceWorker){toast('Notifications not supported here');return}
  const p=await Notification.requestPermission();
  if(p==='granted'){const r=await swReg();regPeriodic(r);toast('Notifications enabled');runCheck(r)}else toast('Notifications are blocked');
}
async function testNotif(){
  if(!('Notification' in window)||Notification.permission!=='granted'){enableNotif();return}
  const r=await swReg(),cm={};['e','i'].forEach(k=>S.C[k].forEach(c=>cm[c.id]=c.ic+' '+c.nm));
  const s=monthSummary(S.tx,cm,mkey(new Date()),S.A);
  r.showNotification(s.title,{body:s.body,icon:'icon-192.png',badge:'icon-192.png',tag:'test'});
}

/* ---- month-end summary message (in-app popup; the notification is sent by runCheck) ---- */
function monthEndMsg(){
  if($('#sheet').classList.contains('on'))return;
  const seen=LS.get('seen_msum',[]);
  for(const mk of dueKeys(new Date())){
    if(seen.includes(mk)||!S.tx.some(t=>t.date.startsWith(mk)))continue;
    const cm={};['e','i'].forEach(k=>S.C[k].forEach(c=>cm[c.id]=c.ic+' '+c.nm));
    const m=monthSummary(S.tx,cm,mk,S.A);
    sheet(`<h3>📅 ${esc(m.title)}</h3>${m.body.split('\n').map(l=>`<div class="st"><span style="color:var(--tx)">${esc(l)}</span></div>`).join('')}
      <button class="btn" id="msGo">View full summary</button><button class="btn g" id="msOk">Close</button>`,
      ()=>{seen.push(mk);LS.set('seen_msum',seen)});
    $('#msOk').onclick=closeSheet;
    $('#msGo').onclick=()=>{
      const[y,mo]=mk.split('-');S.mo=new Date(+y,+mo-1,1);
      closeSheet();$('#sSeg button[data-sm="m"]').click();go('stat');
    };
    return;
  }
}

/* ---- online / offline indicator ---- */
async function checkNet(){
  let ok=navigator.onLine;
  if(ok&&location.protocol.startsWith('http')){
    try{
      const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);
      const r=await fetch('manifest.json?ping='+Date.now(),{cache:'no-store',signal:ctl.signal});clearTimeout(t);ok=r.ok;
    }catch(e){ok=false}
  }
  $('#off').hidden=ok;
}

/* ================= events ================= */
document.addEventListener('click',e=>{
  const xc=e.target.closest('[data-xc]');if(xc){e.stopPropagation();removeCat(xc.dataset.xc);return}
  const b=e.target.closest('button,a[data-a]');if(!b)return;
  const d=b.dataset;
  if(d.v)go(d.v);
  else if(d.ea)accountSheet(d.ea,true);
  else if(d.ac){S.acc=d.ac;LS.set(CUR,S.acc);render()}
  else if(d.t){S.type=d.t;$$('#tSeg button').forEach(x=>x.classList.toggle('on',x===b));renderCats()}
  else if(d.sm){S.smode=d.sm;$$('#sSeg button').forEach(x=>x.classList.toggle('on',x===b));$('#sMo').hidden=S.smode==='r';$('#sRg').hidden=S.smode==='m';renderStat()}
  else if(d.c){S.cat=d.c;renderCats()}
  else if(d.m){S.mo=new Date(S.mo.getFullYear(),S.mo.getMonth()+ +d.m,1);render()}
  else switch(d.a){
    case'theme':setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');break;
    case'settings':settingsSheet();break;
    case'close':closeSheet();break;
    case'editcats':S.editC=!S.editC;renderCats();break;
    case'newcat':newCatSheet();break;
    case'save':saveTransaction();break;
    case'del':deleteTx(d.id);break;
    case'manage':manageSheet();break;
    case'newacc':accountSheet();break;
    case'newacc2':accountSheet(null,true);break;
    case'notif':enableNotif();break;
    case'ntest':testNotif();break;
    case'export':exportData();break;
    case'import':$('#imp').click();break;
    case'wipe':closeSheet();confirmBox('Delete all transactions?','This permanently deletes every transaction in all accounts.','Delete everything',true)
      .then(ok=>{if(ok){S.tx=[];saveTx();render();toast('All data deleted')}});break;
  }
});
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
$('#imp').onchange=e=>{const f=e.target.files[0];if(f)importData(f);e.target.value=''};
$('#rF').onchange=$('#rT').onchange=renderStat;

/* app-like behaviour: no pinch zoom, no context menu */
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault()));
document.addEventListener('contextmenu',e=>{if(!e.target.closest('input'))e.preventDefault()});

/* ================= init ================= */
load();
setTheme(document.documentElement.dataset.theme);
{const n=new Date();$('#rF').value=ymd(new Date(n.getFullYear(),n.getMonth(),1));$('#rT').value=ymd(n);$('#aDate').value=ymd(n)}
render();mirror();

addEventListener('online',checkNet);addEventListener('offline',checkNet);
document.addEventListener('visibilitychange',async()=>{if(!document.hidden){checkNet();render();monthEndMsg();const r=await swReg();if(r)runCheck(r)}});
setInterval(checkNet,30000);checkNet();

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(async()=>{const r=await swReg();regPeriodic(r);runCheck(r)}).catch(()=>{});
}
if(new URLSearchParams(location.search).get('v')==='stat')go('stat');

/* splash: fade out once the app is ready (shown at least ~1.4s so it doesn't flash) */
{
  const sp=$('#splash');
  if(sp){
    const hide=()=>{if(!sp.isConnected)return;sp.classList.add('out');setTimeout(()=>{sp.remove();monthEndMsg()},600)};
    const wait=Math.max(0,1400-performance.now());
    const ready=document.readyState==='complete'?Promise.resolve():new Promise(r=>addEventListener('load',r,{once:true}));
    ready.then(()=>setTimeout(hide,wait));
    setTimeout(hide,4000); // safety net
  }
}
})();
