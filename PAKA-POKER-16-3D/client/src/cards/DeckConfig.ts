/**
 * ==========================================================
 * DeckConfig.ts
 * PAKA-POKER-16-3D
 *
 * Configuration for the existing 54-card deck.
 * ==========================================================
 */

import { Rank } from "./CardEnums";

export interface DeckConfiguration {

  includeJokers: boolean;

  jokerCount: number;

  allowDuplicates: boolean;

  defaultPlayable: boolean;

}

export const DeckConfig: DeckConfiguration = {

  includeJokers: true,

  jokerCount: 2,

  allowDuplicates: false,

  defaultPlayable: true,

};

/**
 * Standard 52-card ranks.
 */
export const STANDARD_RANKS: Rank[] = [

  Rank.A,

  Rank.TWO,

  Rank.THREE,

  Rank.FOUR,

  Rank.FIVE,

  Rank.SIX,

  Rank.SEVEN,

  Rank.EIGHT,

  Rank.NINE,

  Rank.TEN,

  Rank.JACK,

  Rank.QUEEN,

  Rank.KING,

];
