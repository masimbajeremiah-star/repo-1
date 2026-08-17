export const PLUS_PRODUCT = Object.freeze({
  id: 'paka-plus-monthly',
  name: 'PAKA Plus',
  price: 300,
  currency: 'KES',
  interval: 'month',
});

const FREE_ENTITLEMENTS = Object.freeze({
  plan: 'free', adsEnabled: true, premiumTables: false, premiumAvatars: false,
  premiumCardBacks: false, advancedStats: false, extendedHistory: false,
  replays: false, privateClubs: false, premiumBadge: false, seasonalCosmetics: false,
});
const PLUS_ENTITLEMENTS = Object.freeze({
  plan: 'plus', adsEnabled: false, premiumTables: true, premiumAvatars: true,
  premiumCardBacks: true, advancedStats: true, extendedHistory: true,
  replays: true, privateClubs: true, premiumBadge: true, seasonalCosmetics: true,
});

export function resolveEntitlements(subscription, now = new Date()) {
  const valid = subscription?.plan === 'plus'
    && ['active', 'trialing'].includes(subscription.status)
    && subscription.currentPeriodEnd
    && new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
  return { ...(valid ? PLUS_ENTITLEMENTS : FREE_ENTITLEMENTS) };
}

export function createMonetizationService({ repository }) {
  return {
    async getAccount(userId) {
      const subscription = await repository.getCurrentSubscription(userId);
      const entitlements = resolveEntitlements(subscription);
      const [profile, cosmetics] = await Promise.all([
        repository.getPlayerProfile(userId),
        repository.listCosmetics(userId),
      ]);
      return { product: PLUS_PRODUCT, subscription, entitlements, profile, cosmetics };
    },
    async equipCosmetic(userId, slug) {
      const entitlements = resolveEntitlements(await repository.getCurrentSubscription(userId));
      return repository.equipCosmetic(userId, slug, entitlements);
    },
    async follow(userId, followedUserId) {
      if (userId === followedUserId) throw Object.assign(new Error('You cannot follow yourself'), { statusCode: 400 });
      return repository.followUser(userId, followedUserId);
    },
    async createClub(userId, input) {
      const entitlements = resolveEntitlements(await repository.getCurrentSubscription(userId));
      if (!entitlements.privateClubs) throw Object.assign(new Error('PAKA Plus is required to create a club'), { statusCode: 403 });
      return repository.createClub(userId, input);
    },
  };
}
