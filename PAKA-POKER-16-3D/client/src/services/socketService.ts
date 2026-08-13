import { io, Socket } from 'socket.io-client';
import type { Player, GameState } from '../types/game';
import type { Card } from '../cards/Card';

let socket: Socket | null = null;
const IDENTITY_KEY = 'pakaPokerIdentity';

export type AuthIdentity = { id: string; name: string; token: string; authType: string; chipBalance: number };

export function getTestIdentity(): AuthIdentity | null {
  try {
    const value = localStorage.getItem(IDENTITY_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthIdentity;
    return parsed?.id && parsed?.name && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function serverUrl() {
  const configured = String(import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');
  if (!configured) throw new Error('VITE_SOCKET_URL is required for production builds');
  if (import.meta.env.PROD && !configured.startsWith('https://')) throw new Error('Production multiplayer requires an HTTPS VITE_SOCKET_URL');
  return configured;
}

async function authenticate(path: string, body: Record<string, unknown>): Promise<AuthIdentity> {
  const response = await fetch(`${serverUrl()}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Authentication failed');
  const identity = { id: payload.user.id, name: payload.user.displayName, authType: payload.user.authType, token: payload.token, chipBalance: payload.chipBalance };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function saveTestIdentity(name: string) {
  return authenticate('guest', { displayName: name, existingToken: getTestIdentity()?.token });
}
export function registerEmail(displayName: string, email: string, password: string) { return authenticate('register', { displayName, email, password }); }
export function loginEmail(email: string, password: string) { return authenticate('login', { email, password }); }
export function clearIdentity() { localStorage.removeItem(IDENTITY_KEY); disconnectSocket(); }

export function refreshStoredWallet(chipBalance: number) {
  const identity = getTestIdentity();
  if (identity && Number.isFinite(chipBalance)) localStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...identity, chipBalance }));
}

export function connectSocket(playerName = 'Guest') {
  if (!socket) {
    const identity = getTestIdentity();
    socket = io(serverUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 12000,
      query: { playerName: identity?.name || playerName },
      auth: import.meta.env.VITE_GAME_ACCESS_TOKEN
        ? {
            token: identity?.token,
            adminView: import.meta.env.VITE_ADMIN_VIEW === 'true',
            adminToken: import.meta.env.VITE_ADMIN_TOKEN,
          }
        : {
            token: identity?.token,
            adminView: import.meta.env.VITE_ADMIN_VIEW === 'true',
            adminToken: import.meta.env.VITE_ADMIN_TOKEN,
          },
    });
  }
  return socket;
}

export function onSocketConnect(callback: (id: string) => void) {
  const client = connectSocket();
  client.on('connect', () => {
    callback(client.id);
  });
}

export function onPlayersUpdate(callback: (players: Player[]) => void) {
  const client = connectSocket();
  client.on('players.update', (players: Player[]) => {
    if (Array.isArray(players)) {
      callback(players);
    }
  });
}

export function onGameState(callback: (state: GameState) => void) {
  const client = connectSocket();
  client.on('gameState', (state: GameState) => {
    callback(state);
  });
}

export function onActionRejected(callback: (payload: { reason: string }) => void) {
  const client = connectSocket();
  client.on('actionRejected', (payload: { reason: string }) => {
    callback(payload);
  });
}

export function onMyHand(callback: (cards: Card[]) => void) {
  const client = connectSocket();

  client.on('myHand', (cards: Card[]) => {
    if (Array.isArray(cards)) {
      callback(cards);
    }
  });
}

export function onCardDrawn(callback: (card: Card) => void) {
  const client = connectSocket();
  client.on('cardDrawn', (card: Card) => {
    callback(card);
  });
}

export function onGameOver(callback: (payload: { winnerId: string | null }) => void) {
  const client = connectSocket();
  client.on('gameOver', (payload: { winnerId: string | null }) => {
    callback(payload);
  });
}

export function onKadiCalled(callback: (payload: { playerId: string; playerName: string }) => void) {
  const client = connectSocket();
  client.on('kadiCalled', (payload: { playerId: string; playerName: string }) => {
    callback(payload);
  });
}

export function emitEvent(event: string, payload: unknown = {}) {
  const client = connectSocket();
  client.emit(event, payload);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
