/**
 * ==========================================================
 * CardImages.ts
 * PAKA-POKER-16-3D
 *
 * Uses the existing card image convention from Card.ts.
 * ==========================================================
 */

import {
  Rank,
  Suit,
  cardImageFor,
} from "./CardEnums";

export class CardImages {

  public static getPath(
    suit: Suit,
    rank: Rank
  ): string {

    return cardImageFor(rank, suit);

  }

  public static getJokerPath(): string {

    return cardImageFor(
      Rank.JOKER,
      Suit.JOKER
    );

  }

  public static getBackPath(): string {

    return "cards/back.png";

  }

  public static getBasePath(): string {

    return "cards/";

  }

}
