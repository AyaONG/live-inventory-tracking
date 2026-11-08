'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main=read('public/studio/studio.js');
const html=read('public/workspace.html');
const extra=read('public/studio/final-integration.js');
function module(){
 const context={window:{},crypto:require('node:crypto').webcrypto,document:{getElementById:()=>null},setTimeout:()=>{},URL,Blob};
 vm.createContext(context);vm.runInContext(extra,context);return context.window.StockroomFinal;
}
test('Stockroom includes barcode route and role restriction',()=>{
 assert.match(main,/items\.push\(\['barcode','Barcode simulator'\]\)/);
 assert.match(main,/\['overview','activity','barcode'\]\.includes\(route\)/);
 assert.match(html,/final-integration\.js/);
 assert.doesNotMatch(html,/href="\/(?:index|endterm|analysis)\.html"/);
 assert.doesNotMatch(main,/href="\/(?:index|endterm|analysis)\.html"/);
});
test('Historical A3 is read separately from live inventory',async()=>{
 const mod=module();mod.setMode('historical');
 const req=[];const api=async u=>{req.push(u);return {metadata:{database_name:'ayazhan_inventory',products:153,movements:69,captured_at:'2026-11-01'},questions:[{id:'Q1',title:'Low stock',unit:'products',value:'n',rows:[{category:'Cables',n:4}],sql:'SELECT 1'}]};};
 await mod.loadHistorical(api);
 assert.equal(req[0],'/api/endterm/analysis');
 assert.match(mod.historicalHtml(),/ayazhan_inventory/);
 assert.match(mod.historicalHtml(),/not merged with inventory_db/);
 assert.match(mod.historicalHtml(),/SELECT 1/);
});
test('Scan is read-only until separate confirmation; retry reuses event',async()=>{
 const mod=module();const calls=[];const records=[];let confirmed=0;
 const api=async(url,opts={})=>{
  calls.push([url,opts]);
  if(url==='/api/endterm/barcodes')return [{barcode:'DEMO-ADP-001',sku:'ADP-001',name:'Adapter',quantity:10}];
  if(url==='/api/endterm/scans'&&!opts.method)return records;
  if(url==='/api/endterm/scans'&&opts.method==='POST'){
   const b=JSON.parse(opts.body);records.push({barcode:b.barcode,source:'simulation',movement_id:null});return {event_id:b.event_id,found:true,product:{product_id:1,sku:'ADP-001',name:'Adapter',quantity:10},message:'Product found'};
  }
  if(url.endsWith('/confirm')){confirmed++;const b=JSON.parse(opts.body);return {movement_id:74,quantity:10+b.quantity_change,replayed:confirmed>1};}
  throw Error('Unexpected '+url);
 };
 await mod.loadBarcode(api);
 const rerender=async()=>{};
 await mod.submitScan({querySelector:x=>({value:x==='#finalBarcodeCode'?'DEMO-ADP-001':'sim-browser-01'})},api,rerender);
 assert.equal(confirmed,0);assert.equal(mod.model.scan.product.quantity,10);
 await mod.submitConfirm({querySelector:x=>({value:x==='#finalBarcodeReason'?'delivery':'2'})},api,rerender);
 assert.equal(confirmed,1);assert.equal(mod.model.confirmation.quantity,12);
 const event=mod.model.scan.event_id;
 await mod.doAction('retry',api,rerender);
 assert.equal(confirmed,2);assert.equal(mod.model.confirmation.replayed,true);
 const writes=calls.filter(([u])=>u.endsWith('/confirm'));
 assert.equal(writes.length,2);assert.equal(writes[0][0],writes[1][0]);assert.equal(writes[0][1].body,writes[1][1].body);assert.equal(writes[0][0],`/api/endterm/scans/${event}/confirm`);
});
test('No server or database files changed by integration payload',()=>{
 assert.ok(fs.existsSync(path.join(root,'lib/endterm.js')));
 assert.ok(fs.existsSync(path.join(root,'server.js')));
});
