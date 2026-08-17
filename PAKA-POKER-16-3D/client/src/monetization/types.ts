export type Plan = 'free' | 'plus';
export type UserEntitlements = {
  plan: Plan; adsEnabled: boolean; premiumTables: boolean; premiumAvatars: boolean;
  premiumCardBacks: boolean; advancedStats: boolean; extendedHistory: boolean;
  replays: boolean; privateClubs: boolean; premiumBadge: boolean; seasonalCosmetics: boolean;
};
export type CosmeticItem = {
  slug: string; name: string; category: string; description: string; price: number;
  currency: string; premiumOnly: boolean; owned: boolean; equipped: boolean;
};
export type MonetizationAccount = {
  product: { id: string; name: string; price: number; currency: string; interval: string };
  subscription: null | { plan: Plan; status: string; provider: string; currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean };
  entitlements: UserEntitlements;
  profile: {
    user: { id: string; displayName: string; authType: string };
    stats: { gamesPlayed: number; gamesWon: number; kadiCalls: number; cardsPlayed: number };
    progression: { xp: number; level: number; league: string; currentStreak: number; bestStreak: number };
    followerCount: number;
    achievements: Array<{ slug: string; name: string; description: string; earnedAt: string }>;
    equippedCosmetics: Array<{ category: string; slug: string; name?: string }>;
  };
  cosmetics: CosmeticItem[];
};
