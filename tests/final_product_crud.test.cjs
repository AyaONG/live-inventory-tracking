'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateCreateProduct, validDeleteConfirmation } = require('../lib/product-crud');
const product = { sku:'TEST-PWR-999', name:'Testing power bank',category_id:1,price:1000.00,quantity:0,reorder_threshold:0 };

test('valid product normalizes SKU safely', () => {
  const r = validateCreateProduct({...product, sku:' test-pwr-999 '});
  assert.equal(r.error,undefined);
  assert.equal(r.value.sku,'TEST-PWR-999');
});
test('reject duplicate-looking, invalid SKU characters', () => {
  assert.match(validateCreateProduct({...product,sku:'A/../B'}).error,/SKU/);
});
test('reject negative stock or fractional quantity', () => {
  assert.match(validateCreateProduct({...product,quantity:-1}).error,/quantity/);
  assert.match(validateCreateProduct({...product,quantity:1.5}).error,/quantity/);
});
test('reject invalid price or category', () => {
  assert.match(validateCreateProduct({...product,price:-3}).error,/Price/);
  assert.match(validateCreateProduct({...product,category_id:0}).error,/category/);
});
test('deletion requires matching SKU', () => {
  assert.equal(validDeleteConfirmation('TEST-PWR-999','TEST-PWR-999'),true);
  assert.equal(validDeleteConfirmation('WRONG','TEST-PWR-999'),false);
});
test('R1 server routes are administrator-only and dependents protected', () => {
  const source=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  assert.match(source,/app\.post\('\/api\/products', admin/);
  assert.match(source,/app\.delete\('\/api\/products\/:id', admin/);
  assert.match(source,/stock_movements.*product_videos.*scan_events.*product_suppliers.*product_barcodes/);
  assert.match(source,/FROM products WHERE product_id=\$1 FOR UPDATE/);
});
