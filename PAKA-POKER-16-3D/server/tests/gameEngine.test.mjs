import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, canPlayCard, createGameState, drawCard, getNextPlayer, markKadiCalled, playCard, selectSuit } from '../src/services/gameEngine.js';

const card = (id, rank, suit = 'Hearts') => ({ id, rank, suit, value: Number(rank) || 1, effect: 0, image: '', playable: true });
function stateWithHands(first, second = [card(90, '4')], pile = card(99, '8')) {
  const state = createGameState();
  state.deck = [card(80, '6')]; state.pile = [{ ...pile, playerId: 'opening' }];
  addPlayer(state, { id: 'p1', name: 'One', chips: 1000 }); addPlayer(state, { id: 'p2', name: 'Two', chips: 1000 });
  state.players[0].hand = first; state.players[1].hand = second; state.activePlayerIndex = 0;
  return state;
}

test('8 opens question and invalid answer is rejected', () => {
  const state = stateWithHands([card(1, '8'), card(2, 'K')], [card(3, 'K')], card(99, '8'));
  assert.ok(playCard(state, 'p1', 1));
  assert.equal(state.questionState.chainLength, 1);
  getNextPlayer(state);
  assert.equal(canPlayCard(state, state.players[1].hand[0]), false);
  assert.equal(playCard(state, 'p2', 3), null);
});

test('answer rank resolves question independent of suit', () => {
  const state = stateWithHands([card(1, '8'), card(2, '4')], [card(3, '6', 'Clubs'), card(4, 'K')]);
  playCard(state, 'p1', 1); getNextPlayer(state);
  assert.ok(playCard(state, 'p2', 3));
  assert.equal(state.questionState, null);
});

test('Queen or 8 continues question chain', () => {
  const state = stateWithHands([card(1, '8'), card(2, '4')], [card(3, 'Q', 'Clubs'), card(4, '5')]);
  playCard(state, 'p1', 1); getNextPlayer(state); playCard(state, 'p2', 3);
  assert.equal(state.questionState.chainLength, 2);
  assert.equal(state.questionState.initiatedBy, 'p1');
});

test('drawing does not falsely satisfy the active question and turn can progress', () => {
  const state = stateWithHands([card(1, '8'), card(2, '4')], [card(3, 'K')]);
  playCard(state, 'p1', 1); getNextPlayer(state);
  assert.ok(drawCard(state, 'p2'));
  assert.ok(state.questionState);
  assert.equal(getNextPlayer(state), 'p1');
});

test('Ace requires authorized suit selection and selected suit constrains next play', () => {
  const state = stateWithHands([card(1, 'A'), card(2, '4')], [card(3, '6', 'Clubs'), card(4, '6', 'Spades')], card(99, 'A'));
  assert.ok(playCard(state, 'p1', 1));
  assert.equal(state.suitSelectionPlayerId, 'p1');
  assert.equal(selectSuit(state, 'p2', 'Clubs'), false);
  assert.equal(selectSuit(state, 'p1', 'Stars'), false);
  assert.equal(selectSuit(state, 'p1', 'Clubs'), true);
  getNextPlayer(state);
  assert.equal(canPlayCard(state, state.players[1].hand[0]), true);
  assert.equal(canPlayCard(state, state.players[1].hand[1]), false);
});

test('KADI cannot use an 8 as final card', () => {
  const state = stateWithHands([card(1, '8')]);
  assert.equal(markKadiCalled(state, 'p1'), true);
  assert.equal(playCard(state, 'p1', 1), null);
});

test('KADI is blocked while question, draw penalty, or suit selection is unresolved', () => {
  const state = stateWithHands([card(1, '6')]);
  state.questionState = { initiatedBy: 'p2', lastQuestionBy: 'p2', chainLength: 1, answerRanks: ['6'] };
  assert.equal(markKadiCalled(state, 'p1'), false);
  state.questionState = null; state.pendingDraw = 2;
  assert.equal(markKadiCalled(state, 'p1'), false);
  state.pendingDraw = 0; state.suitSelectionPlayerId = 'p2';
  assert.equal(markKadiCalled(state, 'p1'), false);
});

test('Jack skip and King reverse compose with turn order', () => {
  const state = stateWithHands([card(1, 'J'), card(2, 'K')], [card(3, 'J')], card(99, 'J'));
  addPlayer(state, { id: 'p3', name: 'Three', chips: 1000 }); state.players[2].hand = [card(5, '4')];
  playCard(state, 'p1', 1);
  assert.equal(getNextPlayer(state), 'p3');
  state.activePlayerIndex = 0; state.players[0].hand.push(card(6, 'K'));
  playCard(state, 'p1', 6);
  assert.equal(state.direction, -1);
  assert.equal(getNextPlayer(state), 'p3');
});

test('draw penalty stacks and Ace cancels before suit choice', () => {
  const state = stateWithHands([card(1, '2'), card(2, '4')], [card(3, '3'), card(4, 'A')], card(99, '2'));
  playCard(state, 'p1', 1); assert.equal(state.pendingDraw, 2); getNextPlayer(state);
  playCard(state, 'p2', 3); assert.equal(state.pendingDraw, 5);
  state.players[0].hand.push(card(5, 'A')); getNextPlayer(state); playCard(state, 'p1', 5);
  assert.equal(state.pendingDraw, 0); assert.equal(state.suitSelectionPlayerId, 'p1');
});
