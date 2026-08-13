/**
 * ==========================================================
 * CardSerializer.ts
 * PAKA-POKER-16-3D
 *
 * Serialization utilities for the existing Card model.
 * ==========================================================
 */

import {
  Card,
  Suit,
  Rank,
  CardEffect,
} from "./Card";

export class CardSerializer {

  /**
   * Convert one Card into a plain JSON-compatible object.
   */
  public static toObject(card: Card): Card {
    return {
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      value: card.value,
      effect: card.effect,
      image: card.image,
      playable: card.playable,
    };
  }

  /**
   * Convert one Card to a JSON string.
   */
  public static toJSON(card: Card): string {
    return JSON.stringify(
      this.toObject(card)
    );
  }

  /**
   * Convert multiple cards to plain objects.
   */
  public static cardsToObjects(
    cards: Card[]
  ): Card[] {

    return cards.map(
      card => this.toObject(card)
    );

  }

  /**
   * Convert multiple cards to JSON.
   */
  public static cardsToJSON(
    cards: Card[]
  ): string {

    return JSON.stringify(
      this.cardsToObjects(cards)
    );

  }

  /**
   * Restore a Card from an unknown object.
   */
  public static fromObject(
    value: unknown
  ): Card {

    if (!this.isObject(value)) {
      throw new Error(
        "Invalid card data."
      );
    }

    const card = value as Record<string, unknown>;

    if (
      typeof card.id !== "number" ||
      !Number.isInteger(card.id)
    ) {
      throw new Error(
        "Invalid card ID."
      );
    }

    if (
      !Object.values(Suit).includes(
        card.suit as Suit
      )
    ) {
      throw new Error(
        "Invalid card suit."
      );
    }

    if (
      !Object.values(Rank).includes(
        card.rank as Rank
      )
    ) {
      throw new Error(
        "Invalid card rank."
      );
    }

    if (
      typeof card.value !== "number" ||
      !Number.isFinite(card.value)
    ) {
      throw new Error(
        "Invalid card value."
      );
    }

    if (
      typeof card.effect !== "number" ||
      !Object.values(CardEffect).includes(
        card.effect as CardEffect
      )
    ) {
      throw new Error(
        "Invalid card effect."
      );
    }

    if (typeof card.image !== "string") {
      throw new Error(
        "Invalid card image."
      );
    }

    if (typeof card.playable !== "boolean") {
      throw new Error(
        "Invalid playable state."
      );
    }

    return {
      id: card.id,
      suit: card.suit as Suit,
      rank: card.rank as Rank,
      value: card.value,
      effect: card.effect as CardEffect,
      image: card.image,
      playable: card.playable,
    };

  }

  /**
   * Restore a Card from JSON.
   */
  public static fromJSON(
    json: string
  ): Card {

    let parsed: unknown;

    try {

      parsed = JSON.parse(json);

    } catch {

      throw new Error(
        "Invalid card JSON."
      );

    }

    return this.fromObject(parsed);

  }

  /**
   * Restore multiple cards from objects.
   */
  public static cardsFromObjects(
    values: unknown
  ): Card[] {

    if (!Array.isArray(values)) {

      throw new Error(
        "Expected an array of cards."
      );

    }

    return values.map(
      value => this.fromObject(value)
    );

  }

  /**
   * Restore multiple cards from JSON.
   */
  public static cardsFromJSON(
    json: string
  ): Card[] {

    let parsed: unknown;

    try {

      parsed = JSON.parse(json);

    } catch {

      throw new Error(
        "Invalid cards JSON."
      );

    }

    return this.cardsFromObjects(
      parsed
    );

  }

  /**
   * Check whether a value is a non-null object.
   */
  private static isObject(
    value: unknown
  ): value is Record<string, unknown> {

    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    );

  }

}
