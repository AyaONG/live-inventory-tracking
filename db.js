const { Pool } = require('pg');

// Postgres.app on Mac: no password, user = your Mac username, so only the database name is needed.
// To use another setup, set DATABASE_URL, for example:
//   DATABASE_URL=postgresql://user:password@localhost:5432/inventory_db
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { database: 'inventory_db' }
);

module.exports = pool;
