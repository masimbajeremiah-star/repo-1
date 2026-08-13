import type { Card } from '../cards/Card';


export type Player = {
  id: string;
  name: string;
  chips: number;
  handCount?: number;
};

export type TableSummary = {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  hostPlayerId: string | null;
  createdAt: number;
};

/**
 * Card currently on the table/discard pile.
 *
 * Uses the unified card model from client/src/cards/Card.ts.
 */
export type PileCard = Card & {
  playerId: string;
};

export type GameState = {
  players: Player[];
  round: number;
  deckCount: number;
  pile: PileCard[];
  turnOrder: string[];
  activePlayerId: string | null;
  winnerId: string | null;
  gameOver: boolean;
  pendingDraw: number;
  questionState: { initiatedBy: string; lastQuestionBy: string; chainLength: number; answerRanks: string[] } | null;
  selectedSuit: string | null;
  suitSelectionPlayerId: string | null;
};

export type { Card };
