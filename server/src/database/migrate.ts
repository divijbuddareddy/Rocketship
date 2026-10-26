import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

export async function migrate() {
  console.log('[Migration] Starting database migration for AI Automation Labs Connect...');
  
  const searchCandidates = [
    typeof __dirname !== 'undefined' ? path.join(__dirname, 'schema.sql') : '',
    path.resolve(process.cwd(), 'server/src/database/schema.sql'),
    path.resolve(process.cwd(), 'dist/server/src/database/schema.sql'),
    path.resolve(process.cwd(), 'schema.sql'),
  ].filter(Boolean);

  const schemaPath = searchCandidates.find(p => fs.existsSync(p));
  if (!schemaPath) {
    throw new Error(`[Migration] schema.sql could not be found. Checked: ${searchCandidates.join(', ')}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('[Migration] Database migration completed successfully.');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Migration Error] Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  migrate()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}
