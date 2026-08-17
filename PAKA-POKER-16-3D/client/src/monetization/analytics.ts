export type MonetizationEventName =
  | 'subscription_viewed' | 'subscription_started' | 'subscription_success'
  | 'subscription_failed' | 'subscription_cancelled' | 'cosmetic_viewed'
  | 'cosmetic_purchased' | 'ad_impression' | 'creator_followed' | 'club_created';

export function trackMonetizationEvent(name: MonetizationEventName, properties: Record<string, string | number | boolean> = {}) {
  if (import.meta.env.DEV) console.debug('[PAKA ANALYTICS]', name, properties);
}
