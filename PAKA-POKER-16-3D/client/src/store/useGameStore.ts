import { create } from 'zustand';
import { emitEvent } from '../services/socketService';
import type {
  GameState as GameStateType,
  Player,
  PileCard,
  TableSummary,
} from '../types/game';
import type { Card } from '../cards/Card';

type ClientState = {
  clientId: string | null;
  players: Player[];
  round: number;
  deckCount: number;
  pile: PileCard[];
  hand: Card[];
  turnOrder: string[];
  lastDrawnCard: Card | null;
  activePlayerId: string | null;
  winnerId: string | null;
  gameOver: boolean;
  actionMessage: string;
  adminHands: Record<string, Card[]>;
  kadiEvent: { playerId: string; playerName: string; nonce: number } | null;
  demoStatus: { running: boolean; stage: string; message: string };
  celebrationEvent: { winnerId: string; winnerName: string; nonce: number } | null;
  tables: TableSummary[];
  currentTable: TableSummary | null;
  pendingDraw: number;
  questionState: GameStateType['questionState'];
  selectedSuit: string | null;
  suitSelectionPlayerId: string | null;

  dealCards: () => void;
  playCard: (cardId: number) => void;
  kadiCall: () => void;
  resetGame: () => void;

  setGameState: (state: GameStateType) => void;
  setPlayers: (players: Player[]) => void;
  setClientId: (id: string | null) => void;
  setActionMessage: (message: string) => void;
  setHand: (cards: Card[]) => void;
  addCardToHand: (card: Card) => void;
  clearHand: () => void;
  setLastDrawnCard: (card: Card | null) => void;
  setAdminHands: (hands: Record<string, Card[]>) => void;
  setKadiEvent: (event: { playerId: string; playerName: string } | null) => void;
  setDemoStatus: (status: { running: boolean; stage: string; message: string }) => void;
  setCelebrationEvent: (event: { winnerId: string; winnerName: string } | null) => void;
  setTables: (tables: TableSummary[]) => void;
  setCurrentTable: (table: TableSummary | null) => void;
};

export const useGameStore = create<ClientState>((set) => ({
  clientId: null,
  players: [],
  round: 1,
  deckCount: 0,
  pile: [],
  hand: [],
  turnOrder: [],
  lastDrawnCard: null,
  activePlayerId: null,
  winnerId: null,
  gameOver: false,
  actionMessage: '',
  adminHands: {},
  kadiEvent: null,
  demoStatus: { running: false, stage: 'IDLE', message: '' },
  celebrationEvent: null,
  tables: [],
  currentTable: null,
  pendingDraw: 0,
  questionState: null,
  selectedSuit: null,
  suitSelectionPlayerId: null,

  // Draw one card from the server.
  dealCards: () => emitEvent('drawCard'),

  // Play a specific card by its server/client card ID.
  playCard: (cardId) => emitEvent('playCard', cardId),

  // Announce KADI to the server.
  kadiCall: () => emitEvent('kadiCall'),

  // Reset the server-side game.
  resetGame: () => emitEvent('resetGame'),

  setGameState: (state) =>
    set((current) => ({
      players: state.players,
      round: state.round,
      deckCount: state.deckCount,
      pile: state.pile,
      turnOrder: state.turnOrder,
      activePlayerId: state.activePlayerId,
      winnerId: state.winnerId,
      gameOver: state.gameOver,
      pendingDraw: state.pendingDraw || 0,
      questionState: state.questionState || null,
      selectedSuit: state.selectedSuit || null,
      suitSelectionPlayerId: state.suitSelectionPlayerId || null,
      celebrationEvent: state.gameOver ? current.celebrationEvent : null,
      kadiEvent: state.gameOver ? current.kadiEvent : null,
    })),

  setPlayers: (players) => set({ players }),

  setClientId: (id) => set({ clientId: id }),

  setActionMessage: (message) =>
    set({ actionMessage: message }),

  setHand: (cards) =>
    set({
      hand: cards,
    }),

  addCardToHand: (card) =>
    set((state) => ({
      hand: [...state.hand, card],
    })),

  clearHand: () => set({ hand: [] }),

  setLastDrawnCard: (card) =>
    set({
      lastDrawnCard: card,
    }),
  setAdminHands: (adminHands) => set({ adminHands }),
  setKadiEvent: (event) => set({
    kadiEvent: event ? { ...event, nonce: Date.now() } : null,
  }),
  setDemoStatus: (demoStatus) => set({ demoStatus }),
  setCelebrationEvent: (event) => set({
    celebrationEvent: event ? { ...event, nonce: Date.now() } : null,
  }),
  setTables: (tables) => set({ tables }),
  setCurrentTable: (currentTable) => set(currentTable ? { currentTable } : {
    currentTable: null,
    players: [],
    hand: [],
    pile: [],
    turnOrder: [],
    activePlayerId: null,
    winnerId: null,
    gameOver: false,
    deckCount: 0,
    pendingDraw: 0,
    questionState: null,
    selectedSuit: null,
    suitSelectionPlayerId: null,
  }),
}));
