import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const encoder = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createAuthService({ repository, secret, ttlSeconds }) {
  function sign(payload) {
    const encoded = encoder(payload);
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  function verify(token) {
    if (typeof token !== 'string') return null;
    const [encoded, supplied] = token.split('.');
    if (!encoded || !supplied) return null;
    const expected = createHmac('sha256', secret).update(encoded).digest();
    let received;
    try { received = Buffer.from(supplied, 'base64url'); } catch { return null; }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      return payload.exp > Math.floor(Date.now() / 1000) && payload.sub ? payload : null;
    } catch { return null; }
  }

  function tokenFor(user) {
    const now = Math.floor(Date.now() / 1000);
    return sign({ sub: user.id, typ: user.authType, iat: now, exp: now + ttlSeconds });
  }

  async function hashPassword(password) {
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, 64);
    return `scrypt$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
  }

  async function verifyPassword(password, stored) {
    const [, saltValue, hashValue] = String(stored || '').split('$');
    if (!saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  return {
    verifyToken: verify,
    async createGuest(displayName, existingToken) {
      const existing = verify(existingToken);
      if (existing) {
        const user = await repository.getUser(existing.sub);
        if (user) return { user, token: tokenFor(user), wallet: await repository.getWallet(user.id) };
      }
      const user = await repository.createUser({ id: randomUUID(), displayName, authType: 'guest' });
      return { user, token: tokenFor(user), wallet: await repository.getWallet(user.id) };
    },
    async registerEmail(email, password, displayName) {
      const user = await repository.createUser({ id: randomUUID(), displayName, authType: 'email', email: email.toLowerCase(), passwordHash: await hashPassword(password) });
      return { user, token: tokenFor(user), wallet: await repository.getWallet(user.id) };
    },
    async loginEmail(email, password) {
      const user = await repository.getUserByEmail(email.toLowerCase());
      if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
      return { user, token: tokenFor(user), wallet: await repository.getWallet(user.id) };
    },
  };
}
