'use strict';
// Read-only native PostgreSQL/video-storage diagnostic; DOES NOT create/edit/delete records.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
async function main() {
  const pool = require('../db');
  try {
    const version = await pool.query('SELECT current_database() AS database');
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('product_videos','video_review_events') ORDER BY table_name`);
    const found = tables.rows.map(r=>r.table_name);
    const rows = await pool.query(`SELECT video_id,title,status,file_name,created_at,published_at
      FROM product_videos ORDER BY created_at DESC LIMIT 20`);
    let missing = 0;
    console.log('DATABASE:', version.rows[0].database);
    console.log('TABLES:', found.join(', '));
    for (const row of rows.rows) {
      const file = path.join(root,'storage','videos',row.file_name);
      const present = fs.existsSync(file);
      if (!present && row.status !== 'uploading') missing++;
      console.log(`${row.status.padEnd(10)} ${present?'FILE OK':'FILE NOT FOUND'} ${row.title} [${row.video_id}]`);
    }
    const probe = spawnSync(process.env.FFPROBE_PATH || 'ffprobe',['-version'],{encoding:'utf8'});
    console.log('FFPROBE:',probe.status===0?'available':'missing (required for new uploads)');
    console.log('PENDING PUBLICATIONS:',rows.rows.filter(r=>r.status==='pending').length);
    console.log('MISSING COMPLETED FILES:', missing);
    console.log('READ-ONLY: no table, video, stock or account was changed.');
    if(found.length!==2||missing)process.exitCode=1;
  } finally { await pool.end(); }
}
main().catch(e=>{console.error('PREFLIGHT ERROR:',e.code||e.message);process.exitCode=1;});
