/**
 * ==========================================================
 * Hand.ts
 * PAKA-POKER-16-3D
 *
 * Manages the cards held by a player.
 * ==========================================================
 */

import { Card } from "./Card";

export class Hand {

  private cards: Card[];

  constructor(cards: Card[] = []) {

    this.cards = [...cards];

  }

  /**
   * Add one card to the hand.
   */
  public add(card: Card): void {

    this.cards.push(card);

  }

  /**
   * Add multiple cards to the hand.
   */
  public addMany(cards: Card[]): void {

    this.cards.push(...cards);

  }

  /**
   * Remove a card using its ID.
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
   * Remove a specific card object.
   */
  public remove(card: Card): Card | null {

    return this.removeById(card.id);

  }

  /**
   * Remove the card at a specific position.
   */
  public removeAt(index: number): Card | null {

    if (
      index < 0 ||
      index >= this.cards.length
    ) {

      return null;

    }

    const [removed] =
      this.cards.splice(index, 1);

    return removed ?? null;

  }

  /**
   * Get a card by its ID.
   */
  public findById(id: number): Card | null {

    return (
      this.cards.find(
        card => card.id === id
      ) ?? null
    );

  }

  /**
   * Get a card by its position.
   */
  public get(index: number): Card | null {

    return this.cards[index] ?? null;

  }

  /**
   * Check whether the hand contains a card.
   */
  public contains(id: number): boolean {

    return this.cards.some(
      card => card.id === id
    );

  }

  /**
   * Return all cards.
   *
   * A copy is returned to protect the
   * internal hand state.
   */
  public getCards(): Card[] {

    return [...this.cards];

  }

  /**
   * Number of cards in the hand.
   */
  public size(): number {

    return this.cards.length;

  }

  /**
   * Check whether the hand is empty.
   */
  public isEmpty(): boolean {

    return this.cards.length === 0;

  }

  /**
   * Remove every card from the hand.
   */
  public clear(): Card[] {

    const removed = [...this.cards];

    this.cards = [];

    return removed;

  }

  /**
   * Find all cards matching a predicate.
   */
  public filter(
    predicate: (card: Card) => boolean
  ): Card[] {

    return this.cards.filter(predicate);

  }

  /**
   * Sort the hand without modifying the
   * original internal ordering.
   */
  public sorted(
    compareFn: (a: Card, b: Card) => number
  ): Card[] {

    return [...this.cards].sort(compareFn);

  }

  /**
   * Create a Hand from an existing card array.
   */
  public static fromCards(
    cards: Card[]
  ): Hand {

    return new Hand(cards);

  }

}
