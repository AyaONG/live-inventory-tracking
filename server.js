'use strict';
// A4 extension: three real server-side roles and moderated, product-linked videos.
const { mount: mountEndterm } = require('./lib/endterm');
const { analysisPool } = require('./lib/endterm-analysis');
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { ROLE_LABELS, canWrite, positiveId, validateMovement, validateVideoMetadata, canViewVideo, cookieToken, sessionKey } = require('./lib/security');
const { receiveVideo, inspectVideo, MAX_VIDEO_BYTES, MAX_SECONDS } = require('./lib/video');
const { validateCreateProduct, validDeleteConfirmation } = require('./lib/product-crud');

function createApp({ pool, analysis = null, root = __dirname, demoMode = process.env.DEMO_MODE !== '0' }) {
  const app = express();
  const ownsAnalysis = !analysis;
  const a3 = analysis || analysisPool();
  app.disable('x-powered-by');
  const sessions = new Map();
  const attempts = new Map();
  const activeUploads = new Set();
  const storage = path.join(root, 'storage', 'videos');
  const sessionMs = 60 * 60 * 1000;
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const makeError = (status, message) => Object.assign(new Error(message), { status });
  const needUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Please log in.' });
  const roles = (...allowed) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Your role does not permit this action.' });
    next();
  };
  const staff = roles('owner', 'employee');
  const admin = roles('owner');
  const sessionCookie = (value, maxAge) => `inventory_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`;
  const clearSession = (req, res) => {
    const token = cookieToken(req); if (token) sessions.delete(sessionKey(token));
    res.setHeader('Set-Cookie', sessionCookie('', 0));
  };
  const isUUID = value => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  async function videoRecord(id) {
    if (!isUUID(id)) throw makeError(404, 'Video not found.');
    const r = await pool.query('SELECT * FROM product_videos WHERE video_id=$1', [id]);
    if (!r.rows[0]) throw makeError(404, 'Video not found.');
    return r.rows[0];
  }
  function publicVideo(v) {
    const { file_name, ...rest } = v;
    return { ...rest, file_url: `/api/videos/${v.video_id}/file`, download_url: `/api/videos/${v.video_id}/download` };
  }
  async function refreshAlert(client, product) {
    if (product.quantity <= product.reorder_threshold) {
      const r = await client.query(`INSERT INTO alerts (product_id,quantity_at_alert)
        SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE product_id=$1 AND is_resolved=false)`, [product.product_id, product.quantity]);
      return r.rowCount > 0;
    }
    await client.query('UPDATE alerts SET is_resolved=true WHERE product_id=$1 AND is_resolved=false', [product.product_id]);
    return false;
  }
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires <= now) sessions.delete(key);
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  }, 60000);
  timer.unref();
  app.locals.dispose = () => { clearInterval(timer); if (ownsAnalysis) a3.end().catch(()=>{}); };

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    // Same-origin mutations plus SameSite=Strict cookies protect browser forms.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const expected = new Set([`http://${req.headers.host}`, `https://${req.headers.host}`]);
      if (!expected.has(req.headers.origin)) return res.status(403).json({ error: 'Cross-origin writes are not permitted.' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', wrap(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    req.user = null;
    const token = cookieToken(req);
    if (token) {
      const s = sessions.get(sessionKey(token));
      if (s && s.expires > Date.now()) {
        // Always use the current DB role, not a role supplied by the browser.
        const r = await pool.query('SELECT user_id,email,role FROM users WHERE user_id=$1', [s.user_id]);
        req.user = r.rows[0] || null;
      } else sessions.delete(sessionKey(token));
    }
    next();
  }));

  app.get('/api/config', (req, res) => res.json({
    demo: demoMode, max_video_bytes: MAX_VIDEO_BYTES, max_video_seconds: MAX_SECONDS,
    demo_accounts: demoMode ? [
      { email: 'owner@shop.example', role: 'Administrator' },
      { email: 'employee1@shop.example', role: 'Seller' },
      { email: 'customer@shop.example', role: 'Buyer' }
    ] : [], demo_password: demoMode ? 'Demo1234!' : null
  }));
  app.get('/api/health', wrap(async (req, res) => { await pool.query('SELECT 1'); res.json({ ok: true }); }));
  app.post('/api/login', wrap(async (req, res) => {
    clearSession(req, res);
    const now = Date.now(), key = req.ip;
    let rate = attempts.get(key);
    if (!rate || rate.until <= now) rate = { count: 0, until: now + 15 * 60000 };
    if (rate.count >= 30) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    rate.count++; attempts.set(key, rate);
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 255 || typeof password !== 'string' || password.length > 200) return res.status(400).json({ error: 'Enter an email and password.' });
    const r = await pool.query('SELECT user_id,email,password_hash,role FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    const user = r.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
    attempts.delete(key);
    // Independent browser sessions coexist for multi-user testing.
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(sessionKey(token), { user_id: user.user_id, expires: now + sessionMs });
    res.setHeader('Set-Cookie', sessionCookie(token, 3600));
    res.json({ user_id: user.user_id, email: user.email, role: user.role, role_label: ROLE_LABELS[user.role] });
  }));
  app.post('/api/logout', (req, res) => { clearSession(req, res); res.json({ ok: true }); });
  app.get('/api/me', needUser, (req, res) => res.json({ ...req.user, role_label: ROLE_LABELS[req.user.role] }));

  app.get('/api/products', wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const category = typeof req.query.category === 'string' ? req.query.category.slice(0, 80) : '';
    const r = await pool.query(`SELECT p.product_id,p.sku,p.name,c.name AS category,p.price,p.quantity,p.reorder_threshold,
      (p.quantity<=p.reorder_threshold) AS low_stock,
      (SELECT count(*)::int FROM product_videos v WHERE v.product_id=p.product_id AND v.status='published') AS video_count
      FROM products p JOIN categories c ON c.category_id=p.category_id
      WHERE ($1='' OR p.name ILIKE '%'||$1||'%' OR p.sku ILIKE '%'||$1||'%')
      AND ($2='' OR c.name=$2) AND ($3::boolean=false OR p.quantity<=p.reorder_threshold) ORDER BY p.sku`, [q, category, req.query.low_stock === 'true']);
    res.json(r.rows);
  }));
  app.get('/api/categories', wrap(async (req, res) => res.json((await pool.query('SELECT category_id,name FROM categories ORDER BY name')).rows)));
  app.get('/api/alerts', staff, wrap(async (req, res) => res.json((await pool.query(`SELECT a.alert_id,p.product_id,p.sku,p.name,
    p.quantity,a.quantity_at_alert,a.created_at FROM alerts a JOIN products p ON p.product_id=a.product_id
    WHERE a.is_resolved=false ORDER BY a.created_at DESC`)).rows)));
  app.get('/api/products/:id/movements', staff, wrap(async (req, res) => {
    const id = positiveId(req.params.id); if (!id) throw makeError(400, 'Invalid product.');
    res.json((await pool.query(`SELECT m.movement_id,m.quantity_change,m.reason,m.created_at,u.email
      FROM stock_movements m JOIN users u ON u.user_id=m.user_id WHERE m.product_id=$1 ORDER BY m.movement_id DESC LIMIT 20`, [id])).rows);
  }));
  app.post('/api/stock-movements', staff, wrap(async (req, res) => {
    const error = validateMovement(req.body, req.user.role);
    if (error) throw makeError(req.body?.reason === 'correction' && req.user.role !== 'owner' ? 403 : 400, error);
    const { product_id, quantity_change, reason } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`UPDATE products SET quantity=quantity+$1 WHERE product_id=$2 AND quantity+$1>=0
        RETURNING product_id,sku,name,quantity,reorder_threshold`, [quantity_change, product_id]);
      if (!r.rows[0]) {
        const exists = await client.query('SELECT 1 FROM products WHERE product_id=$1', [product_id]);
        throw makeError(exists.rowCount ? 409 : 404, exists.rowCount ? 'Not enough stock for this change.' : 'Product not found.');
      }
      const p = r.rows[0];
      await client.query('INSERT INTO stock_movements (product_id,user_id,quantity_change,reason) VALUES ($1,$2,$3,$4)', [product_id, req.user.user_id, quantity_change, reason]);
      const new_alert = await refreshAlert(client, p);
      await client.query('COMMIT');
      res.status(201).json({ ...p, low_stock: p.quantity <= p.reorder_threshold, new_alert });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }));
  // Final R1: only Administrator may create products. No existing data is reset.
  app.post('/api/products', admin, wrap(async (req, res) => {
    const checked = validateCreateProduct(req.body);
    if (checked.error) throw makeError(400, checked.error);
    const b = checked.value;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`INSERT INTO products (sku,name,category_id,price,quantity,reorder_threshold)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING product_id,sku,name,category_id,price,quantity,reorder_threshold`,
        [b.sku, b.name, b.category_id, b.price.toFixed(2), b.quantity, b.reorder_threshold]);
      const p = r.rows[0];
      const new_alert = await refreshAlert(client, p);
      await client.query('COMMIT');
      res.status(201).json({ ...p, low_stock: p.quantity <= p.reorder_threshold, new_alert });
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') throw makeError(409, 'SKU already exists. Choose another SKU.');
      if (e.code === '23503') throw makeError(400, 'Select a valid product category.');
      throw e;
    } finally { client.release(); }
  }));

  // Final R1: safe delete: zero quantity, explicit SKU confirmation, no referenced history.
  app.delete('/api/products/:id', admin, wrap(async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) throw makeError(400, 'Invalid product ID.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query('SELECT product_id,sku,quantity FROM products WHERE product_id=$1 FOR UPDATE', [id]);
      const p = r.rows[0];
      if (!p) throw makeError(404, 'Product not found.');
      if (!validDeleteConfirmation(req.body?.confirm_sku, p.sku)) {
        throw makeError(400, 'Enter the exact product SKU to confirm deletion.');
      }
      if (p.quantity !== 0) throw makeError(409, 'Quantity must be zero before deleting a product.');
      // Never discard linked stock history, videos, scanner events or supplier data.
      const dependent = ['stock_movements', 'product_videos', 'scan_events', 'product_suppliers', 'product_barcodes'];
      for (const table of dependent) {
        const exists = await client.query('SELECT to_regclass($1) AS relation', [`public.${table}`]);
        if (exists.rows[0]?.relation) {
          const linked = await client.query(`SELECT 1 FROM ${table} WHERE product_id=$1 LIMIT 1`, [id]);
          if (linked.rowCount) throw makeError(409, `Cannot delete: product has linked records in ${table}. Preserve its history.`);
        }
      }
      const deleted = await client.query('DELETE FROM products WHERE product_id=$1 RETURNING product_id', [id]);
      if (!deleted.rowCount) throw makeError(404, 'Product not found.');
      await client.query('COMMIT');
      res.json({ ok: true, deleted_product_id: id });
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23503') throw makeError(409, 'Cannot delete: another record refers to this product.');
      throw e;
    } finally { client.release(); }
  }));

  app.patch('/api/products/:id', admin, wrap(async (req, res) => {
    const id = positiveId(req.params.id), b = req.body || {};
    if (!id || typeof b.name !== 'string' || b.name.trim().length < 2 || b.name.trim().length > 150 ||
        !Number.isFinite(b.price) || b.price < 0 || b.price > 10000000 || !Number.isInteger(b.reorder_threshold) || b.reorder_threshold < 0 || b.reorder_threshold > 10000) throw makeError(400, 'Check product name, price and reorder threshold.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query('UPDATE products SET name=$1,price=$2,reorder_threshold=$3 WHERE product_id=$4 RETURNING *', [b.name.trim(), b.price.toFixed(2), b.reorder_threshold, id]);
      if (!r.rows[0]) throw makeError(404, 'Product not found.');
      await refreshAlert(client, r.rows[0]); await client.query('COMMIT'); res.json({ ok: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }));

  // Metadata is posted as JSON; the following PUT streams just the MP4 File body.
  app.post('/api/products/:id/videos', staff, wrap(async (req, res) => {
    const id = positiveId(req.params.id); if (!id) throw makeError(400, 'Invalid product.');
    let m; try { m = validateVideoMetadata(req.body); } catch (e) { throw makeError(400, e.message); }
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      // Lock the uploader row so simultaneous reservations cannot bypass its limit.
      await c.query('SELECT user_id FROM users WHERE user_id=$1 FOR UPDATE', [req.user.user_id]);
      const outstanding = await c.query("SELECT count(*)::int AS n FROM product_videos WHERE uploaded_by=$1 AND status='uploading'", [req.user.user_id]);
      if (outstanding.rows[0].n >= 3) throw makeError(409, 'Finish or cancel your existing uploads before starting another.');
      if (!(await c.query('SELECT 1 FROM products WHERE product_id=$1', [id])).rowCount) throw makeError(404, 'Product not found.');
      const videoId = crypto.randomUUID();
      await c.query(`INSERT INTO product_videos
        (video_id,product_id,uploaded_by,title,transcript,scope,unit_reference,recorded_on,own_content,file_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)`, [videoId, id, req.user.user_id, m.title, m.transcript, m.scope, m.unit_reference, m.recorded_on, videoId + '.mp4']);
      await c.query('COMMIT'); res.status(201).json({ video_id: videoId });
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }));
  app.put('/api/videos/:id/content', staff, wrap(async (req, res) => {
    const v = await videoRecord(req.params.id);
    if (v.uploaded_by !== req.user.user_id) throw makeError(403, 'Only the uploader can complete this upload.');
    if (v.status !== 'uploading' || activeUploads.has(v.video_id)) throw makeError(409, 'This upload is already complete or in progress.');
    if (activeUploads.size >= 2) throw makeError(429, 'Two uploads are already running. Try again after they finish.');
    activeUploads.add(v.video_id);
    const temporary = path.join(storage, `${v.video_id}.${crypto.randomUUID()}.part`);
    const destination = path.join(storage, v.file_name);
    let moved = false;
    try {
      await fs.mkdir(storage, { recursive: true, mode: 0o700 });
      const bytes = await receiveVideo(req, temporary);
      const details = await inspectVideo(temporary);
      await fs.rename(temporary, destination); moved = true;
      await pool.query(`UPDATE product_videos SET status='pending',byte_size=$1,duration_seconds=$2,width=$3,height=$4,has_audio=$5
        WHERE video_id=$6 AND status='uploading'`, [bytes, details.duration, details.width, details.height, details.has_audio, v.video_id]);
      res.json({ ok: true, video_id: v.video_id, status: 'pending', ...details, byte_size: bytes });
    } catch (e) {
      await fs.unlink(temporary).catch(() => {});
      if (moved) await fs.unlink(destination).catch(() => {});
      await pool.query("DELETE FROM product_videos WHERE video_id=$1 AND status='uploading'", [v.video_id]).catch(() => {});
      throw makeError(400, e.message);
    } finally { activeUploads.delete(v.video_id); }
  }));
  app.delete('/api/videos/:id/upload', staff, wrap(async (req, res) => {
    const v = await videoRecord(req.params.id);
    if (v.uploaded_by !== req.user.user_id || v.status !== 'uploading' || activeUploads.has(v.video_id)) throw makeError(403, 'Only your inactive upload reservation can be cancelled.');
    await pool.query("DELETE FROM product_videos WHERE video_id=$1 AND status='uploading'", [v.video_id]);
    res.json({ ok: true });
  }));
  app.get('/api/products/:id/videos', wrap(async (req, res) => {
    const id = positiveId(req.params.id); if (!id) throw makeError(400, 'Invalid product.');
    const r = await pool.query(`SELECT v.*,p.sku FROM product_videos v JOIN products p ON p.product_id=v.product_id
      WHERE v.product_id=$1 ORDER BY v.created_at DESC`, [id]);
    res.json(r.rows.filter(v => canViewVideo(req.user, v)).map(publicVideo));
  }));
  app.patch('/api/videos/:id/status', admin, wrap(async (req, res) => {
    const status = req.body?.status;
    if (!['published', 'rejected', 'archived'].includes(status)) throw makeError(400, 'Invalid review decision.');
    if (!isUUID(req.params.id)) throw makeError(404, 'Video not found.');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query('SELECT * FROM product_videos WHERE video_id=$1 FOR UPDATE', [req.params.id]);
      const v = r.rows[0];
      if (!v) throw makeError(404, 'Video not found.');
      if (v.status === 'uploading') throw makeError(409, 'The upload is not complete.');
      if (v.status === status) throw makeError(409, 'This video already has that status.');
      const permitted = { pending: ['published', 'rejected'], published: ['archived'], rejected: ['published', 'archived'], archived: ['published'] };
      if (!permitted[v.status]?.includes(status)) throw makeError(409, 'Invalid status transition.');
      if (status === 'published') await fs.access(path.join(storage, v.file_name)).catch(() => { throw makeError(409, 'The video file is missing; publication was not changed.'); });
      await c.query(`UPDATE product_videos SET status=$1::varchar,reviewed_by=$2,
  published_at=CASE WHEN $1::varchar='published' THEN now() ELSE published_at END WHERE video_id=$3`,
  [status, req.user.user_id, v.video_id]);
      await c.query('INSERT INTO video_review_events (video_id,user_id,previous_status,new_status) VALUES ($1,$2,$3,$4)', [v.video_id, req.user.user_id, v.status, status]);
      await c.query('COMMIT'); res.json({ ok: true, status });
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }));
  const serveVideo = download => wrap(async (req, res, next) => {
    const v = await videoRecord(req.params.id);
    if (v.status === 'uploading' || !canViewVideo(req.user, v)) throw makeError(404, 'Video not found.');
    if (!/^[0-9a-f-]{36}\.mp4$/.test(v.file_name)) throw makeError(404, 'Video not found.');
    res.type('video/mp4');
    if (download) res.setHeader('Content-Disposition', `attachment; filename="product-check-${v.video_id}.mp4"`);
    res.sendFile(path.join(storage, v.file_name), { cacheControl: false, dotfiles: 'deny' }, e => {
      if (!e) return;
      if (res.headersSent) return res.end();
      next(makeError(e.status === 404 ? 404 : 500, 'Video file could not be read.'));
    });
  });
  app.get('/api/videos/:id/file', serveVideo(false));
  app.get('/api/videos/:id/download', serveVideo(true));

  mountEndterm(app,{pool,a3,root,admin,staff,wrap});
  require('./lib/studio').mount(app,{ pool,admin,staff,wrap,root });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  // Never serve storage/ through the static frontend: unpublished videos are protected above.
  app.use(express.static(path.join(root, 'public'), { dotfiles: 'deny', maxAge: 0 }));
  app.use((e, req, res, next) => {
    if (res.headersSent || res.destroyed) return next(e);
    const status = e.status || (e.type === 'entity.too.large' ? 413 : e instanceof SyntaxError ? 400 : 500);
    if (status >= 500) console.error('Request failed:', e.code || e.message);
    res.status(status).json({ error: status >= 500 ? 'Server or database error. Check the server terminal; no automatic reset was performed.' : e.message });
  });
  return app;
}
module.exports = { createApp };
if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  const demoMode = process.env.DEMO_MODE !== '0';
  if (demoMode && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    console.error('Demo accounts must remain local. Do not expose the shared demo password to the internet.'); process.exit(1);
  }
  const pool = require('./db');
  const app = createApp({ pool, demoMode });
  const server = app.listen(Number(process.env.PORT) || 3000, host, () => console.log('Inventory app running at http://localhost:' + (process.env.PORT || 3000) + '\nRoles + videos + End-term workbench enabled. Keep PostgreSQL running.'));
  server.on('error', e => { console.error(e.message); process.exitCode = 1; pool.end(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { app.locals.dispose(); server.close(() => pool.end().then(() => process.exit(0))); });
}
