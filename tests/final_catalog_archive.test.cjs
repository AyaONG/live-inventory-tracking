'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const barcode=fs.readFileSync(path.join(root,'lib','endterm.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'sql','migrations','20261109_catalog_archive.sql'),'utf8');
test('Administrator can archive a product at any stock quantity without deleting row',()=>{
  assert.match(server,/app\.delete\('\/api\/products\/:id', admin/);
  assert.match(server,/UPDATE products SET archived_at=now\(\), archived_by=\$2/);
  assert.doesNotMatch(server,/quantity !== 0/);
  assert.doesNotMatch(server,/DELETE FROM products WHERE product_id=/);
});
test('Archive logs event, resolves alerts, keeps stock and movements',()=>{
  assert.match(server,/INSERT INTO product_catalog_events/);
  assert.match(server,/UPDATE alerts SET is_resolved=true WHERE product_id=\$1/);
  assert.match(server,/retained_quantity: p\.quantity/);
});
test('Active catalog excludes archived products and does not accept new stock changes',()=>{
  assert.match(server,/WHERE p\.archived_at IS NULL AND \(\$1=''/);
  assert.match(server,/quantity\+\$1>=0 AND archived_at IS NULL/);
  assert.match(server,/WHERE product_id=\$4 AND archived_at IS NULL/);
});
test('Existing barcode flow excludes archived items, retains old scans and movements',()=>{
  assert.match(barcode,/p\.archived_at IS NULL ORDER BY p\.sku/);
  assert.match(barcode,/WHERE b\.barcode=\$1 AND p\.archived_at IS NULL/);
  assert.match(barcode,/quantity\+\$1>=0 AND archived_at IS NULL/);
  assert.match(barcode,/FROM stock_movements m JOIN products p/);
});
test('Archived products and stock movement history remain accessible only to administrators/staff',()=>{
  assert.match(server,/app\.get\('\/api\/products\/archived', admin/);
  assert.match(server,/app\.get\('\/api\/products\/:id\/catalog-history', admin/);
  assert.match(server,/app\.get\('\/api\/products\/:id\/movements', staff/);
  assert.match(server,/app\.post\('\/api\/products\/:id\/restore', admin/);
});
test('SQL migration is additive: products and movements are never dropped',()=>{
  assert.match(migration,/ADD COLUMN IF NOT EXISTS archived_at/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS product_catalog_events/);
  assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM stock_movements/i);
});
test('R1 UI, if installed, removes zero-quantity restriction and relabels catalog action',()=>{
  const uiPath=path.join(root,'public','studio','r1-products.js');
  if(!fs.existsSync(uiPath)) return;
  const ui=fs.readFileSync(uiPath,'utf8');
  assert.doesNotMatch(ui,/Quantity must be zero before deletion/);
  assert.match(ui,/Remove from active catalog/);
  assert.match(ui,/Archived products/);
});
