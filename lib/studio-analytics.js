'use strict';
// Read-only business analytics for the OPERATIONAL A4 database.
// No migrations, no seed records and no fallback to historical A3/JSON values.
const TZ = 'Asia/Almaty';
const LIMITS = { minSaleEvents: 5, minSaleDays: 3 };
const fail = message => Object.assign(new Error(message), { status: 400 });
function integer(value, fallback, min, max, label) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw fail(`${label} must be a whole number.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw fail(`${label} must be between ${min} and ${max}.`);
  return n;
}
function options(query = {}) {
  const days = integer(query.days, 30, 7, 90, 'Period');
  if (![7, 30, 90].includes(days)) throw fail('Choose 7, 30 or 90 complete days.');
  return {
    days,
    lead_days: integer(query.lead, 7, 0, 90, 'Lead time'),
    review_days: integer(query.review, 14, 1, 90, 'Review cycle'),
    buffer_days: integer(query.buffer, 3, 0, 30, 'Buffer'),
    category: typeof query.category === 'string' ? query.category.trim().slice(0, 80) : ''
  };
}
function dateOffset(date, delta) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10);
}
const round = (n, digits = 2) => Number(n.toFixed(digits));
function derive(rows, trend, meta, opt) {
  const normalized = rows.map(row => {
    const p = { ...row };
    for (const key of ['product_id','quantity','price','reorder_threshold','sold_units','previous_units','sale_events','sale_days','delivered_units','correction_events','invalid_movements']) p[key] = Number(p[key] || 0);
    p.recorded_units_per_day = p.sold_units / opt.days;
    p.listed_stock_value = round(p.quantity * p.price);
    // This is a scenario, not a fitted demand model. Stockout exposure/product age are unknown.
    const broadWindow = meta.history_start_day && meta.history_start_day <= meta.window_start;
    p.estimate_available = Boolean(broadWindow && p.sale_events >= LIMITS.minSaleEvents && p.sale_days >= LIMITS.minSaleDays && !p.invalid_movements);
    p.days_of_cover = p.estimate_available ? round(p.quantity / p.recorded_units_per_day, 1) : null;
    p.no_recorded_sales = p.sold_units === 0 && p.quantity > 0;
    p.stock_status = p.quantity === 0 ? 'out' : p.quantity <= p.reorder_threshold ? 'low' : 'healthy';
    p.priority = null; p.reason = '';
    if (p.quantity === 0) { p.priority = 'critical'; p.reason = 'Out of stock'; }
    else if (p.estimate_available && p.days_of_cover <= opt.lead_days) { p.priority = 'critical'; p.reason = 'May run out before delivery'; }
    else if (p.quantity <= p.reorder_threshold) { p.priority = 'high'; p.reason = 'Reorder threshold reached'; }
    else if (p.estimate_available && p.days_of_cover <= opt.lead_days + opt.buffer_days) { p.priority = 'watch'; p.reason = 'Approaching replenishment window'; }
    const rateTarget = p.estimate_available ? Math.ceil(p.recorded_units_per_day * (opt.lead_days + opt.review_days + opt.buffer_days)) : 0;
    p.review_quantity = p.priority ? Math.max(0, Math.max(p.reorder_threshold + 1, rateTarget) - p.quantity) : 0;
    p.quantity_basis = p.estimate_available ? 'Sales-rate scenario and threshold' : 'Threshold only; rate evidence limited';
    p.estimate_note = p.estimate_available ? 'Indicative: assumes the same recorded rate and no inbound stock.' : 'Needs 5 sale records on 3 days and a window covered by the movement history; stock availability still unverified.';
    return p;
  });
  const products = normalized.filter(p => !opt.category || p.category === opt.category);
  const rank = { critical: 0, high: 1, watch: 2 };
  const queue = products.filter(p => p.priority).sort((a,b) => rank[a.priority] - rank[b.priority] || (a.days_of_cover ?? 1e9) - (b.days_of_cover ?? 1e9) || a.sku.localeCompare(b.sku));
  const fastest = products.filter(p => p.sold_units > 0).sort((a,b) => b.sold_units-a.sold_units || a.sku.localeCompare(b.sku)).slice(0,10);
  const noSales = products.filter(p => p.no_recorded_sales).sort((a,b) => b.listed_stock_value-a.listed_stock_value || a.sku.localeCompare(b.sku));
  const total = key => products.reduce((a,p) => a + p[key], 0);
  const sold = total('sold_units'), previous = total('previous_units');
  const status = { healthy: 0, low: 0, out: 0 }; products.forEach(p => status[p.stock_status]++);
  const summary = {
    products: products.length, units_on_hand: total('quantity'), units_sold: sold,
    previous_units_sold: previous, sales_change_percent: previous > 0 ? round((sold-previous)/previous*100,1) : null,
    listed_stock_value: round(total('listed_stock_value')), needs_attention: queue.length,
    no_recorded_sales_count: noSales.length, no_recorded_sales_value: round(noSales.reduce((a,p)=>a+p.listed_stock_value,0)),
    estimates_available: products.filter(p=>p.estimate_available).length, status
  };
  return {
    meta: { ...meta, timezone: TZ, calculation: 'Recorded sales; inventory_db operational connection', inventory_basis: 'Current stock now; sales over complete historical days', forecast_type: 'Constant-rate scenario, not a guaranteed date', limitations: ['Stockout exposure and product introduction dates are not tracked.', 'Purchase orders and supplier lead times are not recorded; scenario inputs are assumptions.', 'No historical cost or sale price: valuation is at current list prices, not revenue or profit.', 'Zero means no recorded sales, not proven absence of demand.'], safeguards: LIMITS },
    options: opt, summary, trend: trend.map(r=>({date:String(r.day).slice(0,10),units:Number(r.units),previous_units:Number(r.previous_units)})),
    queue, fastest, no_sales: noSales, products, categories: [...new Set(normalized.map(p=>p.category))].sort()
  };
}
async function collect(pool, query = {}) {
  const opt = options(query); const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await c.query("SET LOCAL statement_timeout = '8s'");
    const clock = (await c.query(`SELECT current_database() AS database_name, now() AS captured_at,
      (now() AT TIME ZONE '${TZ}')::date::text AS local_today,
      (SELECT min(created_at) FROM stock_movements) AS history_start,
      (SELECT max(created_at) FROM stock_movements) AS history_end,
      (SELECT (min(created_at) AT TIME ZONE '${TZ}')::date::text FROM stock_movements) AS history_start_day`)).rows[0];
    const end = clock.local_today, start = dateOffset(end,-opt.days), previousStart = dateOffset(start,-opt.days);
    const args = [start,end,previousStart];
    const rows = (await c.query(`WITH bounds AS (
      SELECT $1::date::timestamp AT TIME ZONE '${TZ}' AS start_at,
             $2::date::timestamp AT TIME ZONE '${TZ}' AS end_at,
             $3::date::timestamp AT TIME ZONE '${TZ}' AS previous_at)
      SELECT p.product_id,p.sku,p.name,c.name AS category,p.quantity,p.price,p.reorder_threshold,
       COALESCE(SUM(-m.quantity_change) FILTER (WHERE m.reason='sale' AND m.quantity_change<0 AND m.created_at>=b.start_at AND m.created_at<b.end_at),0)::int AS sold_units,
       COALESCE(SUM(-m.quantity_change) FILTER (WHERE m.reason='sale' AND m.quantity_change<0 AND m.created_at>=b.previous_at AND m.created_at<b.start_at),0)::int AS previous_units,
       COUNT(m.movement_id) FILTER (WHERE m.reason='sale' AND m.quantity_change<0 AND m.created_at>=b.start_at AND m.created_at<b.end_at)::int AS sale_events,
       COUNT(DISTINCT (m.created_at AT TIME ZONE '${TZ}')::date) FILTER (WHERE m.reason='sale' AND m.quantity_change<0 AND m.created_at>=b.start_at AND m.created_at<b.end_at)::int AS sale_days,
       MAX(m.created_at) FILTER (WHERE m.reason='sale' AND m.quantity_change<0 AND m.created_at<now()) AS last_sale_at,
       COALESCE(SUM(m.quantity_change) FILTER (WHERE m.reason='delivery' AND m.quantity_change>0 AND m.created_at>=b.start_at AND m.created_at<b.end_at),0)::int AS delivered_units,
       COUNT(m.movement_id) FILTER (WHERE m.reason='correction' AND m.created_at>=b.start_at AND m.created_at<b.end_at)::int AS correction_events,
       COUNT(m.movement_id) FILTER (WHERE ((m.reason='sale' AND m.quantity_change>0) OR (m.reason='delivery' AND m.quantity_change<0)) AND m.created_at>=b.start_at AND m.created_at<b.end_at)::int AS invalid_movements
      FROM products p JOIN categories c USING(category_id) CROSS JOIN bounds b
      LEFT JOIN stock_movements m ON m.product_id=p.product_id
      GROUP BY p.product_id,c.name ORDER BY p.sku`,args)).rows;
    const trend = (await c.query(`WITH days AS (SELECT generate_series($1::date, $2::date-1, '1 day'::interval)::date AS d),
      sales AS (SELECT (m.created_at AT TIME ZONE '${TZ}')::date AS d,SUM(-m.quantity_change)::int AS units
        FROM stock_movements m JOIN products p USING(product_id) JOIN categories c USING(category_id)
        WHERE m.reason='sale' AND m.quantity_change<0 AND ($4='' OR c.name=$4)
          AND m.created_at >= ($3::date::timestamp AT TIME ZONE '${TZ}')
          AND m.created_at < ($2::date::timestamp AT TIME ZONE '${TZ}')
        GROUP BY 1)
      SELECT days.d::text AS day,COALESCE(s.units,0)::int AS units,COALESCE(prev.units,0)::int AS previous_units
      FROM days LEFT JOIN sales s ON s.d=days.d LEFT JOIN sales prev ON prev.d=days.d-$5::int ORDER BY days.d`,[start,end,previousStart,opt.category,opt.days])).rows;
    await c.query('COMMIT');
    return derive(rows,trend,{...clock,window_start:start,window_end_exclusive:end,previous_start:previousStart},opt);
  } catch (e) { await c.query('ROLLBACK').catch(()=>{}); throw e; } finally { c.release(); }
}
module.exports = { collect,derive,options,dateOffset,TZ };
