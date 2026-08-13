import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';

import {
  addPlayer,
  drawCard,
  playCard,
  getNextPlayer,
  checkForWinner,
  resetGame,
  canCallKadi,
  markKadiCalled,
  startRound,
  selectSuit,
} from './gameEngine.js';

import {
  createTable,
  getTable,
  getTables,
  findTableByPlayerId,
  removeTableIfEmpty,
} from './tableManager.js';
import { handleDemoCommand } from './demoController.js';

const STARTING_CHIPS = 1000;
const WIN_REWARD = 250;
const PARTICIPATION_COST = 50;
const reconnectTimers = new Map();
let activeRepository = null;

async function walletFor(playerId) { return activeRepository ? activeRepository.getWallet(playerId) : STARTING_CHIPS; }

async function settleRound(state) {
  if (!state.gameOver || !state.winnerId || state.settledWinnerId === state.winnerId) return;
  const gameId = state.gameId || randomUUID();
  state.gameId = gameId;
  const participants = state.players.filter((player) => !player.demoBot).map((player) => player.id);
  const changes = Object.fromEntries(participants.map((id) => [id, id === state.winnerId ? WIN_REWARD : -PARTICIPATION_COST]));
  const balances = await activeRepository.settleGame({ gameId, winnerId: state.winnerId, participants, changes });
  if (!balances) return;
  for (const player of state.players) if (balances[player.id] !== undefined) player.chips = balances[player.id];
  state.settledWinnerId = state.winnerId;
}

function sanitizeState(state) {
  return {
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      chips: player.chips,
      handCount: player.hand.length,
    })),

    deckCount: state.deck.length,

    pile: state.pile,

    round: state.round,

    turnOrder: state.turnOrder,

    activePlayerId:
      state.turnOrder[state.activePlayerIndex] ?? null,

    winnerId: state.winnerId ?? null,

    gameOver: state.gameOver,
    pendingDraw: state.pendingDraw,
    questionState: state.questionState,
    selectedSuit: state.selectedSuit,
    suitSelectionPlayerId: state.suitSelectionPlayerId,
  };
}

function tableSummary(table) {
  return {
    id: table.id,
    name: table.name,
    playerCount: table.gameState.players.length,
    maxPlayers: table.maxPlayers,
    hostPlayerId: table.hostPlayerId,
    createdAt: table.createdAt,
  };
}

function emitTableList(io) {
  io.emit('tables.update', getTables());
}

function emitTableState(io, table) {
  if (!table) return;

  // Public state: safe for everyone at the table.
  io.to(table.id).emit(
    'gameState',
    sanitizeState(table.gameState)
  );

  io.to(table.id).emit(
    'players.update',
    table.gameState.players.map((player) => ({
      id: player.id,
      name: player.name,
      chips: player.chips,
      handCount: player.hand.length,
    }))
  );

  // Private state: each player receives only their own hand.
  for (const player of table.gameState.players) {
    const playerSocket = io.sockets.sockets.get(player.socketId);

    if (!playerSocket) {
      continue;
    }

    console.log(
      `🃏 Sending hand to ${player.name} (${player.id}): ${player.hand.length} cards`
    );

    playerSocket.emit('myHand', player.hand);

    if (playerSocket.data.isAdmin) {
      playerSocket.emit('adminState', {
        hands: Object.fromEntries(
          table.gameState.players.map((item) => [item.id, item.hand])
        ),
      });
    }
  }
}

function getPlayerTable(socket) {
  const tableId = socket.data.tableId;

  if (!tableId) {
    return null;
  }

  return getTable(tableId);
}

function leaveCurrentTable(io, socket) {
  const tableId = socket.data.tableId;

  if (!tableId) {
    return;
  }

  const table = getTable(tableId);

  if (!table) {
    socket.data.tableId = null;
    return;
  }

  const playerId = socket.data.playerId || socket.id;

  console.log(
    `🚪 ${socket.data.playerName || 'Player'} leaving ${table.id}`
  );

  table.gameState.players =
    table.gameState.players.filter(
      (player) => player.id !== playerId
    );

  table.gameState.turnOrder =
    table.gameState.turnOrder.filter(
      (id) => id !== playerId
    );

  if (table.hostPlayerId === playerId) {
    table.hostPlayerId = table.gameState.players[0]?.id ?? null;
  }

  if (
    table.gameState.turnOrder.length === 0
  ) {
    table.gameState.activePlayerIndex = 0;
  } else if (
    table.gameState.activePlayerIndex >=
    table.gameState.turnOrder.length
  ) {
    table.gameState.activePlayerIndex = 0;
  }

  socket.leave(table.id);
  socket.data.tableId = null;
  socket.emit('table.left');

  emitTableState(io, table);

  removeTableIfEmpty(table.id);

  emitTableList(io);
}

