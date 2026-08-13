import { Card, Suit, Rank, CardEffect, cardImageFor } from './Card';

const suits = [Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS];
const ranks = [
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
];

export class DeckBuilder {
  public static createDeck(): Card[] {
    const deck: Card[] = [];
    let id = 1;

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          id: id++,
          suit,
          rank,
          value: this.getValue(rank),
          effect: this.getEffect(rank),
          image: cardImageFor(rank, suit),
          playable: true,
        });
      }
    }

    deck.push({
      id: id++,
      suit: Suit.JOKER,
      rank: Rank.JOKER,
      value: 14,
      effect: CardEffect.JOKER_DRAW,
      image: 'cards/red_joker.png',
      playable: true,
    });

    deck.push({
      id: id++,
      suit: Suit.JOKER,
      rank: Rank.JOKER,
      value: 14,
      effect: CardEffect.JOKER_DRAW,
      image: 'cards/black_joker.png',
      playable: true,
    });

    return deck;
  }

  public static createShuffledDeck(): Card[] {
    return this.shuffle(this.createDeck());
  }

  private static getValue(rank: Rank): number {
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
      default:
        return 14;
    }
  }

  private static getEffect(rank: Rank): CardEffect {
    switch (rank) {
      case Rank.TWO:
        return CardEffect.DRAW_TWO;
      case Rank.THREE:
        return CardEffect.DRAW_THREE;
      case Rank.A:
        return CardEffect.CHOOSE_SUIT;
      case Rank.JACK:
        return CardEffect.SKIP;
      case Rank.KING:
        return CardEffect.REVERSE;
      case Rank.QUEEN:
      case Rank.EIGHT:
        return CardEffect.QUESTION;
      default:
        return CardEffect.NONE;
    }
  }

  private static shuffle(deck: Card[]) {
    const result = [...deck];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
