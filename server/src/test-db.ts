import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ailabs_connect',
  });
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db;');
    console.log('Postgres connection successful:', res.rows[0]);
    await pool.end();
  } catch (err) {
    console.error('Postgres connection error:', err);
    process.exit(1);
  }
}

main();
