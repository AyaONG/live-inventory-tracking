'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(repo,'public/workspace.html'),'utf8');
const js=fs.readFileSync(path.join(repo,'public/studio/r1-products.js'),'utf8');
const server=fs.readFileSync(path.join(repo,'server.js'),'utf8');
test('R1 frontend resources are linked exactly once',()=>{
 assert.equal(html.split('src="/studio/r1-products.js"').length-1,1);
 assert.equal(html.split('href="/studio/r1-products.css"').length-1,1);
});
test('only Administrator sees Add and Delete UI',()=>{
 assert.match(js,/isAdministrator\s*=\s*\(\)\s*=>/);
 assert.match(js,/accountName/);
 assert.match(js,/ensureAdministrator\(\)/);
 assert.match(js,/user\.role !== 'owner'/);
});
test('product creation uses categories and typed payload',()=>{
 assert.match(js,/request\('\/api\/categories'\)/);
 assert.match(js,/request\('\/api\/products', \{method:'POST'/);
 for(const name of ['sku','name','category_id','price','quantity','reorder_threshold']) assert.match(js,new RegExp(name));
});
test('archive requires exact SKU and server confirmation at any stock quantity',()=>{
 assert.match(js,/typedSku !== current\.sku/);
 assert.doesNotMatch(js,/Number\(current\.quantity\) !== 0/);
 assert.match(js,/method:'DELETE'/);
 assert.match(js,/confirm_sku:typedSku/);
});
test('backend enforces Administrator role on both operations',()=>{
 assert.match(server,/app\.post\('\/api\/products', admin/);
 assert.match(server,/app\.delete\('\/api\/products\/:id', admin/);
});
test('frontend refreshes the host SPA without changing its internal router',()=>{
 assert.match(js,/refreshButton/);
 assert.match(js,/MutationObserver/);
 assert.match(js,/productDialog/);
});
