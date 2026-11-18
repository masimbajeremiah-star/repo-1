import test from 'node:test';
import assert from 'node:assert/strict';
import * as apiRoutes from '../src/routes/apiRoutes.js';
import { addPlayer, createGameState } from '../src/services/gameEngine.js';
import { createRepository } from '../src/services/repository.js';

test('the server exposes no M-PESA router or deposit service methods', async () => {
  assert.equal('createMpesaRouter' in apiRoutes, false);
  const repository = await createRepository({});
  assert.equal(typeof repository.createMpesaTransaction, 'undefined');
  assert.equal(typeof repository.getMpesaTransaction, 'undefined');
  assert.equal(typeof repository.completeMpesaTransaction, 'undefined');
  await repository.close();
});

test('KADI players have no chip balance or participation stake', () => {
  const state = createGameState();
  addPlayer(state, { id: 'player-1', name: 'Player One' });
  assert.equal('chips' in state.players[0], false);
  assert.equal('balance' in state.players[0], false);
});

test('game result recording is idempotent and has no wallet settlement method', async () => {
  const repository = await createRepository({});
  await repository.createUser({ id: 'player-1', displayName: 'Player One', authType: 'guest' });
  await repository.createUser({ id: 'player-2', displayName: 'Player Two', authType: 'guest' });
  assert.equal(typeof repository.getWallet, 'undefined');
  assert.equal(typeof repository.settleGame, 'undefined');
  assert.equal(await repository.recordGameResult({ gameId: 'round-1', winnerId: 'player-1', participants: ['player-1', 'player-2'] }), true);
  assert.equal(await repository.recordGameResult({ gameId: 'round-1', winnerId: 'player-1', participants: ['player-1', 'player-2'] }), false);
  await repository.close();
});
