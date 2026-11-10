/* Heimatinventur – Datenanbindung an Supabase.
   Stellt dieselbe Schnittstelle bereit, die die App bisher von claude.ai bekommen hat
   (claude.use('db'|'user'|'downloads')), damit der App-Code unverändert bleiben kann. */
(function(){
"use strict";
const SUPABASE_URL='https://ayugokgduwlwkrxpaolo.supabase.co';
const SUPABASE_KEY='sb_publishable_1hapZyUgM8LPldrWSaALFw_rIL_rudB';
const LS='heimatinventur.cache.v1';

const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.SB=sb;

/* ---------- Cache aller Dokumente ---------- */
const cache=new Map();let ready=false;const listeners=new Set();let saveT=null;
const colOf=p=>p.split('/').slice(0,-1).join('/');
const clone=o=>JSON.parse(JSON.stringify(o));
try{const raw=localStorage.getItem(LS);if(raw){const o=JSON.parse(raw);Object.entries(o).forEach(([k,v])=>cache.set(k,v));}}catch(e){}
function saveLocal(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(LS,JSON.stringify(Object.fromEntries(cache)));}catch(e){}},400);}
function snapDoc(path){const d=cache.get(path);return{id:path.split('/').pop(),exists:d!==undefined,data:()=>d,metadata:{fromCache:!ready,hasPendingWrites:false}};}
function snapCol(col){const docs=[];cache.forEach((v,k)=>{if(colOf(k)===col)docs.push(snapDoc(k));});docs.sort((a,b)=>a.id<b.id?-1:1);return{docs,size:docs.length,empty:!docs.length,metadata:{fromCache:!ready,hasPendingWrites:false},docChanges:()=>[]};}
const pending=new Set();let notT=null;
function notify(col){pending.add(col||'*');clearTimeout(notT);notT=setTimeout(()=>{const all=pending.has('*');const cols=new Set(pending);pending.clear();listeners.forEach(l=>{if(all||cols.has(l.col)){try{l.fn(snapCol(l.col));}catch(e){console.error(e);}}});},15);saveLocal();}

function err(e){const m=(e&&e.message)||String(e);const c=(e&&e.code)||'';if(c==='42501'||/row-level security|permission/i.test(m))return{code:'invalid_argument',message:m};if(/fetch|network|Failed/i.test(m))return{code:'unavailable',message:m};return{code:'unavailable',message:m};}
function isObj(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function merge(a,b){const o={...a};for(const [k,v] of Object.entries(b)){o[k]=isObj(v)&&isObj(o[k])?merge(o[k],v):v;}return o;}

async function put(path,data){const prev=cache.get(path);data=clone(data);cache.set(path,data);notify(colOf(path));
 const {error}=await sb.from('docs').upsert({path,col:colOf(path),data,updated_at:new Date().toISOString()});
 if(error){if(prev===undefined)cache.delete(path);else cache.set(path,prev);notify(colOf(path));throw err(error);}}
async function del(path){const prev=cache.get(path);cache.delete(path);notify(colOf(path));
 const {error}=await sb.from('docs').delete().eq('path',path);
 if(error){if(prev!==undefined)cache.set(path,prev);notify(colOf(path));throw err(error);}}
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);

function docRef(path){return{id:path.split('/').pop(),path,
 get:async()=>snapDoc(path),
 set:d=>put(path,d),
 update:async d=>{const cur=cache.get(path);if(cur===undefined)throw{code:'invalid_argument',message:'Dokument fehlt'};return put(path,merge(cur,clone(d)));},
 delete:()=>del(path),
 onSnapshot:(next)=>{const l={col:colOf(path),fn:()=>next(snapDoc(path))};listeners.add(l);setTimeout(()=>next(snapDoc(path)),0);return()=>listeners.delete(l);},
 collection:c=>colRef(path+'/'+c)};}
function colRef(col){return{path:col,
 doc:id=>docRef(col+'/'+(id||rid())),
 add:async d=>{const r=docRef(col+'/'+rid());await r.set(d);return r;},
 get:async()=>snapCol(col),
 onSnapshot:(next)=>{const l={col,fn:next};listeners.add(l);setTimeout(()=>next(snapCol(col)),0);return()=>listeners.delete(l);}};}
const DB={doc:docRef,collection:colRef};

async function loadAll(){const rows=[];let from=0;
 for(;;){const {data,error}=await sb.from('docs').select('path,data').range(from,from+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;from+=1000;}
 cache.clear();rows.forEach(r=>cache.set(r.path,r.data));ready=true;notify();}
let chan=null;
function realtime(){if(chan)return;chan=sb.channel('docs-changes').on('postgres_changes',{event:'*',schema:'public',table:'docs'},pl=>{
  if(pl.eventType==='DELETE'){const p=pl.old&&pl.old.path;if(p&&cache.has(p)){cache.delete(p);notify(colOf(p));}}
  else if(pl.new&&pl.new.path){cache.set(pl.new.path,pl.new.data);notify(colOf(pl.new.path));}}).subscribe();}
// Nach Rückkehr in die App (z. B. Handy war gesperrt) alles frisch laden
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&USER_ID)loadAll().catch(()=>{});});

