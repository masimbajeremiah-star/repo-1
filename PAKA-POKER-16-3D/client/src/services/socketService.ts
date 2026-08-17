import { io, Socket } from 'socket.io-client';
import type { Player, GameState } from '../types/game';
import type { Card } from '../cards/Card';

let socket: Socket | null = null;
const IDENTITY_KEY = 'pakaPokerIdentity';
const PRODUCTION_SERVER_URL = 'https://paka-poker-api.onrender.com';
const AUTH_TIMEOUT_MS = 20000;

export type AuthIdentity = { id: string; name: string; token: string; authType: string; chipBalance: number };

export function getTestIdentity(): AuthIdentity | null {
  try {
    const value = localStorage.getItem(IDENTITY_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthIdentity;
    if (parsed?.id && parsed?.name && parsed?.token) return parsed;
    localStorage.removeItem(IDENTITY_KEY);
    return null;
  } catch {
    localStorage.removeItem(IDENTITY_KEY);
    return null;
  }
}

export function getServerUrl() {
  const configured = String(
    import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3000' : PRODUCTION_SERVER_URL)
  ).trim().replace(/\/$/, '');
  if (import.meta.env.PROD && !configured.startsWith('https://')) throw new Error('Production multiplayer requires an HTTPS VITE_SOCKET_URL');
  return configured;
}

async function authenticate(path: string, body: Record<string, unknown>): Promise<AuthIdentity> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${getServerUrl()}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The PAKA Poker server took too long to respond. Please try again.');
    }
    throw new Error('Unable to reach the PAKA Poker server. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
  }

  const responseText = await response.text();
  let payload: Record<string, any> = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    if (!response.ok) throw new Error(`Authentication service returned an error (${response.status}). Please try again.`);
    throw new Error('The authentication service returned an invalid response. Please try again.');
  }
  if (!response.ok) {
    const safeFallbacks: Record<number, string> = {
      400: 'Please check the information you entered.',
      401: 'Invalid email or password.',
      409: 'An account with that email already exists.',
      429: 'Too many login attempts. Please wait a moment and try again.',
    };
    throw new Error(typeof payload.error === 'string' ? payload.error : safeFallbacks[response.status] || 'Authentication is temporarily unavailable.');
  }
  if (!payload.token || !payload.user?.id || !payload.user?.displayName || !payload.user?.authType || !Number.isFinite(payload.chipBalance)) {
    throw new Error('The authentication service returned an incomplete response. Please try again.');
  }
  const identity = { id: payload.user.id, name: payload.user.displayName, authType: payload.user.authType, token: payload.token, chipBalance: payload.chipBalance };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function saveTestIdentity(name: string) {
  const displayName = String(name || '').trim().slice(0, 32) || 'Guest';
  return authenticate('guest', { displayName, existingToken: getTestIdentity()?.token });
}
export function registerEmail(displayName: string, email: string, password: string) {
  return authenticate('register', { displayName: String(displayName || '').trim().slice(0, 32) || 'Player', email: String(email || '').trim().toLowerCase(), password });
}
export function loginEmail(email: string, password: string) {
  return authenticate('login', { email: String(email || '').trim().toLowerCase(), password });
}
export function clearIdentity() { localStorage.removeItem(IDENTITY_KEY); disconnectSocket(); }

export type MpesaStkResponse = {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode?: string;
  customerMessage?: string;
};

export type MpesaTransactionStatus = {
  checkoutRequestId: string;
  merchantRequestId?: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  resultCode?: number | null;
  resultDescription?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function requestMpesaDeposit(phoneNumber: string, amount: number): Promise<MpesaStkResponse> {
  const identity = getTestIdentity();
  if (!identity?.token) throw new Error('Please sign in before making an optional deposit');
  const response = await fetch(`${getServerUrl()}/api/mpesa/stkpush`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${identity.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ phoneNumber, amount }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'M-PESA request could not be started');
  return payload as MpesaStkResponse;
}

export async function getMpesaDepositStatus(checkoutRequestId: string): Promise<MpesaTransactionStatus> {
  const identity = getTestIdentity();
  if (!identity?.token) throw new Error('Authentication required');
  const response = await fetch(`${getServerUrl()}/api/mpesa/status/${encodeURIComponent(checkoutRequestId)}`, {
    headers: { authorization: `Bearer ${identity.token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Payment status is unavailable');
  return payload.transaction as MpesaTransactionStatus;
}

export function refreshStoredWallet(chipBalance: number) {
  const identity = getTestIdentity();
  if (identity && Number.isFinite(chipBalance)) localStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...identity, chipBalance }));
}

export function connectSocket(playerName = 'Guest') {
  if (!socket) {
    const identity = getTestIdentity();
    socket = io(getServerUrl(), {
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
  return client.connected;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
