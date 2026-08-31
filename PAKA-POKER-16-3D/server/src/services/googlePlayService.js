import { google } from 'googleapis';
import { PLUS_PRODUCT } from './monetizationService.js';

const STATES = Object.freeze({
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'active',
  SUBSCRIPTION_STATE_ON_HOLD: 'past_due',
  SUBSCRIPTION_STATE_PAUSED: 'past_due',
  // Google keeps a cancelled subscription entitled through its expiry time.
  SUBSCRIPTION_STATE_CANCELED: 'active',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING: 'past_due',
});

export function createGooglePlayService(config) {
  const rawCredentials = config.googlePlay.serviceAccountJson;
  if (!rawCredentials) return null;
  let credentials;
  try { credentials = JSON.parse(rawCredentials); }
  catch { throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be valid JSON'); }
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const publisher = google.androidpublisher({ version: 'v3', auth });

  return {
    async verifySubscription(input) {
      const purchaseToken = String(input.purchaseToken || '').trim();
      const productId = String(input.productId || '').trim();
      if (!purchaseToken || productId !== PLUS_PRODUCT.id) throw Object.assign(new Error('Invalid Google Play subscription purchase'), { statusCode: 400 });
      const response = await publisher.purchases.subscriptionsv2.get({ packageName: config.googlePlay.packageName, token: purchaseToken });
      const purchase = response.data;
      const lineItem = purchase.lineItems?.find((item) => item.productId === PLUS_PRODUCT.id);
      if (!lineItem?.expiryTime) throw Object.assign(new Error('Google Play did not confirm an active PAKA Plus product'), { statusCode: 400 });
      const status = STATES[purchase.subscriptionState] || 'expired';
      if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && ['active', 'trialing'].includes(status)) {
        await publisher.purchases.subscriptions.acknowledge({
          packageName: config.googlePlay.packageName,
          subscriptionId: PLUS_PRODUCT.id,
          token: purchaseToken,
          requestBody: {},
        });
      }
      return {
        plan: 'plus', status, provider: 'google_play', providerSubscriptionId: purchaseToken,
        currentPeriodStart: purchase.startTime || null, currentPeriodEnd: lineItem.expiryTime,
        cancelAtPeriodEnd: purchase.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED' || lineItem.autoRenewingPlan?.autoRenewEnabled === false,
      };
    },
  };
}
