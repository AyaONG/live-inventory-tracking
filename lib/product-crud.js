'use strict';

function validateCreateProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Enter product details.' };
  }
  const sku = typeof body.sku === 'string' ? body.sku.trim().toUpperCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category_id = body.category_id;
  const price = body.price;
  const quantity = body.quantity;
  const reorder_threshold = body.reorder_threshold;
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(sku)) return { error: 'SKU must contain 3–30 letters, numbers or hyphens.' };
  if (name.length < 2 || name.length > 150) return { error: 'Product name must contain 2–150 characters.' };
  if (!Number.isSafeInteger(category_id) || category_id < 1) return { error: 'Select an existing product category.' };
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 10000000 || Math.round(price * 100) / 100 !== price) {
    return { error: 'Price must be a valid amount between 0 and 10,000,000, with at most two decimal places.' };
  }
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100000) return { error: 'Initial quantity must be a whole number from 0 to 100000.' };
  if (!Number.isSafeInteger(reorder_threshold) || reorder_threshold < 0 || reorder_threshold > 10000) return { error: 'Reorder threshold must be a whole number from 0 to 10000.' };
  return { value: { sku, name, category_id, price, quantity, reorder_threshold } };
}

function validDeleteConfirmation(input, sku) {
  return typeof input === 'string' && input.trim().toUpperCase() === sku;
}

module.exports = { validateCreateProduct, validDeleteConfirmation };
