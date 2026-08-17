export interface RewardResult { granted: boolean; rewardType?: 'cosmetic_trial' | 'xp_boost' | 'profile_effect' }
export interface AdProvider {
  showInterstitial(placement: 'lobby' | 'results' | 'between_matches'): Promise<void>;
  showRewarded(placement: 'cosmetic_trial' | 'xp_boost'): Promise<RewardResult>;
  bannerEnabled(): boolean;
}
export const placeholderAdProvider: AdProvider = {
  async showInterstitial() {},
  async showRewarded() { return { granted: false }; },
  bannerEnabled: () => true,
};
