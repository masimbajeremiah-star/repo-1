/**
 * ==========================================================
 * CardValidator.ts
 * PAKA-POKER-16-3D
 *
 * Validation utilities for the existing Card model.
 * ==========================================================
 */

import {
  Card,
  Suit,
  Rank,
} from "./Card";

export class CardValidator {

  /**
   * Validate a single card.
   */
  public static isValid(card: Card): boolean {

    if (!card) {
      return false;
    }

    if (!Number.isInteger(card.id) || card.id <= 0) {
      return false;
    }

    if (!Object.values(Suit).includes(card.suit)) {
      return false;
    }

    if (!Object.values(Rank).includes(card.rank)) {
      return false;
    }

    if (!Number.isFinite(card.value)) {
      return false;
    }

    if (!Number.isInteger(card.effect)) {
      return false;
    }

    if (typeof card.image !== "string") {
      return false;
    }

    if (typeof card.playable !== "boolean") {
      return false;
    }

    return true;
  }

  /**
   * Validate every card in a deck.
   */
  public static validateDeck(cards: Card[]): boolean {

    if (!Array.isArray(cards)) {
      return false;
    }

    return cards.every(
      card => this.isValid(card)
    );
  }

  /**
   * Check that all card IDs are unique.
   */
  public static hasUniqueIds(cards: Card[]): boolean {

    const ids = new Set<number>();

    for (const card of cards) {

      if (ids.has(card.id)) {
        return false;
      }

      ids.add(card.id);

    }

    return true;
  }

  /**
   * Check that a standard deck contains
   * the expected 54 cards.
   */
  public static isStandard54CardDeck(
    cards: Card[]
  ): boolean {

    if (cards.length !== 54) {
      return false;
    }

    if (!this.validateDeck(cards)) {
      return false;
    }

    if (!this.hasUniqueIds(cards)) {
      return false;
    }

    return true;
  }

  /**
   * Return validation errors instead of only
   * returning true/false.
   */
  public static getErrors(
    cards: Card[]
  ): string[] {

    const errors: string[] = [];

    if (!Array.isArray(cards)) {
      return ["Deck is not an array."];
    }

    const ids = new Set<number>();

    for (const card of cards) {

      if (!Number.isInteger(card.id) || card.id <= 0) {
        errors.push(`Invalid card ID: ${card.id}`);
      }

      if (!Object.values(Suit).includes(card.suit)) {
        errors.push(`Invalid suit on card ${card.id}.`);
      }

      if (!Object.values(Rank).includes(card.rank)) {
        errors.push(`Invalid rank on card ${card.id}.`);
      }

      if (!Number.isFinite(card.value)) {
        errors.push(`Invalid value on card ${card.id}.`);
      }

      if (!Number.isInteger(card.effect)) {
        errors.push(`Invalid effect on card ${card.id}.`);
      }

      if (typeof card.image !== "string") {
        errors.push(`Invalid image on card ${card.id}.`);
      }

      if (typeof card.playable !== "boolean") {
        errors.push(`Invalid playable state on card ${card.id}.`);
      }

      if (ids.has(card.id)) {
        errors.push(`Duplicate card ID: ${card.id}`);
      }

      ids.add(card.id);

    }

    return errors;
  }

}
