import { Card } from './Card';

export class Deck {
  public drawPile: Card[];
  public discardPile: Card[];

  constructor(cards: Card[] = []) {
    this.drawPile = [...cards];
    this.discardPile = [];
  }

  public static fromCards(cards: Card[]) {
    return new Deck(cards);
  }

  public draw(count = 1): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i += 1) {
      if (this.drawPile.length === 0) {
        this.refillFromDiscard();
      }
      const card = this.drawPile.pop();
      if (!card) break;
      drawn.push(card);
    }
    return drawn;
  }

  public discard(card: Card) {
    this.discardPile.unshift(card);
  }

  public peekDiscard(): Card | null {
    return this.discardPile[0] ?? null;
  }

  public cardsRemaining(): number {
    return this.drawPile.length;
  }

  public refillFromDiscard() {
    if (this.discardPile.length <= 1) {
      return;
    }
    const [topCard, ...rest] = this.discardPile;
    const newDeck = [...rest];
    this.discardPile = [topCard];
    for (let i = newDeck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    this.drawPile = newDeck;
  }
}
