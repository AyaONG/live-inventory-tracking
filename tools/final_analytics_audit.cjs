'use strict';
// Run on machine with PostgreSQL. SELECT-only; compares business KPI totals to chart datasets.
const fs=require('node:fs');const path=require('node:path');
const pool=require('../db');const {collect}=require('../lib/studio-analytics');
const sum=(rows,key)=>rows.reduce((v,r)=>v+Number(r[key]||0),0);
const check=(condition,message)=>{if(!condition)throw new Error(message);};
(async()=>{
 const records=[];
 try {
  for(const days of [7,30,90]){
   const d=await collect(pool,{days:String(days)});
   check(d.options.days===days,`Period mismatch ${days}`);
   check(d.products.length===d.summary.products,`Product count mismatch ${days}`);
   check(sum(d.products,'sold_units')===d.summary.units_sold,`Sales mismatch ${days}`);
   check(sum(d.trend,'units')===d.summary.units_sold,`Trend vs sales mismatch ${days}`);
   check(d.trend.length===days,`Trend must have ${days} complete dates`);
   check(Object.values(d.summary.status).reduce((a,b)=>a+b,0)===d.summary.products,`Stock status mismatch ${days}`);
   check(d.queue.length===d.summary.needs_attention,`Replenishment count mismatch ${days}`);
   check(d.no_sales.length===d.summary.no_recorded_sales_count,`No sales mismatch ${days}`);
   check(d.no_sales.every(p=>p.sold_units===0&&p.quantity>0),`No-sale definition mismatch ${days}`);
   check(d.fastest.every((p,i,a)=>p.sold_units>0 && (!i||a[i-1].sold_units>=p.sold_units)),`Ranking mismatch ${days}`);
   check(d.products.every(p=>p.days_of_cover===null||p.estimate_available),`Forecast safeguard mismatch ${days}`);
   records.push({days,database:d.meta.database_name,window_start:d.meta.window_start,window_end_exclusive:d.meta.window_end_exclusive,products:d.summary.products,units_sold:d.summary.units_sold,needs_attention:d.summary.needs_attention,no_recorded_sales:d.summary.no_recorded_sales_count,listed_stock_value:d.summary.listed_stock_value,estimated_products:d.summary.estimates_available,checks:'PASS'});
  }
  const output=path.resolve(__dirname,'../endterm_output/final_analytics_audit.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify({scope:'Read-only live PostgreSQL checks. Synthetic coursework data. Not external usability testing.',checked_at:new Date().toISOString(),records},null,2));
  console.table(records);console.log('PASS: analytics is consistent for 7/30/90 days. Report:',output);
 } finally {await pool.end()}
})().catch(e=>{console.error('AUDIT FAILED:',e.code||e.message);process.exitCode=1});
