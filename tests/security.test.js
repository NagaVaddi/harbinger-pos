'use strict';
// Repository and web-app hygiene: no secrets in the tree, no dangerous browser APIs, a CSP on the app pages, safe .gitignore.
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const walk=(d,out)=>{out=out||[];for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else out.push(p)}return out};
const files=['website','server','tests','.github'].filter(d=>fs.existsSync(path.join(root,d))).flatMap(d=>walk(path.join(root,d))).concat(['README.md','SECURITY.md','package.json'].map(f=>path.join(root,f)).filter(fs.existsSync))
  .filter(f=>!/\.(db|db-wal|db-shm|png|jpg|ico|woff2?)$/.test(f)&&!/harbinger\.db|vendor[\\/]qrcode/.test(f)&&!/security\.test\.js$/.test(f));
const text=f=>fs.readFileSync(f,'utf8');
const SECRETS=[/AKIA[0-9A-Z]{16}/,/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/AIza[0-9A-Za-z_-]{35}/,/gh[pousr]_[0-9A-Za-z]{36}/,/sk-[A-Za-z0-9]{32,}/,/xox[baprs]-[0-9A-Za-z-]{10,}/,/"private_key_id"/,/client_secret\s*[:=]\s*['"][^'"]{8,}/i];
const leaks=files.filter(f=>SECRETS.some(r=>r.test(text(f))));
ok('no API keys, private keys or tokens in any tracked file',leaks.length===0,leaks.join(', '));
ok('no key, certificate, env or credential files in the tree',!files.some(f=>/(\.pem|\.key|\.p12|\.env|firebase-adminsdk|credentials\.json|dev-master\.key)$/i.test(f)));
const app=files.filter(f=>/website[\\/](app|order)[\\/].*\.js$/.test(f)&&!/vendor/.test(f));
const bad=app.filter(f=>/\beval\s*\(|document\.write\s*\(|new Function\s*\(|\.outerHTML\s*=|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/.test(text(f)));
ok('web app code uses no eval, document.write, new Function or string timers',bad.length===0,bad.join(', '));
ok('web app has no inline event-handler attributes (works with a strict CSP)',!files.filter(f=>/website[\\/](app|order)[\\/].*\.(js|html)$/.test(f)&&!/vendor/.test(f)).some(f=>/\son(click|change|input|submit|load|error)\s*=\s*["']/.test(text(f))));
for(const p of ['website/app/index.html','website/order/index.html']){
  const h=text(path.join(root,p));
  ok(p+' has a Content-Security-Policy: scripts only from the site itself, no plugins, no base-tag hijack',/Content-Security-Policy/.test(h)&&/script-src 'self'(?!\s*'unsafe)/.test(h)&&/object-src 'none'/.test(h)&&/base-uri 'self'/.test(h));
  ok(p+' loads no third-party scripts',![...h.matchAll(/<script[^>]+src="([^"]+)"/g)].some(m=>/^https?:/.test(m[1])));
}
const gi=text(path.join(root,'.gitignore'));
ok('.gitignore is an allow-list and blocks keys, env files, databases and credential JSON',/^\/\*/m.test(gi)&&['*.env','*.pem','*.key','firebase-adminsdk','server/cloud/*.db'].every(s=>gi.includes(s)));
const cloud=text(path.join(root,'server/cloud/cloud.js'))+text(path.join(root,'server/cloud/security.js'));
ok('cloud server: cookies are HttpOnly + SameSite=Strict, CSRF token required, no wildcard CORS',/HttpOnly/.test(cloud)&&/SameSite=Strict/.test(cloud)&&/X-CSRF-Token/i.test(cloud)&&!/Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*/.test(cloud));
ok('cloud server: SQL is parameterised (no string-built queries from request data)',!/db\.(prepare|exec)\(\s*[`'"][^`'"]*\$\{/.test(cloud));
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
