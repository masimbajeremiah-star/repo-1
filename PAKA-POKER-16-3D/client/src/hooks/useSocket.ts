import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  Suit,
  Rank,
  CardEffect,
  cardImageFor,
} from '../cards/Card';
import type { Card } from '../cards/Card';
import {
  connectSocket,
  refreshStoredWallet,
} from '../services/socketService';

function normalizeCard(input: unknown): Card | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;

  const id =
    typeof raw.id === 'number'
      ? raw.id
      : Number(raw.id);

  if (!Number.isFinite(id)) {
    return null;
  }

  const suitValue = String(raw.suit ?? '');
  const rankValue = String(
    raw.rank ?? raw.value ?? ''
  );

  const suit = Object.values(Suit).find(
    (item) =>
      item.toLowerCase() ===
      suitValue.toLowerCase()
  );

  const rank = Object.values(Rank).find(
    (item) => item === rankValue
  );

  if (!suit || !rank) {
    return null;
  }

  const value =
    typeof raw.value === 'number'
      ? raw.value
      : getCardValue(rank);

  const effect =
    typeof raw.effect === 'number'
      ? raw.effect
      : CardEffect.NONE;

  const image =
    typeof raw.image === 'string'
      ? raw.image
      : cardImageFor(rank, suit);

  const playable =
    typeof raw.playable === 'boolean'
      ? raw.playable
      : true;

  return {
    id,
    suit,
    rank,
    value,
    effect,
    image,
    playable,
  };
}

function getCardValue(rank: Rank): number {
  switch (rank) {
    case Rank.A:
      return 1;
    case Rank.TWO:
      return 2;
    case Rank.THREE:
      return 3;
    case Rank.FOUR:
      return 4;
    case Rank.FIVE:
      return 5;
    case Rank.SIX:
      return 6;
    case Rank.SEVEN:
      return 7;
    case Rank.EIGHT:
      return 8;
    case Rank.NINE:
      return 9;
    case Rank.TEN:
      return 10;
    case Rank.JACK:
      return 11;
    case Rank.QUEEN:
      return 12;
    case Rank.KING:
      return 13;
    case Rank.JOKER:
      return 14;
    default:
      return 0;
  }
}

