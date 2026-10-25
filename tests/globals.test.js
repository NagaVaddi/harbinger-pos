'use strict';
// Every script is loaded as a classic <script>, so two top-level const/let/function/class with the same name
// (across files) is a SyntaxError in the browser. Catch that here.
const fs=require('fs'), path=require('path');
const dir=path.join(__dirname,'..','website','app');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
let pass=0,fail=0;const ok=(l,c,x)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l+(x?' — '+x:''))};
const seen={};
files.forEach(f=>{
  const src=fs.readFileSync(path.join(dir,f),'utf8');
  ok('script exists and parses: '+f,(()=>{try{new Function(src);return true}catch(e){return false}})());
  // strip strings/comments crudely, then look only at depth-0 declarations
  let depth=0,i=0,line=1,names=[];
  const s=src.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,m=>' '.repeat(m.length));
  const re=/(?:^|\n)(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/g; let m;
  // only count declarations that start at column 0 (top level style used throughout this code base)
  while((m=re.exec(s)))names.push(m[1]);
  names.forEach(n=>{(seen[n]=seen[n]||[]).push(f)});
});
const dups=Object.keys(seen).filter(n=>new Set(seen[n]).size>1);
ok('no top-level name is declared in two scripts',dups.length===0,dups.map(n=>n+' in '+[...new Set(seen[n])].join(' & ')).join('; '));
const dupSame=Object.keys(seen).filter(n=>seen[n].length>1&&new Set(seen[n]).size===1&&!/^(A|I|C)$/.test(n));
ok('no name declared twice inside one script',dupSame.length===0,dupSame.join(', '));
ok('every script listed in index.html exists',files.every(f=>fs.existsSync(path.join(dir,f))));
console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
