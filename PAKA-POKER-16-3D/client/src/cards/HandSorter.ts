import { Card, RankOrder, SuitOrder } from './Card';

export function sortHandBySuitThenRank(cards: Card[]) {
  return [...cards].sort((a, b) => {
    const suitComparison = SuitOrder.indexOf(a.suit) - SuitOrder.indexOf(b.suit);
    if (suitComparison !== 0) return suitComparison;
    return RankOrder.indexOf(a.rank) - RankOrder.indexOf(b.rank);
  });
}

export function groupHandBySuit(cards: Card[]) {
  return cards.reduce<Record<string, Card[]>>((acc, card) => {
    if (!acc[card.suit]) {
      acc[card.suit] = [];
    }
    acc[card.suit].push(card);
    return acc;
  }, {});
}
