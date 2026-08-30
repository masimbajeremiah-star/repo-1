const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '★',
};

const normalizedSuit = (suit) => String(suit || '').trim().toLowerCase();
const displayRank = (card) => card?.rank || String(card?.value ?? '?');
const suitSymbol = (card) => SUIT_SYMBOLS[normalizedSuit(card?.suit)] || '?';
const isRedSuit = (card) => ['hearts', 'diamonds'].includes(normalizedSuit(card?.suit));

function CardFace({ card, className = '', style, disabled = false, onClick, label }) {
  const rank = displayRank(card);
  const symbol = suitSymbol(card);
  return (
    <button
      type="button"
      className={`screen-card ${isRedSuit(card) ? 'red-suit' : 'black-suit'} ${className}`}
      style={style}
      disabled={disabled}
      onClick={onClick}
      data-card-id={card?.id}
      aria-label={label || `${rank} of ${card?.suit || 'unknown suit'}`}
    >
      <span className="screen-card-corner"><strong>{rank}</strong><i>{symbol}</i></span>
      <span className="screen-card-suit" aria-hidden="true">{symbol}</span>
      <span className="screen-card-corner bottom" aria-hidden="true"><strong>{rank}</strong><i>{symbol}</i></span>
    </button>
  );
}

function WaitingCard({ className = '', style, label = 'Card waiting to be dealt' }) {
  return (
    <span className={`screen-card waiting-card ${className}`} style={style} aria-label={label} role="img">
      <span className="waiting-card-pattern" aria-hidden="true">♠</span>
    </span>
  );
}

export function LocalHandOverlay({ hand, canPlay, onPlay }) {
  const count = hand.length;
  const waitingForDeal = count === 0;
  const center = (count - 1) / 2;
  return (
    <div className="local-hand-overlay" data-local-hand-count={count} aria-label={`Your hand, ${count} cards`}>
      <div className="local-hand-label" aria-hidden="true">
        {waitingForDeal ? 'YOU • 4 CARDS DEAL WHEN ROUND STARTS' : `YOU • ${count} ${count === 1 ? 'CARD' : 'CARDS'}`}
      </div>
      <div className="local-hand-cards">
        {waitingForDeal && [0, 1, 2, 3].map((index) => {
          const offset = index - 1.5;
          return (
            <WaitingCard
              key={`waiting-hand-${index}`}
              className="local-screen-card"
              label={`Waiting hand card ${index + 1} of 4`}
              style={{
                transform: `translateX(${offset * -10}px) translateY(${Math.abs(offset) * 4}px) rotate(${offset * 4}deg)`,
                zIndex: index + 1,
              }}
            />
          );
        })}
        {hand.map((card, index) => {
          const offset = index - center;
          return (
            <CardFace
              key={card.id}
              card={card}
              className="local-screen-card"
              disabled={!canPlay}
              onClick={() => onPlay(card)}
              label={`${displayRank(card)} of ${card.suit}. ${canPlay ? 'Play card' : 'Wait for your turn'}`}
              style={{
                '--card-index': index,
                '--card-count': count,
                '--card-offset': offset,
                transform: `translateX(${offset * -10}px) translateY(${Math.abs(offset) * 4}px) rotate(${offset * 4}deg)`,
                zIndex: index + 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PlayedCardOverlay({ card }) {
  return (
    <div className="played-card-overlay" data-played-card-id={card?.id || 'waiting'} aria-label={card ? 'Current played card' : 'Waiting for starting card'}>
      <div className="played-card-label" aria-hidden="true">{card ? 'PLAYED CARD' : 'STARTING CARD'}</div>
      {card
        ? <CardFace card={card} className="played-screen-card" disabled label={`Current played card: ${displayRank(card)} of ${card.suit}`} />
        : <WaitingCard className="played-screen-card" label="Starting card waiting to be dealt" />}
    </div>
  );
}
