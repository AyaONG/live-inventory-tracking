'use strict';
const path = require('path');
const fs = require('fs');
const projectIndex = process.argv.indexOf('--project');
const project = projectIndex >= 0 ? path.resolve(process.argv[projectIndex + 1]) : path.join(__dirname, '..');
const pool = require(path.join(project, 'db.js'));
const bcrypt = require(require.resolve('bcryptjs', { paths: [project] }));
const migration = fs.readFileSync(path.join(__dirname, '..', 'sql', 'migrations', '002_roles_video.sql'), 'utf8');
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // This signature refuses the A3 schema rather than modifying the wrong project.
    await client.query('SELECT email, role FROM users LIMIT 0');
    await client.query('SELECT price, reorder_threshold FROM products LIMIT 0');
    await client.query('SELECT quantity_change FROM stock_movements LIMIT 0');
    const before = await client.query('SELECT (SELECT count(*)::int FROM products) AS products, (SELECT count(*)::int FROM stock_movements) AS movements');
    await client.query(migration);
    if (process.argv.includes('--demo')) {
      const hash = await bcrypt.hash('Demo1234!', 10);
      for (const [email, role] of [['owner@shop.example', 'owner'], ['employee1@shop.example', 'employee'], ['customer@shop.example', 'customer']]) {
        // Reset only the three explicitly documented fictional demo accounts.
        await client.query(`INSERT INTO users (email,password_hash,role) VALUES ($1,$2,$3)
          ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role`, [email, hash, role]);
      }
    }
    const after = await client.query('SELECT (SELECT count(*)::int FROM products) AS products, (SELECT count(*)::int FROM stock_movements) AS movements');
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0])) throw new Error('Inventory counts changed unexpectedly; rolling back.');
    await client.query('COMMIT');
    console.log('Migration complete. Existing products and stock movements preserved:', after.rows[0]);
    if (process.argv.includes('--demo')) console.log('Demo accounts: owner@shop.example, employee1@shop.example, customer@shop.example. Shared password: Demo1234!');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
main().catch(e => { console.error('Migration failed; transaction rolled back:', e.message); process.exitCode = 1; }).finally(() => pool.end());
