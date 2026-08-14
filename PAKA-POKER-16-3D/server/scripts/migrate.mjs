import pg from 'pg';
import { runMigrationFiles } from '../src/services/migrationRunner.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
try {
  const files = await runMigrationFiles({
    migrationsUrl: new URL('../migrations/', import.meta.url),
    query: pool.query.bind(pool),
    onApplied: (file) => console.log(`Applied migration: ${file}`),
  });
  const verification = await pool.query("SELECT to_regclass('public.mpesa_transactions') IS NOT NULL AS present");
  if (verification.rows[0]?.present !== true) throw new Error('Required relation public.mpesa_transactions is missing after migrations');
  console.log(`Database migrations complete (${files.length} files)`);
} finally {
  await pool.end();
}
