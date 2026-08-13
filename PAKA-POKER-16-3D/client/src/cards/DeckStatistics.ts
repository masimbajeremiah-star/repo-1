/**
 * ==========================================================
 * DeckStatistics.ts
 * PAKA-POKER-16-3D
 *
 * Statistics for the existing Card model.
 * ==========================================================
 */

import {
  Card,
  Suit,
  Rank,
} from "./Card";

export interface DeckStatisticsResult {

  totalCards: number;

  playableCards: number;

  specialCards: number;

  suits: Record<string, number>;

  ranks: Record<string, number>;

}

export class DeckStatistics {

  /**
   * Analyze a deck.
   */
  public static analyze(
    cards: Card[]
  ): DeckStatisticsResult {

    const suits: Record<string, number> = {};

    const ranks: Record<string, number> = {};

    let playableCards = 0;

    let specialCards = 0;

    for (const card of cards) {

      const suit = String(card.suit);

      const rank = String(card.rank);

      suits[suit] = (suits[suit] ?? 0) + 1;

      ranks[rank] = (ranks[rank] ?? 0) + 1;

      if (card.playable) {

        playableCards++;

      }

      if (this.isSpecial(card)) {

        specialCards++;

      }

    }

    return {

      totalCards: cards.length,

      playableCards,

      specialCards,

      suits,

      ranks,

    };

  }

  /**
   * Determine whether a card is a special
   * PAKA/Kadi card.
   */
  public static isSpecial(
    card: Card
  ): boolean {

    return card.effect !== 0;

  }

  /**
   * Count cards belonging to a suit.
   */
  public static countSuit(
    cards: Card[],
    suit: Suit
  ): number {

    return cards.filter(
      card => card.suit === suit
    ).length;

  }

  /**
   * Count cards of a particular rank.
   */
  public static countRank(
    cards: Card[],
    rank: Rank
  ): number {

    return cards.filter(
      card => card.rank === rank
    ).length;

  }

  /**
   * Calculate playable-card percentage.
   */
  public static playablePercentage(
    cards: Card[]
  ): number {

    if (cards.length === 0) {

      return 0;

    }

    const playable = cards.filter(
      card => card.playable
    ).length;

    return (
      playable / cards.length
    ) * 100;

  }

}
