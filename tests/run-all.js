'use strict';
// Runs every suite in its own process. Suites that need optional dev dependencies are skipped with a note.
const {spawnSync}=require('child_process'), path=require('path');
const suites=[['cloud.test.js',[]],['globals.test.js',[]],['security.test.js',[]],['gateway.test.js',[]],['accounting.test.js',[]],['intelligence.test.js',[]],['business.test.js',[]],['trades.test.js',[]],['dashboard.test.js',[]],
  ['regions.test.js',['@xmldom/xmldom']],['online.test.js',['@xmldom/xmldom','jsqr']]];
let failed=0,total=0;
for(const [f,deps] of suites){
  const miss=deps.filter(d=>{try{require.resolve(d);return false}catch(e){return true}});
  if(miss.length){console.log('SKIP  '+f+'  (npm install to get: '+miss.join(', ')+')');continue}
  const r=spawnSync(process.execPath,['--no-warnings',path.join(__dirname,f)],{encoding:'utf8',timeout:240000});
  const out=(r.stdout||'')+(r.stderr||''), m=out.match(/(\d+) passed, (\d+) failed/), passed=(out.match(/^PASS/gm)||[]).length, bad=(out.match(/^FAIL.*$/gm)||[]);
  total+=passed;
  if(r.status!==0||bad.length){failed++;console.log('FAIL  '+f+'  '+(m?m[0]:'')+'\n'+bad.slice(0,10).join('\n')+(m?'':'\n'+out.split('\n').slice(-8).join('\n')))}
  else console.log('ok    '+f+'  '+(m?m[0]:passed+' checks'));
}
console.log('\n'+(failed?failed+' suite(s) failed':'All suites passed')+' — '+total+' checks');
process.exit(failed?1:0);