async function joinTable(io, socket, table) {
  if (!table) {
    socket.emit('actionRejected', {
      reason: 'Table not found',
    });

    return false;
  }

  const returningPlayer = table.gameState.players.some((player) => player.id === socket.data.playerId);
  if (!returningPlayer && table.gameState.players.length >= table.maxPlayers) {
    socket.emit('actionRejected', {
      reason: 'Table is full',
    });

    return false;
  }

  const existingTable = getPlayerTable(socket);

  if (existingTable) {
    if (existingTable.id === table.id) {
      return true;
    }

    leaveCurrentTable(io, socket);
  }

  const playerId = socket.data.playerId;
  const playerName =
    socket.data.playerName || 'Guest';

  const existingPlayer = table.gameState.players.find((player) => player.id === playerId);
  if (existingPlayer) {
    existingPlayer.socketId = socket.id;
    existingPlayer.name = playerName;
    existingPlayer.chips = await walletFor(playerId);
  } else {
    addPlayer(table.gameState, {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      chips: await walletFor(playerId),
    });
  }

  if (!table.hostPlayerId) table.hostPlayerId = playerId;

  // Join the Socket.IO room BEFORE starting/emitting
  // the round so this player receives the initial state.
  socket.join(table.id);
  socket.data.tableId = table.id;

  // Start the first round automatically once at least
  // two players are seated at this table.
  if (table.gameState.players.length >= 2) {
    const started = startRound(table.gameState);

    if (started) {
      console.log(
        `🃏 Round started at ${table.id}: 4 cards dealt to each player`
      );
    }
  }

  console.log(
    `🪑 ${playerName} joined ${table.id} (${table.name})`
  );

  socket.emit('table.joined', {
    table: tableSummary(table),
  });

  emitTableState(io, table);
  emitTableList(io);

  return true;
}

