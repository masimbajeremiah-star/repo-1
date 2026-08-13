import { randomUUID } from 'node:crypto';

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
export const SUIT_CHOICES = Object.freeze(['Spades', 'Hearts', 'Diamonds', 'Clubs']);
export const QUESTION_RANKS = Object.freeze(['8', 'Q']);
export const ANSWER_RANKS = Object.freeze(['4', '5', '6', '7', '9', '10', 'A']);

const CardEffect = Object.freeze({
  NONE: 0,
  DRAW_TWO: 1,
  DRAW_THREE: 2,
  SKIP: 3,
  REVERSE: 4,
  QUESTION: 5,
  CHOOSE_SUIT: 6,
  CANCEL_DRAW: 7,
  JOKER_DRAW: 8,
});

function getValue(rank) {
  switch (rank) {
    case 'A':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '5':
      return 5;
    case '6':
      return 6;
    case '7':
      return 7;
    case '8':
      return 8;
    case '9':
      return 9;
    case '10':
      return 10;
    case 'J':
      return 11;
    case 'Q':
      return 12;
    case 'K':
      return 13;
    case 'JOKER':
      return 14;
    default:
      return 0;
  }
}

function getEffect(rank) {
  switch (rank) {
    case '2':
      return CardEffect.DRAW_TWO;

    case '3':
      return CardEffect.DRAW_THREE;

    case 'A':
      return CardEffect.CHOOSE_SUIT;

    case 'J':
      return CardEffect.SKIP;

    case 'K':
      return CardEffect.REVERSE;

    case 'Q':
    case '8':
      return CardEffect.QUESTION;

    default:
      return CardEffect.NONE;
  }
}

function cardImageFor(rank, suit) {
  if (suit === 'Joker') {
    return `cards/${rank === 'JOKER' ? 'joker' : 'unknown'}.png`;
  }

  return `cards/${suit.toLowerCase()}_${rank}.png`;
}

function createCard(id, suit, rank, imageOverride = null) {
  return {
    id,
    suit,
    rank,
    value: getValue(rank),
    effect: getEffect(rank),
    image: imageOverride || cardImageFor(rank, suit),
    playable: true,
  };
}

export function createDeck() {
  const deck = [];
  let id = 1;

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(id++, suit, rank));
    }
  }

  deck.push(
    createCard(
      id++,
      'Joker',
      'JOKER',
      'cards/red_joker.png'
    )
  );

  deck.push(
    createCard(
      id++,
      'Joker',
      'JOKER',
      'cards/black_joker.png'
    )
  );

  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}

export function createGameState() {
  return {
    gameId: randomUUID(),
    deck: shuffleDeck(createDeck()),
    players: [],
    turnOrder: [],
    activePlayerIndex: 0,
    pile: [],
    round: 1,
    winnerId: null,
    gameOver: false,
    settledWinnerId: null,
    direction: 1,
    pendingDraw: 0,
    kadiCalledPlayerIds: [],
    questionState: null,
    selectedSuit: null,
    suitSelectionPlayerId: null,
  };
}

export function canCallKadi(state, playerId) {
  const player = state.players.find(
    (item) => item.id === playerId
  );

  return Boolean(player && player.hand.length === 1 && !state.questionState && !state.suitSelectionPlayerId && state.pendingDraw === 0);
}

export function markKadiCalled(state, playerId) {
  if (!canCallKadi(state, playerId)) return false;
  if (!state.kadiCalledPlayerIds.includes(playerId)) state.kadiCalledPlayerIds.push(playerId);
  return true;
}

export function getNextPlayer(state) {
  if (state.turnOrder.length === 0) {
    return null;
  }

  state.activePlayerIndex =
    (state.activePlayerIndex + (state.direction || 1) + state.turnOrder.length) % state.turnOrder.length;

  return state.turnOrder[state.activePlayerIndex];
}

export function drawCard(state, playerId) {
  const player = state.players.find(
    (item) => item.id === playerId
  );

  if (!player || state.deck.length === 0) {
    return null;
  }

  const card = state.deck.pop();

  player.hand.push(card);

  return card;
}

export function canPlayCard(state, card) {
  if (!state || !card) return false;
  if (state.suitSelectionPlayerId) return false;
  const topCard = state.pile[state.pile.length - 1];
  if (state.pendingDraw > 0 && !['2', '3', 'A', 'JOKER'].includes(card.rank)) return false;
  if (state.questionState && !QUESTION_RANKS.includes(card.rank) && !ANSWER_RANKS.includes(card.rank)) return false;
  if (!topCard) return true;
  if (card.suit === 'Joker' || card.rank === 'JOKER') return true;
  if (topCard.suit === 'Joker' || topCard.rank === 'JOKER') return true;
  if (state.questionState) return true;
  if (state.selectedSuit) return card.suit === state.selectedSuit;
  return card.suit === topCard.suit || card.rank === topCard.rank;
}

