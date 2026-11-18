# PAKA POWER 16 3D — Android release checklist

## App identity and membership

- Android package: `com.pakapoker.game16` (keep stable to update the existing Play app)
- Launcher/display name: `PAKA POWER 16 3D`
- Google Play subscription product: `paka_plus_monthly`
- Base plan: monthly, auto-renewing, KES 100
- Introductory offer: 30-day free trial for eligible new subscribers
- Billing provider: Google Play Billing only for the optional non-gameplay digital membership
- Backend secret: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- Backend package setting: `GOOGLE_PLAY_PACKAGE_NAME=com.pakapoker.game16`

The Play Console product, base plan, trial offer, payments profile and service-account access must be managed by the verified Play Console account owner. Upload a signed Android App Bundle to an internal testing track, add licensed testers, and verify purchase, renewal, cancellation and restoration before production rollout.

## Mandatory free-to-play / KADI presentation gate

The release must look and behave like a Kenyan KADI card game—not a casino or simulated gambling product.

- Show ordinary playing cards, KADI rules, card matching, draw/discard actions, turn order and the KADI call.
- Do not show casino tables, poker chips, roulette wheels, slot machines, betting slips, odds, wagers, stakes, jackpots, prize pots or cash-out controls.
- Do not describe game results as money, earnings, winnings, rewards with monetary value, or a way to make money.
- No entry fee, player-funded pot, wager, cash prize, withdrawal, or real-money game balance.
- Round completion may record game statistics only.
- Optional PAKA Plus must remain separate from card availability, draws, turns, matchmaking fairness and winning.

Review every live screen, animation, icon, screenshot, video, notification, menu item and deep link—not just store-description wording. If any screen still resembles a casino or offers betting-like behavior, do not submit that build.

## Signing and build artifacts

The GitHub Actions workflow `.github/workflows/android-release-build.yml` builds:
- a debug APK for installation and manual phone QA;
- an unsigned release AAB as a build verification artifact.

The unsigned AAB is not upload-ready. The release must be signed using the original app-signing/upload key associated with the existing Play Console app. Never commit a keystore, passwords, service-account JSON or signing secrets. Keep the package ID unchanged.

## Production database and backend sequence

1. In Render, take a manual backup/snapshot of the production PostgreSQL database and verify that it completed. Record the backup identifier and timestamp.
2. Do not deploy before the backup is confirmed. The Render blueprint intentionally has no automatic pre-deploy migration.
3. From `PAKA-POKER-16-3D/server`, with the production `DATABASE_URL` supplied securely, run `npm ci` and then `npm run migrate`. Confirm migration 004 is recorded as applied and verify the expected schema/comments.
4. Deploy the latest `main` commit to the existing Render web service.
5. Verify `/health`, guest registration/login, email registration/login, Socket.IO room join and a complete multiplayer KADI round.
6. Verify `GET /api/mpesa` and the old STK push/status/callback routes are unavailable (404), and confirm no payment routes are mounted. Do not rely on hiding client buttons.
7. If the migration or deployment fails, stop rollout and restore only from the verified backup using the hosting provider's recovery process.

Migration 004 is additive and preserves legacy wallet/M-PESA records. It does not erase historical rows.

## Phone QA — required before Play submission

Install the debug APK on a real Android phone and test:
- fresh guest entry, reconnect and guest session persistence;
- email sign-up, email login, invalid credentials and logout/login again;
- create/join a multiplayer room from two separate devices or one phone plus another tester;
- deal, play legal/illegal cards, draw, special-card effects, KADI announcement and round completion;
- reconnect after network loss and ensure both players see consistent state;
- confirm no wallet, chips, deposit, betting, stake, prize or cash-out UI is present;
- confirm no crash, clipped controls, unreadable cards or casino-style imagery on the phone.

Record device model, Android version, build commit, test date and pass/fail results. CI build success is not a substitute for physical-device testing.

## Google Play Console owner actions

The connected source repository cannot submit declarations on your behalf. In Play Console:
- update the title, short/full descriptions, screenshots, feature graphic and video to show KADI gameplay only;
- complete the content-rating questionnaire based on the actual release build, including the simulated-gambling questions truthfully;
- review the financial-features declaration, ads declaration, Data safety form, privacy-policy URL, app-access instructions and target-audience declarations;
- disclose the optional subscription price, automatic renewal, trial eligibility and cancellation route accurately;
- upload the signed AAB to internal testing, test it, then submit the reviewed release.

Google Play's current policy prohibits simulated gambling content and restricts real-money wagering and prize functionality. A KADI card-shedding game is not automatically approved: the actual app experience and its marketing assets must match the KADI-only description.

## Platform status

- Android CI build automation: configured in this repository; artifact generation must pass after commit.
- Physical phone QA: not performed by CI; tester evidence is required above.
- Production database backup/migration and Render deployment: require the account owner's production access.
- Play Console listing and declarations: require the account owner's Play Console access.
- iOS: no iOS release work is included in this Android task.
