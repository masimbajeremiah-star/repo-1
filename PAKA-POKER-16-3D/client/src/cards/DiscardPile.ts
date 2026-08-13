/**
 * ==========================================================
 * DiscardPile.ts
 * PAKA-POKER-16-3D
 *
 * Manages cards that have been played/discarded.
 * The newest/top card is stored at index 0.
 * ==========================================================
 */

import { Card } from "./Card";

export class DiscardPile {

  private cards: Card[];

  constructor(cards: Card[] = []) {

    this.cards = [...cards];

  }

  /**
   * Add a card to the top of the discard pile.
   */
  public discard(card: Card): void {

    this.cards.unshift(card);

  }

  /**
   * Add multiple cards to the top of the pile.
   *
   * The first card supplied becomes the newest card.
   */
  public discardMany(cards: Card[]): void {

    for (const card of cards) {

      this.discard(card);

    }

  }

  /**
   * Get the top discarded card.
   */
  public peek(): Card | null {

    return this.cards[0] ?? null;

  }

  /**
   * Remove and return the top discarded card.
   */
  public takeTop(): Card | null {

    return this.cards.shift() ?? null;

  }

  /**
   * Get all discarded cards.
   *
   * Returns a copy so the internal pile cannot
   * accidentally be modified.
   */
  public getCards(): Card[] {

    return [...this.cards];

  }

  /**
   * Number of cards currently in the discard pile.
   */
  public size(): number {

    return this.cards.length;

  }

  /**
   * Check whether the discard pile is empty.
   */
  public isEmpty(): boolean {

    return this.cards.length === 0;

  }

  /**
   * Remove all cards from the discard pile.
   */
  public clear(): void {

    this.cards = [];

  }

  /**
   * Find a card by its ID.
   */
  public findById(id: number): Card | null {

    return (
      this.cards.find(
        card => card.id === id
      ) ?? null
    );

  }

  /**
   * Check whether a particular card ID
   * exists in the discard pile.
   */
  public contains(id: number): boolean {

    return this.cards.some(
      card => card.id === id
    );

  }

  /**
   * Remove a specific card by ID.
   */
  public removeById(id: number): Card | null {

    const index = this.cards.findIndex(
      card => card.id === id
    );

    if (index === -1) {

      return null;

    }

    const [removed] =
      this.cards.splice(index, 1);

    return removed ?? null;

  }

  /**
   * Return the discard pile in its current
   * top-to-bottom order.
   */
  public toArray(): Card[] {

    return [...this.cards];

  }

  /**
   * Create a DiscardPile from an existing
   * card array.
   */
  public static fromCards(
    cards: Card[]
  ): DiscardPile {

    return new DiscardPile(cards);

  }

}
