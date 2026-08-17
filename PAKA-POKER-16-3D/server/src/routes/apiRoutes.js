import express from 'express';
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ status: "Game server operational" });
});

export default router;

const authenticatedUser = (authService, req) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return authService.verifyToken(token)?.sub || null;
};

export function createMonetizationRouter({ authService, monetizationService }) {
  const monetization = express.Router();
  monetization.use((req, res, next) => {
    const userId = authenticatedUser(authService, req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    req.authUserId = userId;
    return next();
  });
  monetization.get('/me', async (req, res, next) => {
    try { return res.json(await monetizationService.getAccount(req.authUserId)); }
    catch (error) { return next(error); }
  });
  monetization.post('/cosmetics/equip', async (req, res, next) => {
    try { return res.json({ equipped: await monetizationService.equipCosmetic(req.authUserId, String(req.body.slug || '')) }); }
    catch (error) { return error.statusCode ? res.status(error.statusCode).json({ error: error.message }) : next(error); }
  });
  monetization.post('/follow', async (req, res, next) => {
    try { return res.json(await monetizationService.follow(req.authUserId, String(req.body.userId || ''))); }
    catch (error) { return error.statusCode ? res.status(error.statusCode).json({ error: error.message }) : next(error); }
  });
  monetization.post('/clubs', async (req, res, next) => {
    try { return res.status(201).json({ club: await monetizationService.createClub(req.authUserId, req.body || {}) }); }
    catch (error) { return error.statusCode ? res.status(error.statusCode).json({ error: error.message }) : next(error); }
  });
  monetization.post('/purchase', (_req, res) => res.status(501).json({ error: 'Platform billing is not configured yet. No subscription was created.' }));
  monetization.post('/restore', (_req, res) => res.status(501).json({ error: 'Purchase restoration requires a configured platform billing provider.' }));
  return monetization;
}

export function createMpesaRouter({ authService, mpesaService }) {
  const mpesa = express.Router();
  mpesa.post('/stkpush', async (req, res, next) => {
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const claims = authService.verifyToken(token);
      if (!claims) return res.status(401).json({ error: 'Authentication required' });
      const result = await mpesaService.triggerStkPush({ userId: claims.sub, phoneNumber: req.body.phoneNumber, amount: req.body.amount });
      res.status(202).json(result);
    } catch (error) {
      if (String(error.message).startsWith('M-PESA is not configured')) return res.status(503).json({ error: error.message });
      if (String(error.message).includes('valid Kenyan') || String(error.message).startsWith('Amount must')) return res.status(400).json({ error: error.message });
      next(error);
    }
  });
  mpesa.get('/status/:checkoutRequestId', async (req, res, next) => {
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const claims = authService.verifyToken(token);
      if (!claims) return res.status(401).json({ error: 'Authentication required' });
      const transaction = await mpesaService.getTransactionStatus(claims.sub, String(req.params.checkoutRequestId || ''));
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
      return res.json({ transaction });
    } catch (error) { return next(error); }
  });
  mpesa.post('/callback', async (req, res) => {
    try { await mpesaService.handleCallback(req.body); }
    catch (error) { console.error('M-PESA callback processing failed:', error.message); }
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });
  return mpesa;
}

export function createAuthRouter(authService) {
  const auth = express.Router();
  const attempts = new Map();
  auth.use((req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = attempts.get(key) || { count: 0, resetAt: now + 60000 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
    entry.count += 1; attempts.set(key, entry);
    if (entry.count > 20) return res.status(429).json({ error: 'Too many authentication attempts; try again shortly' });
    next();
  });
  const cleanName = (value) => String(value || 'Guest').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 32) || 'Guest';
  const emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
  const reply = (res, result) => res.json({ token: result.token, user: result.user, chipBalance: result.wallet });
  auth.post('/guest', async (req, res, next) => { try { reply(res, await authService.createGuest(cleanName(req.body.displayName), req.body.existingToken)); } catch (error) { next(error); } });
  auth.post('/register', async (req, res, next) => { try { if (!emailValid(req.body.email) || String(req.body.password || '').length < 10) return res.status(400).json({ error: 'A valid email and password of at least 10 characters are required' }); reply(res, await authService.registerEmail(req.body.email, req.body.password, cleanName(req.body.displayName))); } catch (error) { if (String(error.message).includes('registered') || error.code === '23505') return res.status(409).json({ error: 'Email already registered' }); next(error); } });
  auth.post('/login', async (req, res, next) => { try { const result = await authService.loginEmail(req.body.email, req.body.password); if (!result) return res.status(401).json({ error: 'Invalid email or password' }); reply(res, result); } catch (error) { next(error); } });
  return auth;
}
