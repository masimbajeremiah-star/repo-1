import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../src/services/repository.js';
import { createAuthService } from '../src/services/authService.js';

test('guest token restores the same account and wallet', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  const auth = createAuthService({ repository, secret: 'test-secret-at-least-24-characters', ttlSeconds: 3600 });
  const first = await auth.createGuest('Persistent Guest');
  const restored = await auth.createGuest('Ignored Rename', first.token);
  assert.equal(restored.user.id, first.user.id);
  assert.equal(restored.wallet, 1000);
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

test('wallet settlement is server-calculated and idempotent', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  await repository.createUser({ id: 'one', displayName: 'One', authType: 'guest' });
  await repository.createUser({ id: 'two', displayName: 'Two', authType: 'guest' });
  const settlement = { gameId: 'game-one', winnerId: 'one', participants: ['one', 'two'], changes: { one: 250, two: -50 } };
  assert.deepEqual(await repository.settleGame(settlement), { one: 1250, two: 950 });
  assert.equal(await repository.settleGame(settlement), null);
  assert.equal(await repository.getWallet('one'), 1250);
  assert.equal(await repository.getWallet('two'), 950);
  await repository.close();
});
