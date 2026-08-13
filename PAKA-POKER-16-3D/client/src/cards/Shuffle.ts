/**
 * ==========================================================
 * Shuffle.ts
 * PAKA-POKER-16-3D
 *
 * Card shuffling utilities.
 *
 * Uses Fisher-Yates for unbiased random shuffling.
 * ==========================================================
 */

import { Card } from "./Card";

export class Shuffle {

  /**
   * Return a shuffled COPY of the supplied cards.
   *
   * The original array is not modified.
   */
  public static shuffle(cards: Card[]): Card[] {

    const result = [...cards];

    this.shuffleInPlace(result);

    return result;
  }

  /**
   * Shuffle the supplied array in place.
   */
  public static shuffleInPlace(cards: Card[]): Card[] {

    for (
      let i = cards.length - 1;
      i > 0;
      i--
    ) {

      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [
        cards[i],
        cards[j]
      ] = [
        cards[j],
        cards[i]
      ];

    }

    return cards;
  }

  /**
   * Create a shuffled copy using a supplied
   * random-number generator.
   *
   * Useful for deterministic tests.
   */
  public static shuffleWithRandom(
    cards: Card[],
    random: () => number
  ): Card[] {

    const result = [...cards];

    for (
      let i = result.length - 1;
      i > 0;
      i--
    ) {

      const value = random();

      const j = Math.floor(
        Math.max(0, Math.min(0.999999999, value))
        * (i + 1)
      );

      [
        result[i],
        result[j]
      ] = [
        result[j],
        result[i]
      ];

    }

    return result;
  }

  /**
   * Check whether two card arrays have
   * exactly the same card IDs.
   *
   * Useful for verifying that shuffling
   * did not add or remove cards.
   */
  public static containsSameCards(
    original: Card[],
    shuffled: Card[]
  ): boolean {

    if (original.length !== shuffled.length) {

      return false;

    }

    const originalIds = original
      .map(card => card.id)
      .sort((a, b) => a - b);

    const shuffledIds = shuffled
      .map(card => card.id)
      .sort((a, b) => a - b);

    for (
      let i = 0;
      i < originalIds.length;
      i++
    ) {

      if (
        originalIds[i] !== shuffledIds[i]
      ) {

        return false;

      }

    }

    return true;
  }

  /**
   * Determine whether the order of two
   * card arrays is different.
   */
  public static orderChanged(
    original: Card[],
    shuffled: Card[]
  ): boolean {

    if (original.length !== shuffled.length) {

      return true;

    }

    for (
      let i = 0;
      i < original.length;
      i++
    ) {

      if (
        original[i].id !== shuffled[i].id
      ) {

        return true;

      }

    }

    return false;
  }

  /**
   * Shuffle a complete PAKA deck.
   *
   * This method is provided as a convenient
   * alias for normal deck shuffling.
   */
  public static shuffleDeck(
    deck: Card[]
  ): Card[] {

    return this.shuffle(deck);

  }

}
