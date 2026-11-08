'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {derive,options}=require('../lib/studio-analytics');
const opt=options({days:'30',lead:'7',review:'14',buffer:'3'});
const meta={history_start_day:'2026-09-01',window_start:'2026-10-01',window_end_exclusive:'2026-10-31'};
function product(overrides={}){return {product_id:1,sku:'CAB-001',name:'USB-C cable',category:'Cables',quantity:6,price:2500,reorder_threshold:10,sold_units:30,previous_units:0,sale_events:6,sale_days:4,delivered_units:0,correction_events:0,invalid_movements:0,...overrides};}
test('sales scenario uses sold units per complete day, never list-price revenue',()=>{
 const d=derive([product()],[],meta,opt);const p=d.products[0];
 assert.equal(p.recorded_units_per_day,1);assert.equal(p.listed_stock_value,15000);
 assert.equal(p.days_of_cover,6);assert.equal(p.priority,'critical');assert.equal(p.review_quantity,18);
});
test('few recorded sales cannot produce a false precise forecast',()=>{
 const d=derive([product({sale_events:2,sale_days:1})],[],meta,opt);const p=d.products[0];
 assert.equal(p.estimate_available,false);assert.equal(p.days_of_cover,null);assert.equal(p.quantity_basis,'Threshold only; rate evidence limited');
});
test('no recorded sales is an observation, not proof of no demand',()=>{
 const d=derive([product({sold_units:0,sale_events:0,sale_days:0,quantity:21,reorder_threshold:5})],[],meta,opt);
 assert.equal(d.no_sales.length,1);assert.equal(d.summary.no_recorded_sales_count,1);assert.equal(d.products[0].days_of_cover,null);
});
test('zero quantity must be flagged even without sales history',()=>{
 const d=derive([product({quantity:0,sold_units:0,sale_events:0,sale_days:0})],[],meta,opt);
 assert.equal(d.products[0].priority,'critical');assert.equal(d.summary.status.out,1);
});
test('invalid date inputs are refused',()=>assert.throws(()=>options({days:'14'}),/Choose 7, 30 or 90/));
