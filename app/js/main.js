'use strict';
/* Harbinger POS — router, shell, login, boot */

const ROUTES={
  dashboard:{perm:'dashboard',label:'Command Center',group:'Operate',v:vDashboard},
  catalog:{perm:'catalog',label:'Catalog',group:'Operate',v:vCatalog},
  stock:{perm:'stock',label:'Stock Room',group:'Operate',v:vStock},
  guests:{perm:'guests',label:'Guests',group:'Grow',v:vGuests},
  promos:{perm:'promos',label:'Promotions',group:'Grow',v:vPromos},
  orders:{perm:'orders',label:'Orders',group:'Money',v:vOrders},
  outlets:{perm:'outlets',label:'Outlets & Registers',group:'Money',v:vOutlets},
  online:{perm:'online',label:'Online & Delivery',group:'Operate',v:vOnline},
  accounts:{perm:'accounts',label:'Accounts',group:'Money',v:vAccounts},
  einvoice:{perm:'accounts',label:'E-Invoicing',group:'Money',v:vEinvoice},
  reports:{perm:'reports',label:'Insights',group:'Money',v:vReports},
  team:{perm:'team',label:'Team',group:'Admin',v:vTeam},
  settings:{perm:'settings',label:'Control Panel',group:'Admin',v:vSettings},
  register:{perm:'register',label:'Register',full:true,v:vRegister},
  kitchen:{perm:'kitchen',label:'Kitchen',full:true,v:vKitchen}
};
const ICONS={dashboard:'M3 12l9-9 9 9M5 10v10h14V10',catalog:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',stock:'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
  guests:'M16 11a4 4 0 10-8 0M4 21c0-4 4-6 8-6s8 2 8 6',promos:'M20 12l-8 8-9-9V3h8l9 9z',orders:'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',outlets:'M3 9l2-5h14l2 5M5 9v11h14V9M9 20v-6h6v6',
  online:'M3 7h18v10H3zM7 11h4M15 11h2M12 3v4',einvoice:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  accounts:'M5 3h12a2 2 0 012 2v16H7a2 2 0 01-2-2zM9 8h6M9 12h6M9 16h3',reports:'M4 20V10M10 20V4M16 20v-8M22 20H2',team:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',settings:'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 3h-4l-.3 3.1a7 7 0 00-1.7 1l-2.4-1-2 3.4L6.1 11a7 7 0 000 2l-2 1.5 2 3.4 2.4-1a7 7 0 001.7 1l.3 3.1h4l.3-3.1a7 7 0 001.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z'};
const ico=n=>'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="'+ICONS[n]+'"/></svg>';

function applyTheme(){
  const s=DB?DB.settings:{theme:'A',mode:'auto'}, h=document.documentElement;
  h.setAttribute('data-theme',s.theme||'A'); h.setAttribute('data-mode',s.mode||'auto');
}
let _fails=0,_lockUntil=0;
function loginHtml(){
  return '<div class="login"><div class="lcard"><div class="lbrand"><svg viewBox="0 0 144 127" aria-hidden="true"><use href="#mark"/></svg><div><strong>Harbinger POS</strong><span>An innovation partner</span></div></div>'+
    '<div style="text-align:end"><button type="button" class="btn ghost sm" data-act="lang-toggle">'+(LANG==='ar'?'English':'العربية')+'</button></div><h1>'+tr('Sign in')+'</h1><form id="loginForm" autocomplete="on"><label>'+tr('Username')+'<input name="username" autocomplete="username" required autofocus></label>'+
    '<label>'+tr('Password')+'<input name="password" type="password" autocomplete="current-password" required></label><p class="err" id="loginErr" role="alert"></p><button class="btn primary block" type="submit">'+tr('Sign in')+'</button></form>'+
    '<p class="demo">Demo accounts — <b>admin</b> / admin123 · <b>manager</b> / manager123 · <b>cashier</b> / cashier123. Change these in Team before real use. Data is stored in this browser only.</p></div></div>';
}
function bindLogin(){
  const f=$('#loginForm'); if(!f)return;
  f.addEventListener('submit',e=>{
    e.preventDefault();
    if(now()<_lockUntil){$('#loginErr').textContent='Too many attempts. Wait '+Math.ceil((_lockUntil-now())/1000)+' s.';return}
    const d=formData(f);
    if(login(d.username,d.password)){_fails=0;location.hash='#/'+homeRoute();render()}
    else{_fails++;if(_fails>=5){_lockUntil=now()+30000;_fails=0}$('#loginErr').textContent=tr('Wrong username or password.')}
  });
}
function shell(route,content){
  const groups={}; Object.keys(ROUTES).forEach(k=>{const r=ROUTES[k];if(r.full||!can(r.perm))return;(groups[r.group]=groups[r.group]||[]).push(k)});
  const nav=Object.keys(groups).map(g=>'<div class="ng">'+esc(tr(g))+'</div>'+groups[g].map(k=>'<a class="ni'+(k===route?' on':'')+'" href="#/'+k+'"'+(k===route?' aria-current="page"':'')+'>'+ico(k)+'<span>'+esc(tr(ROUTES[k].label))+'</span></a>').join('')).join('');
  return '<div class="shell'+(UIS.nav?' navopen':'')+'"><aside class="side" aria-label="Main navigation"><div class="sb"><svg viewBox="0 0 144 127" aria-hidden="true"><use href="#mark"/></svg><strong>Harbinger</strong></div><nav>'+nav+'</nav>'+
    '<div class="su"><span>'+esc(ME.name)+'</span><small>'+esc(ME.role)+'</small></div></aside><div class="scrim" data-act="nav-toggle"></div>'+
    '<div class="main"><header class="top"><button type="button" class="menu" data-act="nav-toggle" aria-label="Menu">☰</button><span class="biz">'+esc(DB.settings.business)+'</span><span class="sp"></span>'+
    '<button type="button" class="btn ghost sm" data-act="palette" aria-label="Search and commands">'+tr('Search')+' <kbd class="kb">Ctrl K</kbd></button>'+
    (can('kitchen')?'<button type="button" class="btn ghost sm" data-act="go-kitchen">'+tr('Kitchen display')+'</button>':'')+
    (can('register')?'<button type="button" class="btn primary sm" data-act="go-register">'+tr('Open Register')+'</button>':'')+
    '<button type="button" class="btn ghost sm" data-act="mode-toggle" aria-label="Toggle light and dark mode">◐</button><button type="button" class="btn ghost sm" data-act="lang-toggle" aria-label="Language">'+(LANG==='ar'?'EN':'ع')+'</button><button type="button" class="btn ghost sm" data-act="logout">'+tr('Sign out')+'</button></header>'+
    '<main class="view" id="view">'+content+'</main></div></div>';
}
function render(){
  const root=$('#app'); if(!root)return;
  const ae=document.activeElement, fid=ae&&ae.id, ss=ae&&ae.selectionStart, se=ae&&ae.selectionEnd, hadScroll=$('.tiles')?$('.tiles').scrollTop:0;
  applyTheme();applyLang();
  if(!ME){root.innerHTML=loginHtml();bindLogin();return}
  const parts=location.hash.replace(/^#\/?/,'').split('/'); let r=parts[0];
  const def=homeRoute();
  if(!ROUTES[r]||!can(ROUTES[r].perm)){r=def;if(location.hash&&parts[0]!==''){history.replaceState(null,'','#/'+def)}}
  document.title=(ROUTES[r].label||'')+' · Harbinger POS';
  if(r==='register')root.innerHTML=vRegister();
  else if(r==='kitchen'){root.innerHTML=vKitchen();kdsAfter()}
  else root.innerHTML=shell(r,ROUTES[r].v(parts[1],parts[2]));
  if(r==='settings')bindSettings();
  if(r==='accounts'&&parts[1]==='setup')bindAccounts();
  if(r==='einvoice')bindEinvoice();
  if(r==='online'&&parts[1]==='setup')bindOnline();
  if(fid){const el=document.getElementById(fid);if(el){el.focus();if(ss!=null&&el.setSelectionRange)try{el.setSelectionRange(ss,se)}catch(e){}}}
  const t=$('.tiles');if(t&&hadScroll)t.scrollTop=hadScroll;
  maybeSetup();
}
const homeRoute=()=>can('dashboard')?'dashboard':can('register')?'register':'kitchen';
A['go-register']=()=>{location.hash='#/register'};
A['go-kitchen']=()=>{location.hash='#/kitchen'};
A.logout=()=>{logout();location.hash='#/';render()};
A['nav-toggle']=()=>{UIS.nav=!UIS.nav;render()};
A['mode-toggle']=()=>{const s=DB.settings,dark=document.documentElement.getAttribute('data-mode')==='dark'||(s.mode==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);s.mode=dark?'light':'dark';save();render()};

/* ---------- global events ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]'); if(!t||t.disabled)return;
  const f=A[t.dataset.act]; if(f){e.preventDefault();f(t.dataset,t)}
});
document.addEventListener('input',e=>{const t=e.target.closest('[data-in]');if(t&&I[t.dataset.in])I[t.dataset.in](t)});
document.addEventListener('change',e=>{const t=e.target.closest('[data-ch]');if(t&&C[t.dataset.ch])C[t.dataset.ch](t)});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'&&ME){e.preventDefault();if(!$('#palQ'))A.palette();return}
  if(!ME||location.hash.indexOf('#/register')!==0)return;
  const modalOpen=!!$('.modal-back');
  if(e.key==='Enter'&&e.target.id==='rq'){e.preventDefault();regScan();return}
  if(modalOpen)return;
  if(e.key==='F2'){e.preventDefault();const q=$('#rq');if(q)q.focus()}
  else if(e.key==='F9'){e.preventDefault();if(curSession())A['r-pay']()}
});
window.addEventListener('hashchange',()=>{UIS.nav=false;closeModal(true);render()});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{DB=JSON.parse(e.newValue);render()}catch(x){}}});

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  load();restoreSession();
  if(ME&&!location.hash)location.hash='#/'+homeRoute();
  render();
  setInterval(()=>{if(ME&&location.hash.indexOf('#/kitchen')===0&&!$('.modal-back'))render()},15000);
  setTimeout(()=>syncGateway(false),1500);setInterval(()=>syncGateway(false),15000);
});
A['go-online']=()=>{location.hash='#/online'};
