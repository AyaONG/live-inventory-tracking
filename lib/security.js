'use strict';
const crypto = require('crypto');
const ROLE_LABELS = { owner: 'Administrator', employee: 'Seller', customer: 'Buyer' };
const canWrite = role => role === 'owner' || role === 'employee';
function positiveId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function validateMovement(body, role) {
  const { product_id, quantity_change, reason } = body || {};
  if (!canWrite(role)) return 'Only an administrator or seller can change stock.';
  if (!Number.isSafeInteger(product_id) || product_id <= 0 || !Number.isInteger(quantity_change)
      || quantity_change === 0 || Math.abs(quantity_change) > 10000) return 'Use a product and a non-zero whole-number change between -10000 and 10000.';
  if (!['sale', 'delivery', 'correction'].includes(reason)) return 'Unknown stock-change reason.';
  if (reason === 'sale' && quantity_change >= 0) return 'A sale must reduce stock: use a negative quantity.';
  if (reason === 'delivery' && quantity_change <= 0) return 'A delivery must increase stock: use a positive quantity.';
  if (reason === 'correction' && role !== 'owner') return 'Only the administrator can make stock corrections.';
  return null;
}
function validateVideoMetadata(body) {
  const b = body || {};
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const transcript = typeof b.transcript === 'string' ? b.transcript.trim() : '';
  const scope = b.scope;
  const unit_reference = typeof b.unit_reference === 'string' ? b.unit_reference.trim() : '';
  if (title.length < 3 || title.length > 120) throw new Error('Video title must contain 3–120 characters.');
  if (transcript.length < 10 || transcript.length > 5000) throw new Error('Add a 10–5000 character transcript / description of what is shown.');
  if (!['model_example', 'specific_unit'].includes(scope)) throw new Error('Choose model demonstration or a specific unit.');
  if (scope === 'specific_unit' && (unit_reference.length < 2 || unit_reference.length > 100)) throw new Error('Enter a store unit or batch reference (2–100 characters).');
  if (unit_reference.length > 100) throw new Error('Unit reference is too long.');
  if (b.own_content !== true) throw new Error('Confirm that your team owns the recording and has permission from anyone shown.');
  const recorded_on = b.recorded_on || null;
  if (recorded_on) {
    if (typeof recorded_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(recorded_on)) throw new Error('Invalid recording date.');
    const d = new Date(recorded_on + 'T00:00:00Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== recorded_on || recorded_on > new Date().toISOString().slice(0,10)) throw new Error('Recording date must be a real date, not in the future.');
  }
  return { title, transcript, scope, unit_reference: scope === 'specific_unit' ? unit_reference : null, recorded_on };
}
function canViewVideo(user, video) {
  return video.status === 'published' || Boolean(user && (user.role === 'owner' || (user.role === 'employee' && Number(user.user_id) === Number(video.uploaded_by))));
}
function cookieToken(req) {
  const m = /(?:^|;\s*)inventory_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
const sessionKey = token => crypto.createHash('sha256').update(token).digest('hex');
module.exports = { ROLE_LABELS, canWrite, positiveId, validateMovement, validateVideoMetadata, canViewVideo, cookieToken, sessionKey };
