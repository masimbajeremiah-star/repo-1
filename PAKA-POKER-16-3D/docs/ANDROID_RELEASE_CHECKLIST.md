# Android release status

## Subscription configuration

- App package: `com.pakapoker.game16`
- Google Play subscription product: `paka_plus_monthly`
- Base plan: monthly, auto-renewing, KES 100
- Introductory offer: 30-day free trial for eligible new subscribers
- Billing provider: Google Play Billing only for the Android digital subscription
- Backend secret: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- Backend package setting: `GOOGLE_PLAY_PACKAGE_NAME=com.pakapoker.game16`

The Play Console product, base plan, trial offer, payments profile and service-account access must be created by the verified Play Console account owner. Upload the first signed Android App Bundle to an internal testing track, add licensed testers, and verify purchase, renewal, cancellation and restoration before production rollout.

## Required store disclosures

The store listing and subscription screen must state: 30 days free for eligible users, then KSh 100 per month; the subscription renews automatically unless cancelled; a valid Google Play payment method is required; and users can manage or cancel in Google Play.

## Platform status

- Android: implementation prepared; Play Console setup, signing and account-owner submission remain.
- iOS: launch paused. No iOS release work is authorized.
- M-PESA: remains a separate payment feature and is not used to sell the Android digital subscription.

## Safaricom merchant onboarding

A Buy Goods Till requires the merchant/account owner to complete Safaricom onboarding, accept the applicable terms and submit the required KYC documents. Do not place merchant credentials or service-account JSON in source control.
