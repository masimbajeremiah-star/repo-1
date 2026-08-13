/**
 * ==========================================================
 * CardEffects.ts
 * PAKA-POKER-16-3D
 *
 * Gameplay effects matching the existing DeckBuilder rules.
 * ==========================================================
 */

import {
  CardEffect,
  Rank,
} from "./CardEnums";

export class CardEffects {

  public static getEffect(rank: Rank): CardEffect {

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

      case Rank.EIGHT:
      case Rank.QUEEN:
        return CardEffect.QUESTION;

      case Rank.JOKER:
        return CardEffect.JOKER_DRAW;

      default:
        return CardEffect.NONE;
    }
  }

  public static isSpecial(rank: Rank): boolean {

    return this.getEffect(rank) !== CardEffect.NONE;

  }

  public static isDrawCard(rank: Rank): boolean {

    const effect = this.getEffect(rank);

    return (
      effect === CardEffect.DRAW_TWO ||
      effect === CardEffect.DRAW_THREE ||
      effect === CardEffect.JOKER_DRAW
    );

  }

  public static isQuestionCard(rank: Rank): boolean {

    return (
      rank === Rank.QUEEN ||
      rank === Rank.EIGHT
    );

  }

  public static isKing(rank: Rank): boolean {

    return rank === Rank.KING;

  }

  public static isAce(rank: Rank): boolean {

    return rank === Rank.A;

  }

  public static isJack(rank: Rank): boolean {

    return rank === Rank.JACK;

  }

  public static isJoker(rank: Rank): boolean {

    return rank === Rank.JOKER;

  }

  public static getDrawAmount(rank: Rank): number {

    switch (rank) {

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

}
