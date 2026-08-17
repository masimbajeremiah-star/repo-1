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
      async getCurrentSubscription(userId) {
        return (await pool.query(`SELECT plan,status,provider,current_period_start AS "currentPeriodStart",current_period_end AS "currentPeriodEnd",cancel_at_period_end AS "cancelAtPeriodEnd"
          FROM public.subscriptions WHERE user_id=$1 ORDER BY current_period_end DESC NULLS LAST,created_at DESC LIMIT 1`, [userId])).rows[0] || null;
      },
      async listCosmetics(userId) {
        return (await pool.query(`SELECT item.slug,item.name,item.category,item.description,item.price,item.currency,item.premium_only AS "premiumOnly",
          (owned.cosmetic_id IS NOT NULL) AS owned,(equipped.cosmetic_id IS NOT NULL) AS equipped
          FROM public.cosmetic_items item
          LEFT JOIN public.user_cosmetics owned ON owned.cosmetic_id=item.id AND owned.user_id=$1
          LEFT JOIN public.user_equipped_cosmetics equipped ON equipped.cosmetic_id=item.id AND equipped.user_id=$1
          WHERE item.active=TRUE ORDER BY item.category,item.price,item.name`, [userId])).rows;
      },
      async equipCosmetic(userId, slug, entitlements) {
        const item = (await pool.query(`SELECT item.id,item.slug,item.name,item.category,item.price,item.premium_only AS "premiumOnly",
          EXISTS(SELECT 1 FROM public.user_cosmetics owned WHERE owned.user_id=$1 AND owned.cosmetic_id=item.id) AS owned
          FROM public.cosmetic_items item WHERE item.slug=$2 AND item.active=TRUE`, [userId, slug])).rows[0];
        if (!item) throw Object.assign(new Error('Cosmetic not found'), { statusCode: 404 });
        const plusAccess = item.premiumOnly && entitlements.plan === 'plus';
        const standardAccess = !item.premiumOnly && Number(item.price) === 0;
        if (!item.owned && !plusAccess && !standardAccess) throw Object.assign(new Error('You do not own this cosmetic'), { statusCode: 403 });
        await pool.query(`INSERT INTO public.user_equipped_cosmetics(user_id,category,cosmetic_id) VALUES($1,$2,$3)
          ON CONFLICT(user_id,category) DO UPDATE SET cosmetic_id=EXCLUDED.cosmetic_id,updated_at=NOW()`, [userId, item.category, item.id]);
        return { slug: item.slug, name: item.name, category: item.category };
      },
      async getPlayerProfile(userId) {
        const user = await this.getUser(userId);
        const stats = (await pool.query(`SELECT games_played AS "gamesPlayed",games_won AS "gamesWon",kadi_calls AS "kadiCalls",cards_played AS "cardsPlayed" FROM public.player_statistics WHERE user_id=$1`, [userId])).rows[0] || { gamesPlayed: 0, gamesWon: 0, kadiCalls: 0, cardsPlayed: 0 };
        const progression = (await pool.query(`SELECT xp,level,league,current_streak AS "currentStreak",best_streak AS "bestStreak" FROM public.player_progression WHERE user_id=$1`, [userId])).rows[0] || { xp: 0, level: 1, league: 'Bronze', currentStreak: 0, bestStreak: 0 };
        const followerCount = Number((await pool.query('SELECT COUNT(*)::int AS count FROM public.user_follows WHERE followed_user_id=$1', [userId])).rows[0]?.count || 0);
        const achievements = (await pool.query(`SELECT achievement.slug,achievement.name,achievement.description,earned.earned_at AS "earnedAt"
          FROM public.user_achievements earned JOIN public.achievements achievement ON achievement.id=earned.achievement_id WHERE earned.user_id=$1 ORDER BY earned.earned_at DESC`, [userId])).rows;
        const equippedCosmetics = (await pool.query(`SELECT equipped.category,item.slug,item.name FROM public.user_equipped_cosmetics equipped JOIN public.cosmetic_items item ON item.id=equipped.cosmetic_id WHERE equipped.user_id=$1`, [userId])).rows;
        return { user, stats, progression: { ...progression, xp: Number(progression.xp) }, followerCount, achievements, equippedCosmetics };
      },
      async followUser(userId, followedUserId) {
        const target = await this.getUser(followedUserId);
        if (!target) throw Object.assign(new Error('Player not found'), { statusCode: 404 });
        await pool.query('INSERT INTO public.user_follows(follower_id,followed_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, followedUserId]);
        return { following: true, followedUserId };
      },
      async createClub(userId, input) {
        const name = String(input.name || '').trim().slice(0, 80);
        if (name.length < 3) throw Object.assign(new Error('Club name must contain at least 3 characters'), { statusCode: 400 });
        const privacy = ['public', 'private', 'invite_only'].includes(input.privacy) ? input.privacy : 'private';
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const club = (await client.query('INSERT INTO public.clubs(name,owner_id,description,privacy) VALUES($1,$2,$3,$4) RETURNING id,name,description,privacy,created_at AS "createdAt"', [name, userId, String(input.description || '').trim().slice(0, 500), privacy])).rows[0];
          await client.query("INSERT INTO public.club_members(club_id,user_id,role) VALUES($1,$2,'owner')", [club.id, userId]);
          await client.query('COMMIT');
          return club;
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      },
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
      async createMpesaTransaction(input) {
        await pool.query('INSERT INTO public.mpesa_transactions(user_id,merchant_request_id,checkout_request_id,amount,phone_last4) VALUES($1,$2,$3,$4,$5) ON CONFLICT(checkout_request_id) DO NOTHING', [input.userId, input.merchantRequestId || null, input.checkoutRequestId, input.amount, input.phoneLast4 || null]);
      },
      async getMpesaTransaction(userId, checkoutRequestId) {
        return (await pool.query('SELECT checkout_request_id AS "checkoutRequestId",merchant_request_id AS "merchantRequestId",amount,status,result_code AS "resultCode",result_description AS "resultDescription",created_at AS "createdAt",updated_at AS "updatedAt" FROM public.mpesa_transactions WHERE user_id=$1 AND checkout_request_id=$2', [userId, checkoutRequestId])).rows[0] || null;
      },
      async completeMpesaTransaction(input) {
        const result = await pool.query("UPDATE public.mpesa_transactions SET merchant_request_id=COALESCE(merchant_request_id,$2),status=$3,result_code=$4,result_description=$5,receipt_number=COALESCE(receipt_number,$6),transaction_date=COALESCE(transaction_date,$7),phone_last4=COALESCE(phone_last4,$8),updated_at=NOW() WHERE checkout_request_id=$1 AND status='pending'", [input.checkoutRequestId, input.merchantRequestId || null, input.status, input.resultCode, input.resultDescription, input.receiptNumber, input.transactionDate, input.phoneLast4]);
        return result.rowCount === 1;
      },
      async schemaStatus() {
        const result = await pool.query("SELECT to_regclass('public.mpesa_transactions') IS NOT NULL AS present");
        return { schema: 'public', mpesaTransactions: result.rows[0]?.present === true };
      },
      async close() { await pool.end(); },
    };
  }
  if (requireDatabase) throw new Error('PostgreSQL is required but DATABASE_URL is missing');
  const users = new Map();
  const emails = new Map();
  const wallets = new Map();
  const settledGames = new Set();
  const subscriptions = new Map();
  const equippedCosmetics = new Map();
  const follows = new Set();
  const clubs = [];
  const cosmeticItems = [
    { slug: 'classic-black', name: 'Classic Black', category: 'card_back', description: 'The standard black PAKA card back.', price: 0, currency: 'KES', premiumOnly: false },
    { slug: 'royal-gold-back', name: 'Royal Gold', category: 'card_back', description: 'A gold-detailed premium card back.', price: 50, currency: 'KES', premiumOnly: true },
    { slug: 'standard-player', name: 'Standard Player', category: 'avatar', description: 'The standard seated PAKA player.', price: 0, currency: 'KES', premiumOnly: false },
    { slug: 'royal-avatar', name: 'Royal Avatar', category: 'avatar', description: 'Premium formal casino styling.', price: 300, currency: 'KES', premiumOnly: true },
    { slug: 'royal-red-table', name: 'Royal Red Table', category: 'table_theme', description: 'Deep red felt with polished gold trim.', price: 500, currency: 'KES', premiumOnly: true },
    { slug: 'luxury-penthouse', name: 'Luxury Penthouse', category: 'environment', description: 'A panoramic high-rise casino environment.', price: 500, currency: 'KES', premiumOnly: true },
  ];
  return {
    kind: 'memory-development',
    async getUser(id) { return publicUser(users.get(id)); },
    async getUserByEmail(email) { return users.get(emails.get(email)) || null; },
    async createUser(input) { if (input.email && emails.has(input.email)) throw new Error('Email already registered'); users.set(input.id, { ...input, createdAt: new Date(), updatedAt: new Date() }); if (input.email) emails.set(input.email, input.id); wallets.set(input.id, STARTING_CHIPS); return publicUser(users.get(input.id)); },
    async getWallet(id) { return wallets.get(id) ?? STARTING_CHIPS; },
    async getCurrentSubscription(id) { return subscriptions.get(id) || null; },
    async listCosmetics(id) { return cosmeticItems.map((item) => ({ ...item, owned: false, equipped: equippedCosmetics.get(`${id}:${item.category}`) === item.slug })); },
    async equipCosmetic(id, slug, entitlements) {
      const item = cosmeticItems.find((candidate) => candidate.slug === slug);
      if (!item) throw Object.assign(new Error('Cosmetic not found'), { statusCode: 404 });
      if (item.price > 0 && !(item.premiumOnly && entitlements.plan === 'plus')) throw Object.assign(new Error('You do not own this cosmetic'), { statusCode: 403 });
      equippedCosmetics.set(`${id}:${item.category}`, item.slug);
      return { slug: item.slug, name: item.name, category: item.category };
    },
    async getPlayerProfile(id) {
      return { user: await this.getUser(id), stats: { gamesPlayed: 0, gamesWon: 0, kadiCalls: 0, cardsPlayed: 0 }, progression: { xp: 0, level: 1, league: 'Bronze', currentStreak: 0, bestStreak: 0 }, followerCount: [...follows].filter((item) => item.endsWith(`:${id}`)).length, achievements: [], equippedCosmetics: [...equippedCosmetics.entries()].filter(([key]) => key.startsWith(`${id}:`)).map(([key, slug]) => ({ category: key.split(':')[1], slug })) };
    },
    async followUser(id, followedUserId) { if (!users.has(followedUserId)) throw Object.assign(new Error('Player not found'), { statusCode: 404 }); follows.add(`${id}:${followedUserId}`); return { following: true, followedUserId }; },
    async createClub(id, input) { const club = { id: `club-${clubs.length + 1}`, name: String(input.name || '').trim(), ownerId: id, description: String(input.description || ''), privacy: input.privacy || 'private' }; clubs.push(club); return club; },
    async setSubscriptionForTest(id, subscription) { subscriptions.set(id, subscription); },
    async settleGame({ gameId, winnerId, participants, changes }) { if (settledGames.has(gameId)) return null; settledGames.add(gameId); for (const id of participants) wallets.set(id, Math.max(0, (wallets.get(id) ?? STARTING_CHIPS) + Number(changes[id] || 0))); return Object.fromEntries(participants.map((id) => [id, wallets.get(id)])); },
    async recordKadi() {},
    async createMpesaTransaction(input) { if (!this.mpesaTransactions) this.mpesaTransactions = new Map(); if (!this.mpesaTransactions.has(input.checkoutRequestId)) this.mpesaTransactions.set(input.checkoutRequestId, { ...input, status: 'pending' }); },
    async getMpesaTransaction(userId, checkoutRequestId) { const transaction = this.mpesaTransactions?.get(checkoutRequestId); return transaction?.userId === userId ? transaction : null; },
    async completeMpesaTransaction(input) { if (!this.mpesaTransactions) this.mpesaTransactions = new Map(); const current = this.mpesaTransactions.get(input.checkoutRequestId); if (!current || current.status !== 'pending') return false; this.mpesaTransactions.set(input.checkoutRequestId, { ...current, ...input }); return true; },
    async schemaStatus() { return { schema: 'memory-development', mpesaTransactions: true }; },
    async close() {},
  };
}
