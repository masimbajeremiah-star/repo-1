import { readFile } from 'node:fs/promises';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
await pool.query(sql);
await pool.end();
console.log('Database migrations complete');
