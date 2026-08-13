import { randomUUID } from 'node:crypto';
import { createGameState } from './gameEngine.js';

const tables = new Map();

function createTableId() {
  return `table-${randomUUID().slice(0, 8)}`;
}

export function createTable(options = {}) {
  const tableId = createTableId();

  const table = {
    id: tableId,
    name: options.name || `Table ${tables.size + 1}`,
    maxPlayers: Number(options.maxPlayers) || 5,
    hostPlayerId: null,
    gameState: createGameState(),
    createdAt: Date.now(),
  };

  tables.set(tableId, table);

  console.log(
    `🎰 Created table ${table.id} (${table.name})`
  );

  return table;
}

export function getTable(tableId) {
  return tables.get(tableId) || null;
}

export function findTableByPlayerId(playerId) {
  for (const table of tables.values()) {
    if (table.gameState.players.some((player) => player.id === playerId)) return table;
  }
  return null;
}

export function getTables() {
  return Array.from(tables.values()).map((table) => ({
    id: table.id,
    name: table.name,
    playerCount: table.gameState.players.length,
    maxPlayers: table.maxPlayers,
    hostPlayerId: table.hostPlayerId,
    createdAt: table.createdAt,
  }));
}

export function findAvailableTable() {
  for (const table of tables.values()) {
    if (table.gameState.players.length < table.maxPlayers) {
      return table;
    }
  }

  return null;
}

export function getOrCreateAvailableTable() {
  return findAvailableTable() || createTable();
}

export function removeTableIfEmpty(tableId) {
  const table = tables.get(tableId);

  if (!table) {
    return false;
  }

  if (table.gameState.players.length === 0) {
    tables.delete(tableId);

    console.log(`🗑️ Removed empty table ${tableId}`);

    return true;
  }

  return false;
}

export function tableCount() {
  return tables.size;
}