export function useSocket() {
  const setGameState =
    useGameStore(
      (state) => state.setGameState
    );

  const setPlayers =
    useGameStore(
      (state) => state.setPlayers
    );

  const setClientId =
    useGameStore(
      (state) => state.setClientId
    );

  const setHand =
    useGameStore(
      (state) => state.setHand
    );

  const setLastDrawnCard =
    useGameStore(
      (state) => state.setLastDrawnCard
    );

  const setActionMessage =
    useGameStore(
      (state) => state.setActionMessage
    );
  const setAdminHands = useGameStore((state) => state.setAdminHands);
  const setKadiEvent = useGameStore((state) => state.setKadiEvent);
  const setDemoStatus = useGameStore((state) => state.setDemoStatus);
  const setCelebrationEvent = useGameStore((state) => state.setCelebrationEvent);
  const setTables = useGameStore((state) => state.setTables);
  const setCurrentTable = useGameStore((state) => state.setCurrentTable);

  useEffect(() => {
    const socket = connectSocket();
    let celebrationTimer: ReturnType<typeof setTimeout> | null = null;

    setClientId(null);

    const handleConnect = () => setActionMessage('Connected. Synchronizing table…');
    const handleSessionReady = (payload: { playerId?: string }) => {
      setClientId(payload?.playerId || null);
      socket.emit('tables.list');
    };
    const handleTablesUpdate = (payload: unknown) => {
      if (Array.isArray(payload)) setTables(payload);
    };
    const handleTableJoined = (payload: { table?: Parameters<typeof setCurrentTable>[0] }) => {
      if (payload?.table) {
        setCurrentTable(payload.table);
        setActionMessage(`Joined ${payload.table.name}.`);
      }
    };
    const handleTableLeft = () => {
      setCurrentTable(null);
      setActionMessage('You left the table. Choose another table when ready.');
    };

    const handleGameState = (state: unknown) => {
      setGameState(state as Parameters<typeof setGameState>[0]);
      const typed = state as { players?: Array<{ id: string; chips: number }> };
      const playerId = useGameStore.getState().clientId;
      const local = typed.players?.find((player) => player.id === playerId);
      if (local) refreshStoredWallet(local.chips);
    };

    const handlePlayersUpdate = (
      players: Parameters<typeof setPlayers>[0]
    ) => {
      setPlayers(players);
    };

    const handleMyHand = (
      payload: unknown
    ) => {
      if (!Array.isArray(payload)) {
        console.error(
          'Received invalid hand payload:',
          payload
        );
        return;
      }

      const cards = payload
        .map(normalizeCard)
        .filter(
          (card): card is Card => card !== null
        );

      console.log(
        '🃏 myHand received:',
        cards.length,
        cards
      );

      setHand(cards);
    };

    const handleCardDrawn = (
      payload: unknown
    ) => {
      const card = normalizeCard(payload);

      if (!card) {
        console.error(
          'Received invalid card payload:',
          payload
        );
        return;
      }

      // myHand is the authoritative hand state.
      // cardDrawn is retained only for last-drawn-card UI.
      setLastDrawnCard(card);
      setActionMessage('Card accepted. The dealer is dealing it now.');
    };

    const handleRejected = (
      payload: { reason?: string }
    ) => {
      setActionMessage(
        payload?.reason ??
          'Action rejected'
      );
    };

    const handleGameOver = (
      payload: { winnerId?: string }
    ) => {
      setActionMessage(
        payload?.winnerId
          ? `Winner: ${payload.winnerId}`
          : 'Game over'
      );
      if (payload?.winnerId) {
        const winner = useGameStore.getState().players.find((player) => player.id === payload.winnerId);
        celebrationTimer = setTimeout(() => {
          setCelebrationEvent({ winnerId: payload.winnerId as string, winnerName: winner?.name || 'Player' });
        }, 850);
      }
    };

    const handleAdminState = (payload: { hands?: Record<string, unknown[]> }) => {
      const normalized = Object.fromEntries(
        Object.entries(payload?.hands || {}).map(([playerId, cards]) => [
          playerId,
          cards.map(normalizeCard).filter((card): card is Card => card !== null),
        ])
      );
      setAdminHands(normalized);
    };
    const handleKadiCalled = (payload: { playerId?: string; playerName?: string }) => {
      if (!payload?.playerId) return;
      setKadiEvent({ playerId: payload.playerId, playerName: payload.playerName || 'Player' });
      setActionMessage(`${payload.playerName || 'Player'} called KADI!`);
    };
    const handleDemoStatus = (payload: { running?: boolean; stage?: string; message?: string }) => {
      setDemoStatus({
        running: Boolean(payload?.running),
        stage: payload?.stage || 'IDLE',
        message: payload?.message || '',
      });
      if (payload?.message) setActionMessage(`[DEMO] ${payload.message}`);
    };
    const handleCelebration = (payload: { winnerId?: string; winnerName?: string }) => {
      if (!payload?.winnerId) return;
      setCelebrationEvent({ winnerId: payload.winnerId, winnerName: payload.winnerName || 'Player' });
    };

    socket.on(
      'connect',
      handleConnect
    );
    socket.on('session.ready', handleSessionReady);
    socket.on('tables.update', handleTablesUpdate);
    socket.on('table.joined', handleTableJoined);
    socket.on('table.left', handleTableLeft);

    socket.on(
      'gameState',
      handleGameState
    );

    socket.on(
      'players.update',
      handlePlayersUpdate
    );

    socket.on(
      'myHand',
      handleMyHand
    );

    socket.on(
      'cardDrawn',
      handleCardDrawn
    );

    socket.on(
      'actionRejected',
      handleRejected
    );

    socket.on(
      'gameOver',
      handleGameOver
    );
    socket.on('adminState', handleAdminState);
    socket.on('kadiCalled', handleKadiCalled);
    socket.on('demo.status', handleDemoStatus);
    socket.on('demo.celebration', handleCelebration);

    return () => {
      if (celebrationTimer) clearTimeout(celebrationTimer);
      socket.off(
        'connect',
        handleConnect
      );
      socket.off('session.ready', handleSessionReady);
      socket.off('tables.update', handleTablesUpdate);
      socket.off('table.joined', handleTableJoined);
      socket.off('table.left', handleTableLeft);

      socket.off(
        'gameState',
        handleGameState
      );

      socket.off(
        'players.update',
        handlePlayersUpdate
      );

      socket.off(
        'myHand',
        handleMyHand
      );

      socket.off(
        'cardDrawn',
        handleCardDrawn
      );

      socket.off(
        'actionRejected',
        handleRejected
      );

      socket.off(
        'gameOver',
        handleGameOver
      );
      socket.off('adminState', handleAdminState);
      socket.off('kadiCalled', handleKadiCalled);
      socket.off('demo.status', handleDemoStatus);
      socket.off('demo.celebration', handleCelebration);
    };
  }, [
    setGameState,
    setPlayers,
    setClientId,
    setHand,
    setLastDrawnCard,
    setActionMessage,
    setAdminHands,
    setKadiEvent,
    setDemoStatus,
    setCelebrationEvent,
    setTables,
    setCurrentTable,
  ]);
}
