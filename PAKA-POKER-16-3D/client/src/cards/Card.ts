export enum Suit {
  SPADES = 'Spades',
  HEARTS = 'Hearts',
  DIAMONDS = 'Diamonds',
  CLUBS = 'Clubs',
  JOKER = 'Joker',
}

export enum Rank {
  A = 'A',
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
  JOKER = 'JOKER',
}

export enum CardEffect {
  NONE,
  DRAW_TWO,
  DRAW_THREE,
  SKIP,
  REVERSE,
  QUESTION,
  CHOOSE_SUIT,
  CANCEL_DRAW,
  JOKER_DRAW,
}

export interface Card {
  id: number;
  suit: Suit;
  rank: Rank;
  value: number;
  effect: CardEffect;
  image: string;
  playable: boolean;
}

export const RankOrder: Rank[] = [
  Rank.A,
  Rank.TWO,
  Rank.THREE,
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
  Rank.EIGHT,
  Rank.NINE,
  Rank.TEN,
  Rank.JACK,
  Rank.QUEEN,
  Rank.KING,
  Rank.JOKER,
];

export const SuitOrder: Suit[] = [
  Suit.SPADES,
  Suit.HEARTS,
  Suit.DIAMONDS,
  Suit.CLUBS,
  Suit.JOKER,
];

export const answerRanks = new Set<Rank>([
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
  Rank.NINE,
  Rank.TEN,
  Rank.A,
]);

export function isQuestionRank(rank: Rank) {
  return rank === Rank.QUEEN || rank === Rank.EIGHT;
}

export function isPenaltyRank(rank: Rank) {
  return rank === Rank.TWO || rank === Rank.THREE || rank === Rank.JOKER;
}

export function cardImageFor(rank: Rank, suit: Suit) {
  if (suit === Suit.JOKER) {
    return `cards/${rank === Rank.JOKER ? 'joker' : 'unknown'}.png`;
  }
  return `cards/${suit.toLowerCase()}_${rank}.png`;
}