/* ---------- Login ---------- */
let USER_ID=null,EMAIL=null;
const css=`#login{position:fixed;inset:0;z-index:50;background:var(--bg,#f5f1e8);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Outfit,system-ui,sans-serif}
#login .lb{width:100%;max-width:360px;background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:20px;padding:22px}
#login h1{font-size:24px;font-weight:500;margin:0 0 4px}#login h1 b{color:var(--acc,#2f6b4f)}#login p{color:var(--mut,#666);font-size:14px;margin:6px 0 14px;line-height:1.4}
#login input{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);background:var(--bg,#f5f1e8);border-radius:12px;padding:12px;margin:5px 0;font:inherit;color:inherit}
#login button{width:100%;border:0;border-radius:12px;padding:13px;margin-top:8px;font:inherit;font-weight:600;background:var(--acc,#2f6b4f);color:#fff}
#login button.sec{background:none;color:var(--acc,#2f6b4f);font-weight:500;padding:8px}#login .msg{font-size:14px;margin-top:10px;min-height:18px}`;
function loginUI(msg){let el=document.getElementById('login');
 if(!el){const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);el=document.createElement('div');el.id='login';document.body.appendChild(el);}
 el.innerHTML=`<form class="lb"><h1>Heimat<b>inventur</b></h1><p>Mit deinem Konto anmelden. Beim ersten Mal „Konto erstellen“ – danach den Link in der Bestätigungsmail antippen.</p>
 <input type="email" name="e" placeholder="E-Mail" autocomplete="username" required><input type="password" name="p" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password" required minlength="6">
 <button type="submit">Anmelden</button><button type="button" class="sec" data-m="signup">Konto erstellen</button><button type="button" class="sec" data-m="reset">Passwort vergessen</button><div class="msg"></div></form>`;
 const f=el.querySelector('form'),m=el.querySelector('.msg');if(msg)m.textContent=msg;
 const go=async mode=>{const e=f.e.value.trim(),p=f.p.value;m.textContent='…';
  try{if(mode==='signup'){const {data,error}=await sb.auth.signUp({email:e,password:p,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;m.textContent=data.session?'':'✉️ Bestätigungsmail verschickt – Link antippen, dann hier anmelden.';}
   else if(mode==='reset'){if(!e){m.textContent='Bitte zuerst E-Mail eintragen.';return;}const {error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.origin+location.pathname});if(error)throw error;m.textContent='✉️ Mail zum Zurücksetzen verschickt.';}
   else{const {error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)throw error;m.textContent='';}}
  catch(x){const t=(x&&x.message)||'';m.textContent=/Invalid login/i.test(t)?'E-Mail oder Passwort falsch.':/not confirmed/i.test(t)?'Bitte zuerst den Link in der Bestätigungsmail antippen.':/registered/i.test(t)?'Konto existiert schon – bitte anmelden.':'Fehler: '+t;}};
 f.addEventListener('submit',ev=>{ev.preventDefault();go('login');});el.querySelectorAll('button[data-m]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.m)));}
function pwUI(){loginUI();const el=document.getElementById('login');el.querySelector('p').textContent='Neues Passwort festlegen:';el.querySelector('input[type=email]').style.display='none';el.querySelectorAll('.sec').forEach(b=>b.style.display='none');
 const f=el.querySelector('form');f.e.required=false;f.addEventListener('submit',async ev=>{ev.preventDefault();ev.stopImmediatePropagation();const {error}=await sb.auth.updateUser({password:f.p.value});el.querySelector('.msg').textContent=error?'Fehler: '+error.message:'✓ Gespeichert';if(!error)setTimeout(()=>location.reload(),800);},true);}

let readyRes;const readyP=new Promise(r=>readyRes=r);
async function onSession(session){
 if(!session){USER_ID=null;loginUI();return;}
 if(USER_ID===session.user.id)return;USER_ID=session.user.id;EMAIL=session.user.email;
 const {data:mem}=await sb.from('members').select('email').eq('email',EMAIL.toLowerCase()).maybeSingle();
 if(!mem){loginUI(`Angemeldet als ${EMAIL}, aber noch nicht freigeschaltet. Michael muss deine E-Mail in der Datenbank eintragen.`);const el=document.getElementById('login');const b=document.createElement('button');b.className='sec';b.textContent='Abmelden';b.onclick=()=>sb.auth.signOut();el.querySelector('form').appendChild(b);return;}
 const el=document.getElementById('login');if(el)el.remove();
 try{await loadAll();}catch(e){console.error(e);}
 realtime();
 if(!cache.has('people/'+USER_ID))put('people/'+USER_ID,{name:EMAIL.split('@')[0],email:EMAIL}).catch(()=>{});
 readyRes();}
sb.auth.onAuthStateChange((ev,session)=>{if(ev==='PASSWORD_RECOVERY'){pwUI();return;}setTimeout(()=>onSession(session),0);});
sb.auth.getSession().then(({data})=>{if(!data.session)loginUI();});

/* ---------- Schnittstelle für die App ---------- */
const user={id:async()=>USER_ID,me:async()=>({id:USER_ID,name:EMAIL}),isOwner:()=>true,canEdit:()=>true,can:async()=>true,
 profiles:async ids=>Object.fromEntries(ids.map(id=>{const p=cache.get('people/'+id);return[id,{id,name:(p&&p.name)||''}];}))};
const downloads={save:async({filename,data})=>{const blob=data instanceof Blob?data:new Blob([data],{type:/\.csv$/.test(filename)?'text/csv;charset=utf-8':'application/octet-stream'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);return{status:'saved'};}};
window.claude={use:async n=>{if(n==='db'){await readyP;return DB;}if(n==='user'){await readyP;return user;}if(n==='downloads')return downloads;return null;}};
window.BACKEND={email:()=>EMAIL,logout:async()=>{try{localStorage.removeItem(LS);}catch(e){}await sb.auth.signOut();location.reload();},reload:()=>loadAll()};
})();