export function initPokerSocket(httpServer, { config, authService, repository }) {
  activeRepository = repository;
  const configuredOrigins = config.allowedOrigins;
  const io = new Server(httpServer, {
    cors: {
      origin: configuredOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const claims = authService.verifyToken(socket.handshake.auth?.token);
      if (!claims) return next(new Error('Authentication required'));
      const user = await repository.getUser(claims.sub);
      if (!user) return next(new Error('Authentication required'));
      socket.data.authUser = user;
      return next();
    } catch { return next(new Error('Authentication unavailable')); }
  });

  /*
   * Ensure there is always at least one table.
   */
  createTable({
    name: 'Table 1',
    maxPlayers: 5,
  });

  io.on('connection', async (socket) => {
    const {
      playerName,
      tableId,
    } = socket.handshake.query;

    const name = socket.data.authUser.displayName;

    const actionTimes = new Map();
    const allowAction = (event, minimumIntervalMs = 250) => {
      const now = Date.now();
      const previous = actionTimes.get(event) || 0;
      if (now - previous < minimumIntervalMs) {
        socket.emit('actionRejected', { reason: 'Please slow down' });
        return false;
      }
      actionTimes.set(event, now);
      return true;
    };

    socket.data.playerName = name;
    socket.data.playerId = socket.data.authUser.id;
    const pendingRemoval = reconnectTimers.get(socket.data.playerId);
    if (pendingRemoval) {
      clearTimeout(pendingRemoval);
      reconnectTimers.delete(socket.data.playerId);
    }
    const requestedAdminView = socket.handshake.auth?.adminView === true;
    const configuredAdminToken = process.env.ADMIN_TOKEN;
    socket.data.isAdmin = configuredAdminToken
      ? requestedAdminView && socket.handshake.auth?.adminToken === configuredAdminToken
      : process.env.NODE_ENV !== 'production' && requestedAdminView;

    console.log(
      `Player connected: ${name} (${socket.id})`
    );
    socket.emit('session.ready', { playerId: socket.data.playerId });

    /* Reattach a stable identity after a network interruption. New
     * identities remain in the lobby until they explicitly join. */
    let table = findTableByPlayerId(socket.data.playerId);

    if (
      typeof tableId === 'string' &&
      tableId.trim()
    ) {
      table = getTable(tableId);

      if (!table) {
        socket.emit('actionRejected', {
          reason: 'Requested table does not exist',
        });
      }
    }

    if (table) await joinTable(io, socket, table);

    /*
     * Send available tables to the newly connected
     * client.
     */
    socket.emit(
      'tables.update',
      getTables()
    );

    /*
     * Request table list.
     */
    socket.on('tables.list', () => {
      socket.emit(
        'tables.update',
        getTables()
      );
    });

    /*
     * Create a new table.
     */
    socket.on('table.create', async (options = {}) => {
      if (!allowAction('table.create', 5000)) return;
      const name =
        typeof options.name === 'string' &&
        options.name.trim()
          ? options.name.trim()
          : undefined;

      const maxPlayers =
        Number(options.maxPlayers) >= 2 &&
        Number(options.maxPlayers) <= 10
          ? Number(options.maxPlayers)
          : 5;

      const newTable = createTable({
        name,
        maxPlayers,
      });

      socket.emit('table.created', {
        table: tableSummary(newTable),
      });
      await joinTable(io, socket, newTable);
    });

    /*
     * Join a specific table.
     */
    socket.on('table.join', async (requestedTableId) => {
      if (!allowAction('table.join', 1000)) return;
      if (
        typeof requestedTableId !== 'string' ||
        !requestedTableId.trim()
      ) {
        return socket.emit('actionRejected', {
          reason: 'Invalid table ID',
        });
      }

      const requestedTable =
        getTable(requestedTableId);

      if (!requestedTable) {
        return socket.emit('actionRejected', {
          reason: 'Table not found',
        });
      }

      await joinTable(
        io,
        socket,
        requestedTable
      );
    });

    /*
     * Leave the current table.
     */
    socket.on('table.leave', () => {
      leaveCurrentTable(io, socket);
    });

    /*
     * DRAW CARD
     */
    socket.on('drawCard', () => {
      if (!allowAction('drawCard')) return;
      const currentTable =
        getPlayerTable(socket);

      if (!currentTable) {
        return socket.emit('actionRejected', {
          reason: 'You are not seated at a table',
        });
      }

      const state =
        currentTable.gameState;

      if (state.players.length < 2) {
        return socket.emit('actionRejected', { reason: 'At least two players are required' });
      }

      if (state.gameOver) {
        return socket.emit('actionRejected', {
          reason: 'Game over',
        });
      }
      if (state.suitSelectionPlayerId) return socket.emit('actionRejected', { reason: 'The pending suit must be selected before drawing' });

      const activePlayerId =
        state.turnOrder[
          state.activePlayerIndex
        ];

      if (activePlayerId !== socket.data.playerId) {
        return socket.emit('actionRejected', {
          reason: 'Not your turn',
        });
      }

      const drawCount = Math.max(1, state.pendingDraw || 0);
      const drawnCards = [];
      for (let index = 0; index < drawCount; index += 1) {
        const drawn = drawCard(state, socket.data.playerId);
        if (!drawn) break;
        drawnCards.push(drawn);
      }
      const card = drawnCards.at(-1);

      if (!card) {
        return socket.emit('actionRejected', {
          reason: 'Deck empty',
        });
      }

      socket.emit(
        'cardDrawn',
        card
      );

      state.pendingDraw = 0;

      getNextPlayer(state);
      emitTableState(io, currentTable);

      emitTableList(io);
    });

    /*
     * PLAY CARD
     */
    socket.on('playCard', async (cardId) => {
      if (!allowAction('playCard')) return;
      const normalizedCardId = Number(cardId);
      if (!Number.isInteger(normalizedCardId)) {
        return socket.emit('actionRejected', { reason: 'Invalid card ID' });
      }
      const currentTable =
        getPlayerTable(socket);

      if (!currentTable) {
        return socket.emit('actionRejected', {
          reason: 'You are not seated at a table',
        });
      }

      const state =
        currentTable.gameState;

      if (state.players.length < 2) {
        return socket.emit('actionRejected', { reason: 'At least two players are required' });
      }

      if (state.gameOver) {
        return socket.emit('actionRejected', {
          reason: 'Game over',
        });
      }

      const activePlayerId =
        state.turnOrder[
          state.activePlayerIndex
        ];

      if (activePlayerId !== socket.data.playerId) {
        return socket.emit('actionRejected', {
          reason: 'Not your turn',
        });
      }

      const card =
        playCard(
          state,
          socket.data.playerId,
          normalizedCardId
        );

      if (!card) {
        return socket.emit('actionRejected', {
          reason: 'Card not found or card cannot be played',
        });
      }

      checkForWinner(state);
      await settleRound(state);

      if (!state.gameOver && !state.suitSelectionPlayerId) {
        getNextPlayer(state);
      }

      emitTableState(
        io,
        currentTable
      );

      if (state.gameOver) {
        io.to(currentTable.id).emit(
          'gameOver',
          {
            winnerId:
              state.winnerId,
          }
        );
      }

      emitTableList(io);
    });

    socket.on('selectSuit', (requestedSuit) => {
      if (!allowAction('selectSuit', 500)) return;
      const currentTable = getPlayerTable(socket);
      if (!currentTable) return socket.emit('actionRejected', { reason: 'You are not seated at a table' });
      const state = currentTable.gameState;
      if (!selectSuit(state, socket.data.playerId, String(requestedSuit || ''))) {
        return socket.emit('actionRejected', { reason: 'You are not authorized to select the suit or the suit is invalid' });
      }
      if (!state.gameOver) getNextPlayer(state);
      emitTableState(io, currentTable);
    });

    /*
     * RESET CURRENT TABLE
     */
    socket.on('resetGame', () => {
      if (!allowAction('resetGame', 2000)) return;
      const currentTable =
        getPlayerTable(socket);

      if (!currentTable) {
        return socket.emit('actionRejected', {
          reason: 'You are not seated at a table',
        });
      }

      if (currentTable.hostPlayerId !== socket.data.playerId) {
        return socket.emit('actionRejected', { reason: 'Only the table host can reset the game' });
      }

      resetGame(
        currentTable.gameState
      );
      startRound(currentTable.gameState);

      emitTableState(
        io,
        currentTable
      );

      emitTableList(io);
    });

    /*
     * KADI
     */
    socket.on('kadiCall', () => {
      if (!allowAction('kadiCall', 1000)) return;
      const currentTable =
        getPlayerTable(socket);

      if (!currentTable) {
        return socket.emit('actionRejected', {
          reason: 'You are not seated at a table',
        });
      }

      const state =
        currentTable.gameState;

      if (state.gameOver) {
        return socket.emit('actionRejected', {
          reason: 'Game over',
        });
      }

      if (
        !canCallKadi(
          state,
          socket.data.playerId
        )
      ) {
        return socket.emit('actionRejected', {
          reason:
            'Kadi can only be called with one card remaining',
        });
      }
      markKadiCalled(state, socket.data.playerId);
      repository.recordKadi(socket.data.playerId).catch((error) => console.error('KADI statistic failed:', error.message));

      io.to(currentTable.id).emit(
        'kadiCalled',
        {
          playerId: socket.data.playerId,
          playerName:
            socket.data.playerName,
        }
      );

      emitTableState(
        io,
        currentTable
      );
    });

    socket.on('demo.command', (payload = {}) => {
      if (!allowAction('demo.command', 150)) return;
      const currentTable = getPlayerTable(socket);
      if (!currentTable) {
        return socket.emit('actionRejected', { reason: 'You are not seated at a table' });
      }
      handleDemoCommand({
        io,
        table: currentTable,
        socket,
        command: String(payload.command || ''),
        emitTableState,
      });
    });

    /*
     * DISCONNECT
     */
    socket.on('disconnect', () => {
      console.log(
        `Player disconnected: ${name} (${socket.id})`
      );

      const playerId = socket.data.playerId;
      const timer = setTimeout(() => {
        reconnectTimers.delete(playerId);
        leaveCurrentTable(io, socket);
      }, 30000);
      reconnectTimers.set(playerId, timer);
    });
  });

  return io;
}
