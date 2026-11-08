'use strict';
// Static integration contract. Browser/manual user checks still required.
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
test('old pages share one Stockroom design stylesheet and shell',()=>{
 const names=['endterm','index'];
 if(fs.existsSync(path.join(root,'public/analysis.html'))) names.push('analysis');
 for(const name of names){
  const html=read(`public/${name}.html`);
  assert.match(html,/\/studio\/legacy-unified\.css/);
  assert.match(html,/\/studio\/legacy-shell\.js/);
 }
});
test('existing barcode, reports, classic catalogue handlers remain in place',()=>{
 assert.match(read('public/endterm.html'),/id="scanForm"/);
 assert.match(read('public/endterm.html'),/endterm\.js/);
 if(fs.existsSync(path.join(root,'public/analysis.html'))) assert.match(read('public/analysis.html'),/analysis\.js/);
 else {
  assert.doesNotMatch(read('public/studio/legacy-shell.js'),/href=\"\/analysis\.html\"/);
  assert.doesNotMatch(read('public/studio/studio.js'),/href=\"\/analysis\.html\"/);
 }
 assert.match(read('public/index.html'),/app\.js/);
});
test('shared shell retains keyboard navigation and responsive navigation',()=>{
 assert.match(read('public/studio/legacy-unified.css'),/:focus-visible/);
 assert.match(read('public/studio/legacy-unified.css'),/max-width:800px/);
 assert.match(read('public/studio/legacy-shell.js'),/aria-current/);
});
