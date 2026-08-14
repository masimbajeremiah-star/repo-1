import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import GameScene from '../game/GameScene';
import AssetLoader from '../components/AssetLoader';
import PrimaryButton from '../ui/components/PrimaryButton';
import InfoCard from '../ui/components/InfoCard';
import { emitEvent, getMpesaDepositStatus, requestMpesaDeposit } from '../services/socketService';

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const normalizeSuit = (suit) => String(suit || '').trim().toLowerCase();
const suitSymbol = (suit) => suitSymbols[normalizeSuit(suit)] || (normalizeSuit(suit) === 'joker' ? '★' : '?');
const suitColor = (suit) => ['hearts', 'diamonds'].includes(normalizeSuit(suit)) ? '#dc2626' : '#111827';
const cardLabel = (card) => card?.rank || String(card?.value ?? '');

const kadiRules = [
  {
    title: 'Setup',
    items: [
      '2–5 players (more with a single deck)',
      'Standard 52-card deck (Jokers optional)',
      'Deal 4 cards to each player',
      'Turn over one non-special card to start the discard pile',
      'Play begins clockwise',
    ],
  },
  {
    title: 'Basic Rule',
    items: [
      'Play a card matching the suit or rank of the top discard',
      'If you cannot play, draw one card',
      'You may play multiple cards of the same rank if the first is a legal play',
    ],
  },
  {
    title: 'Special Cards',
    items: [
      '2 = Draw Two. Next player must draw 2 or defend with another 2 or Ace',
      '3 = Draw Three. Next player must draw 3 or defend with another 3 or Ace',
      'Ace = Cancels 2, 3, or Joker penalties and lets you declare the next suit',
      'Jack = Skip the next player',
      'King = Reverse the direction of play',
      'Queen & 8 = Question cards that must be immediately followed by an answer card (4,5,6,7,9,10,A in many versions)',
      'Joker = Draw 5. Can be canceled by another Joker or an Ace in common house rules',
    ],
  },
  {
    title: 'Kadi & Winning',
    items: [
      'When you have one card left, announce "Kadi!" before the next player starts their turn',
      'If you forget, opponents can penalize you by making you draw cards',
      'You generally cannot finish with a special card: A, K, J, Q, 8, 2, 3, or Joker',
      'Valid final cards are usually 4, 5, 6, 7, 9, or 10',
    ],
  },
  {
    title: 'Runs',
    items: [
      'Runs are consecutive cards of the same suit played together',
      'The first card of the run must match the current top card by suit or rank',
      'Example: 9♠, 10♠, J♠, Q♠ played together after 8♠',
    ],
  },
];

function DepositDialog({ onClose }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);

  const submitDeposit = async (event) => {
    event.preventDefault();
    const normalizedPhone = phoneNumber.replace(/[\s-]/g, '');
    if (!/^(?:0[17]\d{8}|254[17]\d{8}|[17]\d{8})$/.test(normalizedPhone)) {
      setStatus('Enter a valid Kenyan Safaricom number, for example 07XXXXXXXX.');
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      setStatus('Enter a whole-number amount of at least KSh 1.');
      return;
    }

    setSubmitting(true);
    setStatus('Requesting an M-PESA prompt…');
    try {
      const result = await requestMpesaDeposit(normalizedPhone, numericAmount);
      setRequestAccepted(true);
      setSubmitting(false);
      setStatus(result.customerMessage || 'Request accepted. Complete the prompt on your phone.');
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const transaction = await getMpesaDepositStatus(result.checkoutRequestId);
        if (transaction.status === 'succeeded') {
          setStatus('M-PESA payment confirmed. Gameplay remains available regardless of payment.');
          return;
        }
        if (transaction.status === 'failed') {
          setStatus(transaction.resultDescription || 'The M-PESA request was not completed. You can continue playing.');
          return;
        }
      }
      setStatus('The request is still pending. You can close this window and continue playing.');
    } catch (error) {
      setStatus(error?.message || 'M-PESA request failed. You can continue playing without depositing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="deposit-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="deposit-dialog" role="dialog" aria-modal="true" aria-labelledby="deposit-title">
        <button className="deposit-close" type="button" disabled={submitting} onClick={onClose} aria-label="Close deposit dialog">×</button>
        <span className="deposit-optional">OPTIONAL</span>
        <h2 id="deposit-title">Deposit with M-PESA</h2>
        <p>Depositing is optional. You can close this window and continue playing for free.</p>
        <form onSubmit={submitDeposit}>
          <label htmlFor="deposit-phone">Safaricom phone number</label>
          <input id="deposit-phone" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="07XXXXXXXX" disabled={submitting || requestAccepted} />
          <label htmlFor="deposit-amount">Amount (KSh)</label>
          <input id="deposit-amount" inputMode="numeric" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="100" disabled={submitting || requestAccepted} />
          <PrimaryButton type="submit" disabled={submitting || requestAccepted}>{submitting ? 'REQUESTING…' : requestAccepted ? 'REQUEST SENT' : 'SEND M-PESA PROMPT'}</PrimaryButton>
        </form>
        <p className="deposit-status" role="status" aria-live="polite">{status}</p>
      </section>
    </div>
  );
}

