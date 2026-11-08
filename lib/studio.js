'use strict';
const path = require('path');
const { collect } = require('./studio-analytics');
function csvCell(v) { let s=String(v??''); if(typeof v==='string' && /^[=+\-@\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }
function csv(rows, keys) { return '\uFEFF'+[keys.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n'); }
function mount(app,{ pool,admin,staff,wrap,root=path.join(__dirname,'..') }) {
  app.get('/api/studio/analytics',admin,wrap(async(req,res)=>res.json(await collect(pool,req.query))));
  app.get('/api/studio/reorder.csv',admin,wrap(async(req,res)=>{
    const d=await collect(pool,req.query);
    const rows=d.queue.map(p=>({sku:p.sku,name:p.name,quantity:p.quantity,recorded_units_per_day:p.recorded_units_per_day.toFixed(3),days_of_cover:p.days_of_cover??'Insufficient evidence',review_quantity:p.review_quantity,basis:p.quantity_basis,priority:p.priority,window_start:d.meta.window_start,window_end_exclusive:d.meta.window_end_exclusive,lead_days:d.options.lead_days,review_days:d.options.review_days,buffer_days:d.options.buffer_days}));
    const keys=['sku','name','quantity','recorded_units_per_day','days_of_cover','review_quantity','basis','priority','window_start','window_end_exclusive','lead_days','review_days','buffer_days'];
    res.type('text/csv').set('Content-Disposition','attachment; filename="replenishment-review.csv"').send(csv(rows,keys));
  }));
  app.get('/api/studio/movements',staff,wrap(async(req,res)=>{
    const reason=['sale','delivery','correction'].includes(req.query.reason)?req.query.reason:'';
    const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,100):'';
    const rows=(await pool.query(`SELECT m.movement_id,m.product_id,p.sku,p.name,m.quantity_change,m.reason,m.created_at,m.user_id
      FROM stock_movements m JOIN products p USING(product_id)
      WHERE ($1='' OR m.reason=$1) AND ($2='' OR p.name ILIKE '%'||$2||'%' OR p.sku ILIKE '%'||$2||'%')
      ORDER BY m.movement_id DESC LIMIT 100`,[reason,q])).rows;
    res.json({rows,limit:100});
  }));
  app.get('/api/studio/videos',wrap(async(req,res)=>{
    const rows=(await pool.query(`SELECT v.video_id,v.product_id,p.sku,p.name AS product_name,v.title,v.status,v.duration_seconds,v.created_at,v.uploaded_by
      FROM product_videos v JOIN products p USING(product_id)
      WHERE v.status='published' OR $1::boolean OR v.uploaded_by=$2
      ORDER BY v.created_at DESC LIMIT 100`,[req.user?.role==='owner',req.user?.user_id||0])).rows;
    res.json({rows,limit:100});
  }));
  // The original interface stays at /index.html; raw-image comparison is unchanged.
  app.get('/',(req,res,next)=>{
    if(req.query.raw!==undefined || req.query.legacy!==undefined) return next();
    res.sendFile(path.join(root,'public','workspace.html'));
  });
}
module.exports={mount,csvCell};
