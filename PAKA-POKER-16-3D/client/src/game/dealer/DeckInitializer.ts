import { Deck } from "../../cards/Deck";
import { DeckBuilder } from "../../cards/DeckBuilder";

export class DeckInitializer {

  /**
   * Create a brand-new shuffled 54-card deck.
   */
  public static create(): Deck {

    const cards = DeckBuilder.createShuffledDeck();

    return new Deck(cards);

  }

}
