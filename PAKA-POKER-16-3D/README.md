# PAKA Kadi 16 3D

## Launch instructions

### 1. Install dependencies

From the project root:

```bash
npm run install:all
```

If you encounter npm network or proxy errors, clear proxy environment variables and retry:

```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
npm run install:all
```

### 2. Start the server

```bash
npm run server:dev
```

### 3. Start the client

```bash
npm run client:dev
```

### 4. Open the app

Visit:

- Client: `http://localhost:4173`
- Server API: `http://localhost:3000/api/status`

## Kadi Rules

This app follows a common Kenyan Kadi rule set:

- Players: 2–5 (or more with a single deck)
- Deck: standard 52-card deck; Jokers are optional
- Deal 4 cards to each player
- Turn over one non-special card to start the discard pile
- Play begins clockwise
- Play a card matching the suit or rank of the top discard, or draw one card if you cannot play
- Multiple cards of the same rank may be played together if the first card is legal

Special cards:

- 2 = Draw Two penalty; next player draws 2 or defends with another 2 or Ace
- 3 = Draw Three penalty; next player draws 3 or defends with another 3 or Ace
- Ace = Cancels 2, 3, or Joker penalties and allows the player to declare the next suit
- Jack = Skip the next player
- King = Reverse direction of play
- Queen & 8 = Question cards that must be immediately followed by an answer card (4,5,6,7,9,10,A in many versions)
- Joker = Draw 5; can be canceled by another Joker or an Ace in common house rules

Kadi:

- When you have one card left, announce "Kadi!" before the next player starts their turn
- If you forget, opponents may force you to draw extra cards
- You usually cannot finish with a special card; valid winning cards are typically 4,5,6,7,9,10

## Useful scripts

- `npm run client:dev` — run the Vite React client
- `npm run client:build` — build the client for production
- `npm run server:dev` — run the Node/Express socket server with nodemon
- `npm run server:start` — run the server once in production mode
- `npm run dev:all` — start both client and server together

## Configuration

The client reads the socket URL from `client/.env`:

```env
VITE_SOCKET_URL=http://localhost:3000
```

If you move the backend to another host or port, update that value.
