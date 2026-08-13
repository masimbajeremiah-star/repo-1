import { Card, Rank, RankOrder, answerRanks, isQuestionRank } from './Card';

export function isConsecutiveRun(cards: Card[]) {
  if (cards.length < 2) {
    return false;
  }
  const sorted = [...cards].sort((a, b) => RankOrder.indexOf(a.rank) - RankOrder.indexOf(b.rank));
  const suit = sorted[0].suit;
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = sorted[index - 1];
    if (current.suit !== suit) {
      return false;
    }
    if (RankOrder.indexOf(current.rank) !== RankOrder.indexOf(previous.rank) + 1) {
      return false;
    }
  }
  return true;
}

export function validateRun(cards: Card[], topCard: Card) {
  if (cards.length === 0) return false;
  if (!isConsecutiveRun(cards)) return false;
  const firstCard = cards[0];
  return firstCard.suit === topCard.suit || firstCard.rank === topCard.rank;
}

export function isValidAnswerCard(questionCard: Card, answerCard: Card) {
  return (
    answerCard.suit === questionCard.suit &&
    answerRanks.has(answerCard.rank) &&
    !isQuestionRank(answerCard.rank)
  );
}
