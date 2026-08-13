import { canPlayCard, checkForWinner, drawCard, getNextPlayer, markKadiCalled, playCard } from './gameEngine.js';

const DEMO_PLAYER_COUNT = 5;
const DEAL_DELAY_MS = 620;
const TURN_DELAY_MS = 720;
const ROOM_READY_MS = 1400;
const WIN_PAUSE_MS = 500;
const controllers = new Map();

const wait = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(() => {
    signal.timers.delete(timer);
    resolve();
  }, ms);
  signal.timers.add(timer);
});

function demoCard(id, rank) {
  const values = { A: 1, J: 11, Q: 12, K: 13 };
  return {
    id,
    suit: 'Hearts',
    rank,
    value: values[rank] || Number(rank),
    effect: rank === '2' ? 1 : rank === '3' ? 2 : rank === 'J' ? 3 : rank === 'K' ? 4 : rank === 'Q' ? 5 : rank === 'A' ? 6 : 0,
    image: `cards/hearts_${rank}.png`,
    playable: true,
  };
}

function stopController(tableId) {
  const signal = controllers.get(tableId);
  if (!signal) return;
  signal.stopped = true;
  controllers.delete(tableId);
}

function emitStatus(io, table, stage, message) {
  io.to(table.id).emit('demo.status', { running: stage !== 'IDLE' && stage !== 'COMPLETE', stage, message });
  console.log(`[DEMO] ${message}`);
}

function prepareDemoState(table, ownerId) {
  const state = table.gameState;
  state.players = state.players.filter((player) => !player.demoBot).slice(0, DEMO_PLAYER_COUNT);
  while (state.players.length < DEMO_PLAYER_COUNT) {
    const seat = state.players.length + 1;
    state.players.push({ id: `demo-player-${seat}`, name: `Player ${seat}`, chips: 1000, hand: [], demoBot: true });
  }
  state.players.forEach((player, index) => {
    player.hand = [];
    if (player.id === ownerId) player.name = player.name || 'Player 1';
    if (!Number.isFinite(player.chips)) player.chips = 1000;
    player.demoSeat = index;
  });
  state.turnOrder = state.players.map((player) => player.id);
  state.activePlayerIndex = 0;
  state.pile = [];
  state.winnerId = null;
  state.gameOver = false;
  state.pendingDraw = 0;
  state.questionState = null;
  state.selectedSuit = null;
  state.suitSelectionPlayerId = null;
  state.kadiCalledPlayerIds = [];
  state.demoMode = true;
  state.demoKadiPlayerId = state.turnOrder[0];
  const ranks = ['4', '5', '6', '7'];
  const dealCards = [];
  for (let round = 0; round < 4; round += 1) {
    for (let seat = 0; seat < DEMO_PLAYER_COUNT; seat += 1) {
      dealCards.push(demoCard(2000 + round * 10 + seat, ranks[round]));
    }
  }
  const reserve = Array.from({ length: 28 }, (_, index) => demoCard(3000 + index, String(4 + (index % 6))));
  // drawCard pops: reverse the intended circular deal order and leave an opening card beneath it.
  state.deck = [...reserve, demoCard(1999, '9'), ...dealCards.reverse()];
}

async function dealInitialHands(io, table, emitTableState, signal) {
  emitStatus(io, table, 'DEALING', 'Dealer dealing cards');
  for (let round = 0; round < 4 && !signal.stopped; round += 1) {
    for (const playerId of table.gameState.turnOrder) {
      if (signal.stopped) return;
      drawCard(table.gameState, playerId);
      emitTableState(io, table);
      const player = table.gameState.players.find((item) => item.id === playerId);
      console.log(`[DEMO] Dealt card to ${player?.name || playerId}`);
      await wait(DEAL_DELAY_MS, signal);
    }
  }
  const opening = table.gameState.deck.pop();
  if (opening) table.gameState.pile.push({ ...opening, playedBy: null, playedAt: Date.now() });
  emitTableState(io, table);
}

function chooseLegalCard(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  return player?.hand.find((card) => canPlayCard(state, card)) || null;
}

