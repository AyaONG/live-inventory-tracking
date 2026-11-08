'use strict';
const fs=require('fs'),path=require('path');
const {Pool}=require('pg');
function analysisPool(){return new Pool({
 ...(process.env.ANALYSIS_DATABASE_URL?{connectionString:process.env.ANALYSIS_DATABASE_URL}:{database:'ayazhan_inventory'}),
 max:2,connectionTimeoutMillis:5000,options:'-c default_transaction_read_only=on -c statement_timeout=10000'
});}
async function collect(pool,root){
 const c=await pool.connect();
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  const cols=(await c.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('products','stock_movements')")).rows;
  const has=(t,n)=>cols.some(x=>x.table_name===t&&x.column_name===n);
  const fields={price:has('products','price_kzt')?'price_kzt':has('products','price')?'price':null,
   threshold:has('products','reorder_level')?'reorder_level':has('products','reorder_threshold')?'reorder_threshold':null,
   change:has('stock_movements','change_qty')?'change_qty':has('stock_movements','quantity_change')?'quantity_change':null};
  if(Object.values(fields).some(x=>!x))throw Error('Unrecognised analysis schema. No database was modified.');
  const meta=(await c.query(`SELECT current_database() AS database_name,now() AS captured_at,
   (SELECT count(*)::int FROM products) AS products,(SELECT count(*)::int FROM stock_movements) AS movements,
   (SELECT min(created_at) FROM stock_movements) AS history_start,(SELECT max(created_at) FROM stock_movements) AS history_end`)).rows[0];
  if(meta.products<100)throw Error('Part C needs at least 100 products; the selected source contains '+meta.products+'.');
  const specs=[['Q1','q1_low_stock.sql','Which categories contain the most low-stock product lines?','low_stock_count','Product lines (SKUs)'],
   ['Q2','q2_stock_value.sql','Which categories hold the largest stock value at listed prices?','stock_value_kzt','KZT'],
   ['Q3','q3_deliveries.sql','Which categories received the most units in recorded deliveries?','units_received','Units received']];
  const questions=[];
  for(const [id,file,title,value,unit]of specs){
   const sql=fs.readFileSync(path.join(root,'endterm/sql',file),'utf8')
    .replace(/\bprice_kzt\b/g,fields.price).replace(/\breorder_level\b/g,fields.threshold).replace(/\bchange_qty\b/g,fields.change);
   questions.push({id,title,value,unit,sql,rows:(await c.query(sql)).rows});
  }
  await c.query('COMMIT');
  return {metadata:{...meta,fields,synthetic_data:true,source_note:'Assignment 3 analytical source; separate from the live A4 catalogue.'},questions};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
function interpretation(a){
 const top=q=>q.rows.find(r=>Number(r[q.value])>0), [q1,q2,q3]=a.questions;
 const x=top(q1),y=top(q2),z=top(q3);
 return `The analysis uses ${a.metadata.products} product records and ${a.metadata.movements} stock movements from ${a.metadata.database_name}. ${x?x.category+' has the largest low-stock count ('+x.low_stock_count+' product lines).':'No category currently contains a low-stock product line.'} The accompanying percentage helps account for differences in category size. ${y?y.category+' holds the greatest listed-price stock value ('+Number(y.stock_value_kzt).toFixed(2)+' KZT).':'Listed-price stock value is zero in every category.'} This value is not purchase cost, realised revenue or profit. ${z?z.category+' leads recorded delivery volume ('+z.units_received+' units).':'No positive delivery quantities are recorded.'} Delivery volume measures inbound units across the available history, not sales demand. An administrator could review the low-stock product lines before planning replenishment, then examine how much stock value is concentrated in each category. These records are generated coursework data, so the charts demonstrate a reproducible analytical method rather than real customer behaviour. Opening balances and incomplete history may prevent movement totals from reconciling with current quantities. Prices are current listed prices, not historical transaction prices. The A3 analytical source and the A4 operational catalogue are separate databases and must not be presented as a single migrated dataset.`;
}
module.exports={analysisPool,collect,interpretation};
