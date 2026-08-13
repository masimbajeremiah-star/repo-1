const STARTING_CHIPS = 1000;

function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export async function createRepository({ databaseUrl, requireDatabase = false }) {
  if (databaseUrl) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
    await pool.query('SELECT 1');
    return {
      kind: 'postgresql',
      async getUser(id) { return publicUser((await pool.query('SELECT id, display_name AS "displayName", auth_type AS "authType", email, password_hash AS "passwordHash", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE id=$1', [id])).rows[0]); },
      async getUserByEmail(email) { return (await pool.query('SELECT id, display_name AS "displayName", auth_type AS "authType", email, password_hash AS "passwordHash", created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE email=$1', [email])).rows[0] || null; },
      async createUser(input) {
        const result = await pool.query('INSERT INTO users(id,display_name,auth_type,email,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,display_name AS "displayName",auth_type AS "authType",email,created_at AS "createdAt",updated_at AS "updatedAt"', [input.id, input.displayName, input.authType, input.email || null, input.passwordHash || null]);
        await pool.query('INSERT INTO wallets(user_id,chip_balance) VALUES($1,$2)', [input.id, STARTING_CHIPS]);
        return result.rows[0];
      },
      async getWallet(userId) { return Number((await pool.query('SELECT chip_balance FROM wallets WHERE user_id=$1', [userId])).rows[0]?.chip_balance ?? 0); },
      async settleGame({ gameId, winnerId, participants, changes }) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const inserted = await client.query('INSERT INTO game_results(id,winner_id,participants,balance_changes) VALUES($1,$2,$3::jsonb,$4::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id', [gameId, winnerId, JSON.stringify(participants), JSON.stringify(changes)]);
          if (!inserted.rowCount) { await client.query('ROLLBACK'); return null; }
          const rows = {};
          for (const [userId, change] of Object.entries(changes)) {
            await client.query('UPDATE wallets SET chip_balance=GREATEST(0,chip_balance+$2),updated_at=NOW() WHERE user_id=$1', [userId, change]);
            await client.query('INSERT INTO player_statistics(user_id,games_played,games_won) VALUES($1,1,$2) ON CONFLICT(user_id) DO UPDATE SET games_played=player_statistics.games_played+1,games_won=player_statistics.games_won+$2,updated_at=NOW()', [userId, userId === winnerId ? 1 : 0]);
            rows[userId] = Number((await client.query('SELECT chip_balance FROM wallets WHERE user_id=$1', [userId])).rows[0].chip_balance);
          }
          await client.query('COMMIT');
          return rows;
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      },
      async recordKadi(userId) { await pool.query('UPDATE player_statistics SET kadi_calls=kadi_calls+1,updated_at=NOW() WHERE user_id=$1', [userId]); },
      async close() { await pool.end(); },
    };
  }
  if (requireDatabase) throw new Error('PostgreSQL is required but DATABASE_URL is missing');
  const users = new Map();
  const emails = new Map();
  const wallets = new Map();
  const settledGames = new Set();
  return {
    kind: 'memory-development',
    async getUser(id) { return publicUser(users.get(id)); },
    async getUserByEmail(email) { return users.get(emails.get(email)) || null; },
    async createUser(input) { if (input.email && emails.has(input.email)) throw new Error('Email already registered'); users.set(input.id, { ...input, createdAt: new Date(), updatedAt: new Date() }); if (input.email) emails.set(input.email, input.id); wallets.set(input.id, STARTING_CHIPS); return publicUser(users.get(input.id)); },
    async getWallet(id) { return wallets.get(id) ?? STARTING_CHIPS; },
    async settleGame({ gameId, winnerId, participants, changes }) { if (settledGames.has(gameId)) return null; settledGames.add(gameId); for (const id of participants) wallets.set(id, Math.max(0, (wallets.get(id) ?? STARTING_CHIPS) + Number(changes[id] || 0))); return Object.fromEntries(participants.map((id) => [id, wallets.get(id)])); },
    async recordKadi() {},
    async close() {},
  };
}
