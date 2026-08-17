import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { discoverMigrationFiles, runMigrationFiles } from '../src/services/migrationRunner.js';

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'paka-migrations-'));
  const url = pathToFileURL(`${directory}/`);
  return { directory, url };
}

test('migration discovery includes every numbered SQL file in order', async (t) => {
  const { directory, url } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, '002_mpesa_transactions.sql'), 'SELECT 2;');
  await writeFile(path.join(directory, '001_initial.sql'), 'SELECT 1;');
  await writeFile(path.join(directory, 'notes.txt'), 'ignored');
  assert.deepEqual(await discoverMigrationFiles(url), ['001_initial.sql', '002_mpesa_transactions.sql']);
});

test('migration failure rolls back, rejects, and never reports the failed file as applied', async (t) => {
  const { directory, url } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, '001_initial.sql'), 'BROKEN SQL');
  const queries = [];
  const applied = [];
  await assert.rejects(() => runMigrationFiles({
    migrationsUrl: url,
    query: async (sql) => { queries.push(sql); if (sql === 'BROKEN SQL') throw new Error('syntax failure'); },
    onApplied: (file) => applied.push(file),
  }), /Migration 001_initial\.sql failed: syntax failure/);
  assert.deepEqual(applied, []);
  assert.equal(queries.at(-1), 'ROLLBACK');
});

test('production migrations and repository agree on public.mpesa_transactions', async () => {
  const migrationUrl = new URL('../migrations/002_mpesa_transactions.sql', import.meta.url);
  const repositoryUrl = new URL('../src/services/repository.js', import.meta.url);
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(migrationUrl, 'utf8');
  const repository = await readFile(repositoryUrl, 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.mpesa_transactions/);
  assert.match(repository, /INSERT INTO public\.mpesa_transactions/);
  assert.match(repository, /FROM public\.mpesa_transactions/);
  assert.match(repository, /UPDATE public\.mpesa_transactions/);
});

test('monetization migration is additive and contains authoritative entitlement foundations', async () => {
  const migrationUrl = new URL('../migrations/003_monetization_foundation.sql', import.meta.url);
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(migrationUrl, 'utf8');
  for (const table of ['subscriptions', 'cosmetic_items', 'user_cosmetics', 'user_equipped_cosmetics', 'player_progression', 'achievements', 'match_history', 'creator_profiles', 'user_follows', 'clubs', 'club_members']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  }
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
});