async function takeDemoTurn(io, table, emitTableState, signal) {
  const state = table.gameState;
  const playerId = state.turnOrder[state.activePlayerIndex];
  const player = state.players.find((item) => item.id === playerId);
  if (!player || state.gameOver || signal.stopped) return;
  emitStatus(io, table, 'PLAYING', `${player.name} turn`);
  let card = chooseLegalCard(state, playerId);
  if (!card) {
    drawCard(state, playerId);
    emitTableState(io, table);
    console.log(`[DEMO] ${player.name} drew a card`);
    await wait(DEAL_DELAY_MS, signal);
    card = chooseLegalCard(state, playerId);
  }
  if (card) {
    const wasFinal = player.hand.length === 1;
    playCard(state, playerId, card.id);
    console.log(`[DEMO] ${player.name} played ${card.rank}♥`);
    if (player.id === state.demoKadiPlayerId && player.hand.length === 1) {
      markKadiCalled(state, playerId);
      io.to(table.id).emit('kadiCalled', { playerId, playerName: player.name });
      emitStatus(io, table, 'KADI', `${player.name} called KADI`);
      console.log('[DEMO] KADI animation started');
      emitTableState(io, table);
      await wait(2600, signal);
      console.log('[DEMO] KADI animation ended');
    }
    checkForWinner(state);
    emitTableState(io, table);
    if (wasFinal && state.gameOver) {
      console.log(`[DEMO] Winner detected: ${player.name}`);
      await wait(WIN_PAUSE_MS, signal);
      io.to(table.id).emit('gameOver', { winnerId: state.winnerId });
      io.to(table.id).emit('demo.celebration', { winnerId: state.winnerId, winnerName: player.name });
      emitStatus(io, table, 'CELEBRATION', `Celebration started for ${player.name}`);
      return;
    }
  }
  if (!state.gameOver) getNextPlayer(state);
  emitTableState(io, table);
}

async function runFullDemo(io, table, socket, emitTableState) {
  stopController(table.id);
  const signal = { stopped: false, timers: new Set() };
  controllers.set(table.id, signal);
  prepareDemoState(table, socket.data.playerId);
  emitStatus(io, table, 'ROOM_READY', 'Starting game');
  emitTableState(io, table);
  await wait(ROOM_READY_MS, signal);
  if (signal.stopped) return;
  await dealInitialHands(io, table, emitTableState, signal);
  while (!signal.stopped && !table.gameState.gameOver) {
    await wait(TURN_DELAY_MS, signal);
    await takeDemoTurn(io, table, emitTableState, signal);
  }
  if (!signal.stopped) {
    emitStatus(io, table, 'COMPLETE', 'Demo complete');
    controllers.delete(table.id);
  }
}

export function handleDemoCommand({ io, table, socket, command, emitTableState }) {
  if (!socket.data.isAdmin || process.env.NODE_ENV === 'production') {
    socket.emit('actionRejected', { reason: 'Demo controls require a development admin session' });
    return;
  }
  if (command === 'run') {
    runFullDemo(io, table, socket, emitTableState).catch((error) => {
      console.error('[DEMO] Failed:', error);
      socket.emit('actionRejected', { reason: 'Demo stopped after an unexpected error' });
    });
    return;
  }
  if (command === 'stop') {
    stopController(table.id);
    emitStatus(io, table, 'IDLE', 'Demo stopped');
    return;
  }
  if (command === 'reset') {
    stopController(table.id);
    prepareDemoState(table, socket.data.playerId);
    emitTableState(io, table);
    emitStatus(io, table, 'IDLE', 'Demo reset');
    return;
  }
  if (command === 'deal') {
    stopController(table.id);
    const signal = { stopped: false, timers: new Set() };
    controllers.set(table.id, signal);
    prepareDemoState(table, socket.data.playerId);
    dealInitialHands(io, table, emitTableState, signal).finally(() => controllers.delete(table.id));
    return;
  }
  if (command === 'next') {
    const signal = controllers.get(table.id) || { stopped: false, timers: new Set() };
    takeDemoTurn(io, table, emitTableState, signal);
    return;
  }
  if (command === 'kadi') {
    const state = table.gameState;
    const player = state.players.find((item) => item.id === state.turnOrder[state.activePlayerIndex]);
    if (!player) return;
    player.hand = player.hand.slice(0, 1);
    markKadiCalled(state, player.id);
    io.to(table.id).emit('kadiCalled', { playerId: player.id, playerName: player.name });
    emitTableState(io, table);
    return;
  }
  if (command === 'win') {
    const state = table.gameState;
    const player = state.players.find((item) => item.id === state.turnOrder[state.activePlayerIndex]);
    if (!player) return;
    const winningTop = demoCard(4900, '9');
    state.pile.push({ ...winningTop, playedBy: null, playedAt: Date.now() });
    state.pendingDraw = 0;
    state.questionState = null;
    state.selectedSuit = null;
    state.suitSelectionPlayerId = null;
    player.hand = [demoCard(4901, '9')];
    markKadiCalled(state, player.id);
    takeDemoTurn(io, table, emitTableState, { stopped: false, timers: new Set() });
  }
}

export function stopDemoForTable(tableId) {
  stopController(tableId);
}