export function playCard(state, playerId, cardId) {
  const player = state.players.find(
    (item) => item.id === playerId
  );

  if (!player) {
    return null;
  }

  const cardIndex = player.hand.findIndex(
    (card) => card.id === cardId
  );

  if (cardIndex === -1) {
    return null;
  }

  if (!canPlayCard(state, player.hand[cardIndex])) {
    return null;
  }
  const candidate = player.hand[cardIndex];
  const finishingRanks = ['4', '5', '6', '7', '9', '10'];
  if (player.hand.length === 1 && (!finishingRanks.includes(candidate.rank) || !state.kadiCalledPlayerIds.includes(playerId))) {
    return null;
  }

  const [card] = player.hand.splice(cardIndex, 1);

  state.pile.push({
    ...card,
    playerId,
  });
  state.kadiCalledPlayerIds = state.kadiCalledPlayerIds.filter((id) => id !== playerId);
  if (QUESTION_RANKS.includes(card.rank)) {
    state.questionState = {
      initiatedBy: state.questionState?.initiatedBy || playerId,
      lastQuestionBy: playerId,
      chainLength: (state.questionState?.chainLength || 0) + 1,
      answerRanks: [...ANSWER_RANKS],
    };
  } else if (state.questionState && ANSWER_RANKS.includes(card.rank)) {
    state.questionState = null;
  }
  if (state.selectedSuit) state.selectedSuit = null;
  if (card.rank === '2') state.pendingDraw += 2;
  if (card.rank === '3') state.pendingDraw += 3;
  if (card.rank === 'JOKER') state.pendingDraw += 5;
  if (card.rank === 'A') {
    state.pendingDraw = 0;
    state.suitSelectionPlayerId = playerId;
  }
  if (card.rank === 'K') state.direction *= -1;
  if (card.rank === 'J') getNextPlayer(state);

  return card;
}

export function selectSuit(state, playerId, suit) {
  if (state.suitSelectionPlayerId !== playerId || !SUIT_CHOICES.includes(suit)) return false;
  state.selectedSuit = suit;
  state.suitSelectionPlayerId = null;
  return true;
}

export function checkForWinner(state) {
  const finishedPlayers = state.players.filter(
    (player) => player.hand.length === 0
  );

  if (finishedPlayers.length > 0) {
    state.winnerId = finishedPlayers[0].id;
    state.gameOver = true;
  }
}


export function startRound(state) {
  if (!state || state.players.length < 2) {
    return false;
  }

  // Do not deal a second time if this round already has cards.
  const alreadyStarted = state.players.some(
    (player) => Array.isArray(player.hand) && player.hand.length > 0
  );

  if (alreadyStarted) {
    return false;
  }

  // Rebuild and shuffle the deck for a fresh round.
  state.deck = shuffleDeck(createDeck());
  state.gameId = randomUUID();
  state.pile = [];
  state.gameOver = false;
  state.winnerId = null;
  state.settledWinnerId = null;
  state.lastDrawnCard = null;
  state.direction = 1;
  state.pendingDraw = 0;
  state.kadiCalledPlayerIds = [];
  state.questionState = null;
  state.selectedSuit = null;
  state.suitSelectionPlayerId = null;

  // Ensure turn order contains the current players.
  state.turnOrder = state.players.map((player) => player.id);
  state.activePlayerIndex = 0;

  // Clear existing hands.
  for (const player of state.players) {
    player.hand = [];
  }

  // Deal four cards to every player.
  for (let cardNumber = 0; cardNumber < 4; cardNumber += 1) {
    for (const player of state.players) {
      if (state.deck.length === 0) {
        return false;
      }

      const card = state.deck.pop();
      player.hand.push(card);
    }
  }

  // Start with an ordinary card so no unresolved effect exists before the
  // first player acts. Return skipped special cards to the deck and reshuffle.
  if (state.deck.length > 0) {
    const deferred = [];
    let openingCard = state.deck.pop();
    while (openingCard && getEffect(openingCard.rank) !== CardEffect.NONE) {
      deferred.push(openingCard);
      openingCard = state.deck.pop();
    }
    state.deck = shuffleDeck([...state.deck, ...deferred]);

    if (openingCard) state.pile.push({
      ...openingCard,
      playedBy: null,
      playedAt: Date.now(),
    });
  }

  return true;
}

export function resetGame(state) {
  const newState = createGameState();

  state.deck = newState.deck;
  state.gameId = newState.gameId;
  state.pile = [];
  state.activePlayerIndex = 0;
  state.round += 1;
  state.winnerId = null;
  state.settledWinnerId = null;
  state.gameOver = false;
  state.direction = 1;
  state.pendingDraw = 0;
  state.kadiCalledPlayerIds = [];
  state.questionState = null;
  state.selectedSuit = null;
  state.suitSelectionPlayerId = null;

  state.players.forEach((player) => {
    player.hand = [];
  });
}

export function addPlayer(state, player) {
  if (
    state.players.some(
      (item) => item.id === player.id
    )
  ) {
    return;
  }

  state.players.push({
    ...player,
    hand: [],
  });

  state.turnOrder.push(player.id);
}
