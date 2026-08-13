import { io } from 'socket.io-client';

const url = process.env.TEST_SOCKET_URL || 'http://127.0.0.1:3105';

async function guest(name) {
  const response = await fetch(`${url}/api/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: name }) });
  if (!response.ok) throw new Error(`Guest authentication failed: ${response.status}`);
  return response.json();
}

function connect(name, authToken, adminView = false) {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ['websocket'],
      query: { playerName: name },
      auth: { token: authToken, adminView },
      reconnection: false,
    });
    let latestState = null;
    socket.on('gameState', (state) => { latestState = state; });
    const timeout = setTimeout(() => reject(new Error(`${name} connection timed out`)), 5000);
    socket.once('connect_error', reject);
    socket.once('session.ready', (session) => {
      clearTimeout(timeout);
      resolve({ socket, session, getLatestState: () => latestState });
    });
  });
}

function once(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

const runId = Date.now().toString(36);
const hostAuth = await guest(`QA Host ${runId}`);
const guestAuth = await guest(`QA Guest ${runId}`);
const hostId = hostAuth.user.id;
const guestId = guestAuth.user.id;
const a = await connect('QA Host', hostAuth.token, true);
let tables = await new Promise((resolve) => {
  a.socket.emit('tables.list');
  once(a.socket, 'tables.update').then(resolve);
});
if (!Array.isArray(tables)) throw new Error('Lobby table list missing');
if (a.session.playerId !== hostId) throw new Error('Stable host identity missing');

const joinedAPromise = once(a.socket, 'table.joined');
if (tables.length === 0) a.socket.emit('table.create', { name: 'Readiness Table', maxPlayers: 5 });
else a.socket.emit('table.join', tables[0].id);
const joinedA = await joinedAPromise;
const b = await connect('QA Guest', guestAuth.token);
const initialPromise = once(a.socket, 'gameState');
const handAPromise = once(a.socket, 'myHand');
const joinedBPromise = once(b.socket, 'table.joined');
b.socket.emit('table.join', joinedA.table.id);
await joinedBPromise;
const initial = await initialPromise;
if (initial.players.length !== 2 || initial.deckCount !== 45) throw new Error(`Bad initial deal: ${JSON.stringify(initial)}`);

const handA = await handAPromise;
if (handA.length !== 4) throw new Error(`Host expected 4 cards, received ${handA.length}`);

const rejected = once(b.socket, 'actionRejected');
b.socket.emit('drawCard');
const reason = await rejected;
if (!String(reason.reason).includes('turn')) throw new Error(`Expected turn rejection, got ${reason.reason}`);

const hostStateBeforeDraw = await new Promise((resolve) => {
  const handler = (state) => {
    if (state.activePlayerId === a.session.playerId) {
      a.socket.off('gameState', handler);
      resolve(state);
    }
  };
  a.socket.on('gameState', handler);
  a.socket.emit('tables.list');
  setTimeout(() => resolve(initial), 300);
});
if (hostStateBeforeDraw.activePlayerId !== a.session.playerId) throw new Error('Host is not initial active player');
const drawn = once(a.socket, 'cardDrawn');
const stateAfterDraw = once(a.socket, 'gameState');
a.socket.emit('drawCard');
await drawn;
const afterDraw = await stateAfterDraw;
if (afterDraw.deckCount !== 44 || afterDraw.activePlayerId !== b.session.playerId) throw new Error('Draw did not update deck/turn');

b.socket.disconnect();
const b2 = await connect('QA Guest', guestAuth.token);
const rehydrated = b2.getLatestState() || await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    const latest = b2.getLatestState();
    if (latest) resolve(latest);
    else reject(new Error('Reconnect state was not rehydrated'));
  }, 500);
  b2.socket.once('gameState', (state) => { clearTimeout(timeout); resolve(state); });
});
if (rehydrated.players.filter((player) => player.id === guestId).length !== 1) throw new Error('Reconnect duplicated player');

const kadiRejected = once(a.socket, 'actionRejected');
a.socket.emit('kadiCall');
const kadiReason = await kadiRejected;
if (!String(kadiReason.reason).includes('one card')) throw new Error('KADI validation failed');

const winnerState = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Force-win winner timed out')), 7000);
  a.socket.on('gameState', (state) => {
    if (state.gameOver) {
      clearTimeout(timeout);
      resolve(state);
    }
  });
});
a.socket.emit('demo.command', { command: 'win' });
const won = await winnerState;
if (!won.winnerId || !won.gameOver) throw new Error('Winner state missing');

const resetState = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Play-again reset timed out')), 7000);
  a.socket.on('gameState', (state) => {
    if (!state.gameOver && state.round === won.round + 1 && state.players.every((player) => player.handCount === 4)) {
      clearTimeout(timeout);
      resolve(state);
    }
  });
});
a.socket.emit('resetGame');
const reset = await resetState;
if (reset.deckCount !== 45 || reset.winnerId) throw new Error('Second round reset is not clean');

const demoComplete = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Full demo timed out')), 90000);
  a.socket.on('demo.status', (status) => {
    if (status.stage === 'COMPLETE') {
      clearTimeout(timeout);
      resolve(status);
    }
  });
});
a.socket.emit('demo.command', { command: 'run' });
await demoComplete;
a.socket.emit('demo.command', { command: 'stop' });
a.socket.disconnect();
b2.socket.disconnect();
console.log(JSON.stringify({
  lobby: 'PASS',
  stableIdentity: 'PASS',
  initialDeal: 'PASS',
  invalidMove: 'PASS',
  draw: 'PASS',
  reconnectNoDuplicate: 'PASS',
  kadiValidation: 'PASS',
  winner: 'PASS',
  playAgain: 'PASS',
  fullDemo: 'PASS',
}));
