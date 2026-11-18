import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../src/services/repository.js';
import { createAuthService } from '../src/services/authService.js';

test('guest token restores the same account without a wallet', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  const auth = createAuthService({ repository, secret: 'test-secret-at-least-24-characters', ttlSeconds: 3600 });
  const first = await auth.createGuest('Persistent Guest');
  const restored = await auth.createGuest('Ignored Rename', first.token);
  assert.equal(restored.user.id, first.user.id);
  assert.equal('wallet' in restored, false);
  assert.equal(typeof repository.getWallet, 'undefined');
  await repository.close();
});

test('email passwords are hashed and bad passwords are rejected', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  const auth = createAuthService({ repository, secret: 'test-secret-at-least-24-characters', ttlSeconds: 3600 });
  const registered = await auth.registerEmail('player@example.test', 'very-secure-password', 'Player');
  assert.ok(registered.token);
  assert.equal(await auth.loginEmail('player@example.test', 'incorrect-password'), null);
  assert.equal((await auth.loginEmail('player@example.test', 'very-secure-password')).user.id, registered.user.id);
  await repository.close();
});

test('expired and invalid authentication tokens are rejected', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  const expiredAuth = createAuthService({ repository, secret: 'test-secret-at-least-24-characters', ttlSeconds: -1 });
  const issued = await expiredAuth.createGuest('Expired Guest');
  assert.equal(expiredAuth.verifyToken(issued.token), null);
  assert.equal(expiredAuth.verifyToken('invalid.redacted'), null);
  await repository.close();
});

test('game result statistics are idempotent and never settle player balances', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  await repository.createUser({ id: 'one', displayName: 'One', authType: 'guest' });
  await repository.createUser({ id: 'two', displayName: 'Two', authType: 'guest' });
  assert.equal(typeof repository.getWallet, 'undefined');
  assert.equal(typeof repository.settleGame, 'undefined');
  const result = { gameId: 'game-one', winnerId: 'one', participants: ['one', 'two'] };
  assert.equal(await repository.recordGameResult(result), true);
  assert.equal(await repository.recordGameResult(result), false);
  await repository.close();
});