export default function HomePage({ identity }) {
  const [assetsReady, setAssetsReady] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const previousPileCountRef = useRef(0);
  const players = useGameStore((state) => state.players);
  const clientId = useGameStore((state) => state.clientId);
  const round = useGameStore((state) => state.round);
  const deckCount = useGameStore((state) => state.deckCount);
  const pile = useGameStore((state) => state.pile);
  const hand = useGameStore((state) => state.hand);
  const turnOrder = useGameStore((state) => state.turnOrder);
  const lastDrawnCard = useGameStore((state) => state.lastDrawnCard);
  const activePlayerId = useGameStore((state) => state.activePlayerId);
  const winnerId = useGameStore((state) => state.winnerId);
  const gameOver = useGameStore((state) => state.gameOver);
  const actionMessage = useGameStore((state) => state.actionMessage);
  const dealCards = useGameStore((state) => state.dealCards);
  const resetGame = useGameStore((state) => state.resetGame);
  const playCard = useGameStore((state) => state.playCard);
  const kadiCall = useGameStore((state) => state.kadiCall);
  const setActionMessage = useGameStore((state) => state.setActionMessage);
  const demoStatus = useGameStore((state) => state.demoStatus);
  const tables = useGameStore((state) => state.tables);
  const currentTable = useGameStore((state) => state.currentTable);
  const pendingDraw = useGameStore((state) => state.pendingDraw);
  const questionState = useGameStore((state) => state.questionState);
  const selectedSuit = useGameStore((state) => state.selectedSuit);
  const suitSelectionPlayerId = useGameStore((state) => state.suitSelectionPlayerId);

  useSocket();
  const showDebugControls = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEBUG_CONTROLS === 'true';
  const demoCommand = (command) => emitEvent('demo.command', { command });
  const localPlayer = players.find((player) => player.id === clientId);
  const winner = players.find((player) => player.id === winnerId);
  const isHost = currentTable?.hostPlayerId === clientId;
  const mustSelectSuit = suitSelectionPlayerId === clientId;

  const activePlayerName = players.find((player) => player.id === activePlayerId)?.name || 'Waiting';
  const isYourTurn = clientId !== null && activePlayerId === clientId;
  const yourPosition = clientId ? turnOrder.findIndex((id) => id === clientId) : -1;
  const turnOrderPlayers = turnOrder.map((id) => players.find((player) => player.id === id)).filter(Boolean);
  const drawDisabled = !clientId || gameOver || players.length < 2 || deckCount <= 0 || !isYourTurn;
  const kadiDisabled = !clientId || gameOver || hand.length !== 1;
  const controlStatus = actionMessage || (
    !clientId
      ? 'Connecting to the table…'
      : gameOver
        ? 'Game over. Waiting for the table host to reset.'
      : players.length < 2
        ? 'Waiting for another real player to join.'
        : deckCount <= 0
          ? 'The draw deck is empty.'
        : !isYourTurn
          ? `Waiting for ${activePlayerName}'s turn.`
          : 'Your turn — draw or drag a playable card to the center.'
  );

  useEffect(() => {
    if (pile.length > previousPileCountRef.current) {
      const latestCard = pile[pile.length - 1];
      if (latestCard?.playerId === clientId) {
        setActionMessage('Card played successfully.');
      }
    }
    previousPileCountRef.current = pile.length;
  }, [pile, clientId, setActionMessage]);

  if (!currentTable) {
    return (
      <main className="lobby-screen">
        <section className="lobby-card">
          <div className="lobby-heading">
            <div>
              <span>PAKA Poker 16 3D</span>
              <h1>Choose a table</h1>
              <p>{identity?.name || 'Guest'} · Free card gameplay</p>
            </div>
            <div className="lobby-heading-actions">
              <PrimaryButton onClick={() => setDepositOpen(true)}>Deposit</PrimaryButton>
              <PrimaryButton onClick={() => emitEvent('table.create', { name: `${identity?.name || 'Guest'}'s Table`, maxPlayers: 5 })}>
                Create Table
              </PrimaryButton>
            </div>
          </div>
          <div className="lobby-table-list" aria-live="polite">
            {tables.length === 0 ? <p>No open tables yet. Create the first one.</p> : tables.map((table) => (
              <article key={table.id} className="lobby-table-row">
                <div>
                  <strong>{table.name}</strong>
                  <span>{table.playerCount}/{table.maxPlayers} players</span>
                </div>
                <PrimaryButton
                  disabled={table.playerCount >= table.maxPlayers}
                  onClick={() => {
                    setActionMessage(`Joining ${table.name}…`);
                    emitEvent('table.join', table.id);
                  }}
                >
                  {table.playerCount >= table.maxPlayers ? 'Full' : 'Join'}
                </PrimaryButton>
              </article>
            ))}
          </div>
          <p className="lobby-status" role="status">{actionMessage || 'Connected. Select a table to begin.'}</p>
        </section>
        {depositOpen && <DepositDialog onClose={() => setDepositOpen(false)} />}
      </main>
    );
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>PAKA Poker 16 3D</h1>
          <p>3D poker lobby with live player state and card dealing.</p>
        </div>
        <div className="page-header-actions">
          <PrimaryButton onClick={() => setDepositOpen(true)}>Deposit</PrimaryButton>
          <PrimaryButton onClick={dealCards}>Draw Card</PrimaryButton>
        </div>
      </header>

      <section className="content-grid">
        <div className="panel-panel">
          <InfoCard title="Round" value={`#${round}`} />
          <InfoCard title="Deck" value={`${deckCount} cards`} />
          <InfoCard title="Active Player" value={activePlayerName} />
          <InfoCard title="Your Turn" value={isYourTurn ? 'Yes' : 'No'} />
          <InfoCard title="Your Position" value={yourPosition >= 0 ? `#${yourPosition + 1}` : 'N/A'} />
          <InfoCard title="Winner" value={winnerId || 'None'} />
          <InfoCard title="Status" value={actionMessage || 'Connected'} />

          <div className="action-row">
            <PrimaryButton
              onClick={() => {
                resetGame();
              }}
            >
              Reset Game
            </PrimaryButton>
            <PrimaryButton
              onClick={() => {
                kadiCall();
                setActionMessage('Kadi! called.');
              }}
            >
              KADI
            </PrimaryButton>
          </div>

          <div className="player-list">
            <h2>Players</h2>
            {players.length === 0 ? (
              <p>Waiting for players...</p>
            ) : (
              players.map((player) => {
                const isActive = player.id === activePlayerId;
                const orderIndex = turnOrder.findIndex((id) => id === player.id);
                return (
                  <div key={player.id} className={`player-item ${isActive ? 'active-player' : ''}`}>
                    <strong>
                      {player.name}
                      {isActive ? ' • Active' : ''}
                    </strong>
                    <span>Position: {orderIndex >= 0 ? `#${orderIndex + 1}` : '-'}</span>
                    <span>Hand: {player.handCount ?? 0}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="turn-order-panel">
            <h2>Turn Order</h2>
            {turnOrderPlayers.length === 0 ? (
              <p>Order not available yet.</p>
            ) : (
              <ol className="turn-order-list">
                {turnOrderPlayers.map((player, index) => (
                  <li key={player.id} className={player.id === activePlayerId ? 'active-turn-item' : ''}>
                    {index + 1}. {player.name}
                    {player.id === activePlayerId ? ' (Current)' : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rules-panel">
            <h2>Kadi Rules</h2>
            {kadiRules.map((section) => (
              <div key={section.title} className="rules-section">
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pile-summary">
            <h2>Pile</h2>
            <p>{pile.length} cards played</p>
          </div>

          <div className="hand-summary">
            <h2>Your Hand</h2>
            <p>
              {hand.length} cards
              {lastDrawnCard ? (
                <> — last: {cardLabel(lastDrawnCard)}{' '}
                  <span style={{ color: suitColor(lastDrawnCard.suit) }}>
                    {suitSymbol(lastDrawnCard.suit)}
                  </span>
                </>
              ) : ''}
            </p>
            <div className="hand-list">
              {hand.length === 0 ? (
                <span className="hand-chip empty">No cards yet</span>
              ) : (
                hand.map((card) => {
                  const canPlay = isYourTurn && !gameOver;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`hand-chip ${canPlay ? 'playable-card' : 'disabled-card'}`}
                      disabled={!canPlay}
                      onClick={() => {
                        if (!canPlay) return;

                        playCard(card.id);
                        setActionMessage(`Playing ${cardLabel(card)} ${card.suit}...`);
                      }}
                      title={
                        canPlay
                          ? `Play ${cardLabel(card)} of ${card.suit}`
                          : 'You cannot play a card right now'
                      }
                    >
                      {cardLabel(card)}{' '}
                      <span style={{ color: suitColor(card.suit) }}>
                        {suitSymbol(card.suit)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="scene-panel">
          <div className="mobile-profile-chip">
            <strong>{localPlayer?.name || identity?.name || 'Guest'}</strong>
            <span>Free play</span>
          </div>
          <div className="table-controls" aria-label="Game controls">
            {mustSelectSuit && (
              <div className="suit-selector" role="dialog" aria-label="Select the next suit">
                <strong>Choose the next suit</strong>
                <div>{['Hearts', 'Diamonds', 'Clubs', 'Spades'].map((suit) => (
                  <button key={suit} type="button" onClick={() => emitEvent('selectSuit', suit)}>
                    <span style={{ color: suitColor(suit) }}>{suitSymbol(suit)}</span> {suit}
                  </button>
                ))}</div>
              </div>
            )}
            <PrimaryButton
              disabled={drawDisabled}
              onClick={() => {
                setActionMessage('Requesting one card from the dealer…');
                dealCards();
              }}
            >
              {isYourTurn ? 'Draw Card' : 'Waiting for Turn'}
            </PrimaryButton>
            <PrimaryButton
              disabled={kadiDisabled}
              onClick={() => {
                setActionMessage('Calling KADI…');
                kadiCall();
              }}
            >
              KADI
            </PrimaryButton>
            <PrimaryButton onClick={() => window.dispatchEvent(new Event('poker:resetCamera'))}>
              Reset Camera
            </PrimaryButton>
            <PrimaryButton onClick={() => emitEvent('table.leave')}>
              Leave Table
            </PrimaryButton>
            <div className="gameplay-status" role="status" aria-live="polite">
              <span>{controlStatus}</span>
              {questionState && <span className="control-hint">Question chain ×{questionState.chainLength}: answer with 4, 5, 6, 7, 9, 10 or Ace; another 8/Queen continues it.</span>}
              {selectedSuit && <span className="control-hint">Declared suit: {selectedSuit}</span>}
              {pendingDraw > 0 && <span className="control-hint">Draw penalty: {pendingDraw} cards.</span>}
              {kadiDisabled && !gameOver && (
                <span className="control-hint">KADI requires exactly one card.</span>
              )}
            </div>
          </div>
          {gameOver && (
            <div className="winner-overlay" role="dialog" aria-label="Round result">
              <span>WINNER</span>
              <strong>{winner?.name || 'Player'}</strong>
              <p>{winnerId === clientId ? 'You won the round.' : 'Round complete.'}</p>
              <PrimaryButton disabled={!isHost} onClick={() => {
                setActionMessage('Starting a clean new round…');
                resetGame();
              }}>{isHost ? 'PLAY AGAIN' : 'WAITING FOR HOST'}</PrimaryButton>
            </div>
          )}
          {showDebugControls && (
            <aside className="demo-debug-panel" aria-label="Demo controls">
              <strong>DEMO CONTROLS</strong>
              <span>{demoStatus.stage}: {demoStatus.message || 'Ready'}</span>
              <div>
                <PrimaryButton disabled={demoStatus.running} onClick={() => demoCommand('run')}>RUN FULL DEMO</PrimaryButton>
                <PrimaryButton onClick={() => demoCommand('reset')}>RESET DEMO</PrimaryButton>
                <PrimaryButton onClick={() => demoCommand('deal')}>DEAL CARDS</PrimaryButton>
                <PrimaryButton onClick={() => demoCommand('next')}>NEXT TURN</PrimaryButton>
                <PrimaryButton onClick={() => demoCommand('kadi')}>FORCE KADI TEST</PrimaryButton>
                <PrimaryButton onClick={() => demoCommand('win')}>FORCE WIN TEST</PrimaryButton>
                <PrimaryButton onClick={() => demoCommand('stop')}>STOP DEMO</PrimaryButton>
              </div>
            </aside>
          )}
          {!assetsReady && <AssetLoader onLoaded={() => setAssetsReady(true)} />}
          {assetsReady && <GameScene />}
        </div>
      </section>
      {depositOpen && <DepositDialog onClose={() => setDepositOpen(false)} />}
    </div>
  );
}
