'use strict';
const {collect}=require('./endterm-analysis');
const {validateMovement}=require('./security');
const isUUID=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const error=(status,message)=>Object.assign(new Error(message),{status});
function csvCell(v){let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(rows,keys){return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n')+'\r\n';}
async function confirmScan(c,user,id,body){
 const ev=(await c.query('SELECT * FROM scan_events WHERE event_id=$1 FOR UPDATE',[id])).rows[0];
 if(!ev||ev.user_id!==user.user_id)throw error(404,'Your scan was not found.');
 if(!ev.product_id)throw error(409,'Unknown barcodes cannot change stock.');
 if(ev.movement_id){
  if(ev.confirmed_change!==body.quantity_change||ev.confirmed_reason!==body.reason)throw error(409,'This event already confirmed another operation.');
  return {replayed:true,movement_id:ev.movement_id,quantity:ev.resulting_quantity};
 }
 const b={product_id:ev.product_id,quantity_change:body.quantity_change,reason:body.reason};
 const invalid=validateMovement(b,user.role);if(invalid)throw error(b.reason==='correction'&&user.role!=='owner'?403:400,invalid);
 const p=(await c.query(`UPDATE products SET quantity=quantity+$1 WHERE product_id=$2 AND quantity+$1>=0 AND archived_at IS NULL
  RETURNING product_id,sku,quantity,reorder_threshold`,[b.quantity_change,b.product_id])).rows[0];
 if(!p)throw error(409,'Insufficient stock; no stock change was saved.');
 const movement=(await c.query('INSERT INTO stock_movements(product_id,user_id,quantity_change,reason) VALUES($1,$2,$3,$4) RETURNING movement_id',[b.product_id,user.user_id,b.quantity_change,b.reason])).rows[0];
 if(p.quantity<=p.reorder_threshold)await c.query(`INSERT INTO alerts(product_id,quantity_at_alert) SELECT $1,$2
  WHERE NOT EXISTS(SELECT 1 FROM alerts WHERE product_id=$1 AND is_resolved=false)`,[p.product_id,p.quantity]);
 else await c.query('UPDATE alerts SET is_resolved=true WHERE product_id=$1 AND is_resolved=false',[p.product_id]);
 await c.query(`UPDATE scan_events SET movement_id=$1,confirmed_change=$2,confirmed_reason=$3,resulting_quantity=$4,confirmed_at=now() WHERE event_id=$5`,[movement.movement_id,b.quantity_change,b.reason,p.quantity,id]);
 return {...p,...movement,replayed:false};
}
function mount(app,{pool,a3,root,admin,staff,wrap}){
 app.get('/api/endterm/analysis',admin,wrap(async(req,res)=>{
  try{res.json(await collect(a3,root));}catch(e){console.error('A3 analysis:',e.message);res.status(503).json({error:'A3 analysis unavailable: check ayazhan_inventory and the server terminal. No A4 fallback was used.'});}
 }));
 app.get('/api/endterm/barcodes',staff,wrap(async(req,res)=>res.json((await pool.query(`SELECT b.barcode,p.product_id,p.sku,p.name,p.quantity FROM product_barcodes b JOIN products p USING(product_id) WHERE p.archived_at IS NULL ORDER BY p.sku`)).rows)));
 app.post('/api/endterm/scans',staff,wrap(async(req,res)=>{
  const {event_id,barcode,device_id}=req.body||{};
  if(!isUUID(event_id)||typeof barcode!=='string'||!barcode.trim()||barcode.length>80||typeof device_id!=='string'||!/^[A-Za-z0-9_.-]{1,60}$/.test(device_id))throw error(400,'Invalid scan fields.');
  const p=(await pool.query('SELECT p.product_id,p.sku,p.name,p.quantity FROM product_barcodes b JOIN products p USING(product_id) WHERE b.barcode=$1 AND p.archived_at IS NULL',[barcode.trim()])).rows[0]||null;
  const insert=await pool.query(`INSERT INTO scan_events(event_id,barcode,device_id,product_id,user_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id) DO NOTHING RETURNING *`,[event_id,barcode.trim(),device_id,p?.product_id||null,req.user.user_id]);
  const ev=insert.rows[0]||(await pool.query('SELECT * FROM scan_events WHERE event_id=$1',[event_id])).rows[0];
  if(ev.user_id!==req.user.user_id||ev.barcode!==barcode.trim()||ev.device_id!==device_id)throw error(409,'Event ID already used for another scan.');
  res.status(insert.rowCount?201:200).json({event_id,product:p,found:Boolean(p),source:'simulation',replayed:!insert.rowCount,message:p?'Product found. Stock is unchanged until confirmation.':'Unknown barcode. No stock was changed.'});
 }));
 app.post('/api/endterm/scans/:id/confirm',staff,wrap(async(req,res)=>{
  if(!isUUID(req.params.id))throw error(400,'Invalid event ID.');
  const c=await pool.connect();try{await c.query('BEGIN');const r=await confirmScan(c,req.user,req.params.id,req.body||{});await c.query('COMMIT');res.status(r.replayed?200:201).json(r);}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }));
 app.get('/api/endterm/scans',staff,wrap(async(req,res)=>res.json((await pool.query(`SELECT event_id,barcode,source,created_at,movement_id,confirmed_change,resulting_quantity FROM scan_events WHERE ($1::boolean OR user_id=$2) ORDER BY created_at DESC LIMIT 30`,[req.user.role==='owner',req.user.user_id])).rows)));
 app.get('/api/endterm/export/:kind',staff,wrap(async(req,res)=>{
  let r,keys;
  if(req.params.kind==='stock'){r=await pool.query('SELECT p.sku,p.name,c.name AS category,p.price AS price_kzt,p.quantity,p.reorder_threshold FROM products p JOIN categories c USING(category_id) WHERE p.archived_at IS NULL ORDER BY p.sku');keys=['sku','name','category','price_kzt','quantity','reorder_threshold'];}
  else if(req.params.kind==='movements'){r=await pool.query('SELECT m.movement_id,p.sku,m.quantity_change,m.reason,m.created_at FROM stock_movements m JOIN products p USING(product_id) ORDER BY m.movement_id DESC');keys=['movement_id','sku','quantity_change','reason','created_at'];}
  else throw error(404,'Unknown export.');
  res.type('text/csv').set('Content-Disposition',`attachment; filename="inventory-${req.params.kind}.csv"`).send(csv(r.rows,keys));
 }));
}
module.exports={mount,confirmScan,csv,csvCell,isUUID};
