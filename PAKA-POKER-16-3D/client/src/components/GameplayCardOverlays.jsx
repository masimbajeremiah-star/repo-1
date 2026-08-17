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

export function LocalHandOverlay({ hand, canPlay, onPlay }) {
  const count = hand.length;
  const center = (count - 1) / 2;
  return (
    <div className="local-hand-overlay" data-local-hand-count={count} aria-label={`Your hand, ${count} cards`}>
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
              transform: `translateX(${offset * -13}px) translateY(${Math.abs(offset) * 5}px) rotate(${offset * 4}deg)`,
              zIndex: index + 1,
            }}
          />
        );
      })}
    </div>
  );
}

export function PlayedCardOverlay({ card }) {
  if (!card) return null;
  return (
    <div className="played-card-overlay" data-played-card-id={card.id} aria-label="Current played card">
      <CardFace card={card} className="played-screen-card" disabled label={`Current played card: ${displayRank(card)} of ${card.suit}`} />
    </div>
  );
}
