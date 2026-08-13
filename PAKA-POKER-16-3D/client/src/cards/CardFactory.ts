/**
 * ==========================================================
 * CardFactory.ts
 * PAKA-POKER-16-3D
 *
 * Creates cards using the existing Card.ts architecture.
 * ==========================================================
 */

import {
  Card,
  Suit,
  Rank,
  CardEffect,
  cardImageFor,
} from "./Card";

import { CardEffects } from "./CardEffects";

export class CardFactory {

  /**
   * Create a normal playing card.
   */
  public static create(
    id: number,
    suit: Suit,
    rank: Rank
  ): Card {

    return {
      id,
      suit,
      rank,
      value: this.getValue(rank),
      effect: CardEffects.getEffect(rank),
      image: cardImageFor(rank, suit),
      playable: true,
    };

  }

  /**
   * Create the red Joker.
   */
  public static createRedJoker(id: number): Card {

    return {
      id,
      suit: Suit.JOKER,
      rank: Rank.JOKER,
      value: 14,
      effect: CardEffect.JOKER_DRAW,
      image: "cards/red_joker.png",
      playable: true,
    };

  }

  /**
   * Create the black Joker.
   */
  public static createBlackJoker(id: number): Card {

    return {
      id,
      suit: Suit.JOKER,
      rank: Rank.JOKER,
      value: 14,
      effect: CardEffect.JOKER_DRAW,
      image: "cards/black_joker.png",
      playable: true,
    };

  }

  /**
   * Create both Jokers.
   */
  public static createJokers(
    startingId: number
  ): Card[] {

    return [
      this.createRedJoker(startingId),
      this.createBlackJoker(startingId + 1),
    ];

  }

  /**
   * Convert rank to numeric value.
   */
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

      case Rank.JOKER:
        return 14;

      default:
        return 0;
    }

  }

}
