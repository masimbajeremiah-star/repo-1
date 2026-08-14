import { readdir, readFile } from 'node:fs/promises';

export async function discoverMigrationFiles(migrationsUrl) {
  const entries = await readdir(migrationsUrl, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export async function runMigrationFiles({ migrationsUrl, query, onApplied = () => {} }) {
  const files = await discoverMigrationFiles(migrationsUrl);
  if (files.length === 0) throw new Error('No SQL migration files were discovered');

  for (const file of files) {
    const sql = await readFile(new URL(file, migrationsUrl), 'utf8');
    await query('BEGIN');
    try {
      await query('SET LOCAL search_path TO public');
      await query(sql);
      await query('COMMIT');
      onApplied(file);
    } catch (error) {
      await query('ROLLBACK').catch(() => {});
      throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
    }
  }

  return files;
}
