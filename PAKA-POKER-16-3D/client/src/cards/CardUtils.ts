/**
 * ==========================================================
 * CardUtils.ts
 * PAKA-POKER-16-3D
 *
 * Shared utilities for the existing Card model.
 * ==========================================================
 */

import {
  Card,
  Suit,
  Rank,
  CardEffect,
} from "./Card";

export class CardUtils {

  /**
   * Check whether a card is a Joker.
   */
  public static isJoker(card: Card): boolean {

    return (
      card.rank === Rank.JOKER ||
      card.suit === Suit.JOKER
    );

  }

  /**
   * Check whether a card is an Ace.
   */
  public static isAce(card: Card): boolean {

    return card.rank === Rank.A;

  }

  /**
   * Check whether a card is a 2.
   */
  public static isTwo(card: Card): boolean {

    return card.rank === Rank.TWO;

  }

  /**
   * Check whether a card is a 3.
   */
  public static isThree(card: Card): boolean {

    return card.rank === Rank.THREE;

  }

  /**
   * Check whether a card is a King.
   */
  public static isKing(card: Card): boolean {

    return card.rank === Rank.KING;

  }

  /**
   * Check whether a card is a Jack.
   */
  public static isJack(card: Card): boolean {

    return card.rank === Rank.JACK;

  }

  /**
   * Check whether a card is a Question card.
   *
   * Existing game rules:
   * 8 and Queen.
   */
  public static isQuestionCard(card: Card): boolean {

    return (
      card.rank === Rank.EIGHT ||
      card.rank === Rank.QUEEN
    );

  }

  /**
   * Check whether a card is a penalty card.
   *
   * Existing game rules:
   * 2, 3 and Joker.
   */
  public static isPenaltyCard(card: Card): boolean {

    return (
      card.rank === Rank.TWO ||
      card.rank === Rank.THREE ||
      card.rank === Rank.JOKER
    );

  }

  /**
   * Get the draw penalty for a card.
   */
  public static getDrawAmount(card: Card): number {

    switch (card.rank) {

      case Rank.TWO:
        return 2;

      case Rank.THREE:
        return 3;

      case Rank.JOKER:
        return 5;

      default:
        return 0;
    }

  }

  /**
   * Check whether a card has a special effect.
   */
  public static isSpecial(card: Card): boolean {

    return card.effect !== CardEffect.NONE;

  }

  /**
   * Check whether two cards have the same suit.
   */
  public static sameSuit(
    first: Card,
    second: Card
  ): boolean {

    return first.suit === second.suit;

  }

  /**
   * Check whether two cards have the same rank.
   */
  public static sameRank(
    first: Card,
    second: Card
  ): boolean {

    return first.rank === second.rank;

  }

  /**
   * Check whether two cards are the same card.
   */
  public static sameCard(
    first: Card,
    second: Card
  ): boolean {

    return first.id === second.id;

  }

  /**
   * Compare cards by numeric value.
   */
  public static compareByValue(
    first: Card,
    second: Card
  ): number {

    return first.value - second.value;

  }

  /**
   * Return a readable card name.
   *
   * Example:
   * "Ace of Spades"
   */
  public static getDisplayName(
    card: Card
  ): string {

    if (this.isJoker(card)) {

      return `${card.suit} ${card.rank}`;

    }

    return `${card.rank} of ${card.suit}`;

  }

  /**
   * Get the numeric value of a card.
   */
  public static getValue(
    card: Card
  ): number {

    return card.value;

  }

  /**
   * Determine whether two cards can be
   * considered consecutive in a sequence.
   *
   * Jokers are handled separately and are
   * not automatically treated as consecutive.
   */
  public static isConsecutive(
    first: Card,
    second: Card
  ): boolean {

    if (
      this.isJoker(first) ||
      this.isJoker(second)
    ) {

      return false;

    }

    return (
      second.value === first.value + 1
    );

  }

  /**
   * Check whether cards share the same suit
   * and have consecutive values.
   */
  public static canFollowInSequence(
    first: Card,
    second: Card
  ): boolean {

    return (
      this.sameSuit(first, second) &&
      this.isConsecutive(first, second)
    );

  }

  /**
   * Return a copy of cards sorted by value.
   */
  public static sortByValue(
    cards: Card[]
  ): Card[] {

    return [...cards].sort(
      this.compareByValue
    );

  }

  /**
   * Return a copy sorted by suit first,
   * then card value.
   */
  public static sortBySuitAndValue(
    cards: Card[]
  ): Card[] {

    const suitOrder: Record<string, number> = {

      [Suit.SPADES]: 0,
      [Suit.HEARTS]: 1,
      [Suit.DIAMONDS]: 2,
      [Suit.CLUBS]: 3,
      [Suit.JOKER]: 4,

    };

    return [...cards].sort(
      (a, b) => {

        const suitDifference =
          (suitOrder[a.suit] ?? 99) -
          (suitOrder[b.suit] ?? 99);

        if (suitDifference !== 0) {

          return suitDifference;

        }

        return a.value - b.value;

      }
    );

  }

  /**
   * Find all cards of a particular suit.
   */
  public static bySuit(
    cards: Card[],
    suit: Suit
  ): Card[] {

    return cards.filter(
      card => card.suit === suit
    );

  }

  /**
   * Find all cards of a particular rank.
   */
  public static byRank(
    cards: Card[],
    rank: Rank
  ): Card[] {

    return cards.filter(
      card => card.rank === rank
    );

  }

}
