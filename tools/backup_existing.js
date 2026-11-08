'use strict';
// Called by the installer BEFORE any migration. Connection follows the existing db.js.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const project = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const pool = require(path.join(project, 'db.js'));
const { Client } = require(require.resolve('pg', { paths: [project] }));
async function main() {
  const r = await pool.query('SELECT current_database() AS database');
  if (r.rows[0].database !== 'inventory_db') throw new Error('This update is only for A4 inventory_db. Your db.js points elsewhere; nothing was changed.');
  await pool.query('SELECT email,role FROM users LIMIT 0');
  await pool.query('SELECT price,reorder_threshold FROM products LIMIT 0');
  const counts = await pool.query('SELECT (SELECT count(*) FROM products) AS products,(SELECT count(*) FROM stock_movements) AS stock_movements,(SELECT count(*) FROM users) AS users');
  const cp = new Client(pool.options).connectionParameters;
  const env = { ...process.env, PGCONNECT_TIMEOUT: '5' };
  if (typeof cp.password === 'string') env.PGPASSWORD = cp.password;
  const result = spawnSync('pg_dump', ['-Fc', '-h', cp.host || 'localhost', '-p', String(cp.port || 5432), '-U', cp.user, '-d', 'inventory_db', '-f', output], { env, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'pg_dump failed.');
  fs.chmodSync(output, 0o600);
  if (fs.statSync(output).size === 0) throw new Error('The dump is empty.');
  const check = spawnSync('pg_restore', ['--list', output], { env, encoding: 'utf8', timeout: 30000 });
  if (check.error || check.status !== 0) throw new Error('pg_restore could not read the backup; update stopped.');
  fs.writeFileSync(output + '.objects.txt', check.stdout, { mode: 0o600 });
  fs.writeFileSync(output + '.counts.json', JSON.stringify(counts.rows[0], null, 2), { mode: 0o600 });
  console.log('Database backup created and its archive index read successfully.');
  console.log('Existing row counts:', counts.rows[0]);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
