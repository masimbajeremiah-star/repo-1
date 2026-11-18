# PAKA POWER 16 3D — Google Play free-to-play review

## Suggested Play Store listing

**Short description**

Free multiplayer KADI card game. No betting, wagers or cash prizes.

**Full description**

Play KADI with friends in PAKA POWER 16 3D, a free multiplayer card game made for entertainment. Create a table or join a public room, match suits and ranks, use special cards, and call KADI when you have one card left.

- Free to download and free to play.
- No entry fees or payment required to join a game.
- No betting, wagering, player-funded pots or stakes.
- No cash prizes, cash-out or real-money game balances.
- Game results are used for game statistics only.
- Optional PAKA Plus membership is purchased through Google Play and provides non-gameplay benefits. It does not change cards, draws, turns, KADI rules, matchmaking fairness or who wins.

PAKA POWER 16 3D is a KADI card game, not a real-money gambling service.

## Play Console checklist

Complete these declarations in Play Console yourself. A repository commit cannot submit or change Play Console declarations.

1. **Store listing:** Use the suggested title and description. Remove old references to poker, casino play, deposits, betting, stakes, cash rewards or winnings from the public listing, screenshots and promotional graphics if they no longer describe the app.
2. **Content rating:** Complete the rating questionnaire against the actual release build. Describe the game as multiplayer KADI/card-shedding gameplay. Answer every simulated-gambling question based on the actual screens, animations and features—not just this disclaimer. Remove casino/slot/roulette/betting imagery or mechanics.
3. **Real-money gambling:** The intended release has no real-money wagering, entry fees, player-funded pots, prizes or cash-out. Do not submit it as a real-money gambling app. Google Play separately prohibits simulated-casino content such as social casino apps; ensure the final app is clearly KADI gameplay rather than a simulated casino.
4. **Financial features:** Review any Financial features declaration shown in your console. The game should not offer financial services, player wallets, deposits, payouts or money management. Google Play-managed billing for the optional digital membership is a digital-content purchase, not a game stake or payout.
5. **Ads:** Declare whether the release contains ads based on the final shipped build and ad SDK/provider configuration. A placeholder or feature flag alone is not proof that ads are served. If ads are enabled in the release, make the declaration accordingly and ensure ad content is appropriate for the app's rating.
6. **Data safety and privacy:** Declare the data actually collected by the release, including account identifiers, email (if used), diagnostics/analytics and any ad SDK data. Keep the privacy-policy URL and in-app behavior consistent.
7. **App access:** Give Google Play reviewers working instructions or credentials if any area of the release requires sign-in. Confirm guest access is available if advertised.
8. **Monetization:** If PAKA Plus is enabled, accurately disclose the subscription price, renewal terms, trial eligibility and cancellation route. It must remain separate from gameplay outcomes.

## Code-level safeguards in the repository

- The Express server no longer mounts `/api/mpesa`; M-PESA STK push, status and callback handlers are removed.
- M-PESA configuration and client request helpers are removed.
- Player chip balances are removed from authentication responses and live table state.
- The round winner reward and participant chip deduction have been removed. A completed round records statistics only.
- Legacy database tables are retained to avoid deleting existing records; a new migration labels them deprecated and documents that they are not used for stakes or payouts.
- Optional Google Play membership is described as non-gameplay benefits only.

## Release checks still required

Run server tests and the client production build, inspect the Android release bundle and screenshots, and test a full multiplayer round before uploading. Confirm no old installed backend deployment or alternate API route still exposes payment endpoints. These checks are not completed merely by committing source changes.

## Official Google Play policy references

- [Real-Money Gambling, Games, and Contests](https://support.google.com/googleplay/android-developer/answer/9877032)
- [Prepare your app for review — App content declarations](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Common violations for gambling apps](https://support.google.com/googleplay/android-developer/answer/13381106)
