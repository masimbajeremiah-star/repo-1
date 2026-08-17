import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../src/services/repository.js';
import { createMonetizationService, resolveEntitlements } from '../src/services/monetizationService.js';
import { canPlayCard, canCallKadi, createGameState, drawCard } from '../src/services/gameEngine.js';

const future = () => new Date(Date.now() + 86_400_000).toISOString();

test('Free is the authoritative default and expired Plus never retains entitlement', () => {
  assert.deepEqual(resolveEntitlements(null).plan, 'free');
  assert.equal(resolveEntitlements(null).adsEnabled, true);
  assert.equal(resolveEntitlements({ plan: 'plus', status: 'active', currentPeriodEnd: new Date(Date.now() - 1000).toISOString() }).plan, 'free');
  const plus = resolveEntitlements({ plan: 'plus', status: 'active', currentPeriodEnd: future() });
  assert.equal(plus.plan, 'plus');
  assert.equal(plus.adsEnabled, false);
  assert.equal(plus.premiumTables, true);
});

test('server entitlement controls cosmetic access and ignores client-side plan claims', async () => {
  const repository = await createRepository({ databaseUrl: '', requireDatabase: false });
  await repository.createUser({ id: 'free-user', displayName: 'Free', authType: 'guest' });
  await repository.createUser({ id: 'plus-user', displayName: 'Plus', authType: 'guest' });
  await repository.setSubscriptionForTest('plus-user', { plan: 'plus', status: 'active', provider: 'test', currentPeriodEnd: future() });
  const service = createMonetizationService({ repository });
  assert.equal((await service.getAccount('free-user')).entitlements.plan, 'free');
  await assert.rejects(() => service.equipCosmetic('free-user', 'royal-red-table'), /do not own/i);
  assert.deepEqual(await service.equipCosmetic('plus-user', 'royal-red-table'), { slug: 'royal-red-table', name: 'Royal Red Table', category: 'table_theme' });
  await assert.rejects(() => service.createClub('free-user', { name: 'Free Club' }), /PAKA Plus/);
  assert.equal((await service.createClub('plus-user', { name: 'Plus Club' })).name, 'Plus Club');
  await repository.close();
});

test('subscription state has no path into draw, legal play, KADI, turns, or winner rules', () => {
  const freeState = createGameState();
  freeState.players = [{ id: 'free-user', hand: [{ id: 900, rank: '7', suit: 'Hearts' }] }];
  freeState.turnOrder = ['free-user'];
  freeState.pile = [{ id: 901, rank: '7', suit: 'Clubs' }];
  const plusState = structuredClone(freeState);
  assert.equal(canPlayCard(freeState, freeState.players[0].hand[0]), true);
  assert.equal(canPlayCard(plusState, plusState.players[0].hand[0]), true);
  assert.equal(canCallKadi(freeState, 'free-user'), true);
  assert.equal(canCallKadi(plusState, 'free-user'), true);
  assert.ok(drawCard(freeState, 'free-user'));
  assert.ok(drawCard(plusState, 'free-user'));
  assert.deepEqual(freeState.turnOrder, plusState.turnOrder);
  assert.equal(freeState.winnerId, plusState.winnerId);
});
