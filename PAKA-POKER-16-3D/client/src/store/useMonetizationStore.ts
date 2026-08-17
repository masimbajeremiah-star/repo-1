import { create } from 'zustand';
import { equipCosmetic, loadMonetizationAccount } from '../services/monetizationService';
import type { MonetizationAccount } from '../monetization/types';

type MonetizationState = {
  account: MonetizationAccount | null; loading: boolean; loaded: boolean; error: string;
  load: (force?: boolean) => Promise<void>; equip: (slug: string) => Promise<void>; clear: () => void;
};
export const useMonetizationStore = create<MonetizationState>((set, get) => ({
  account: null, loading: false, loaded: false, error: '',
  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: '' });
    try { set({ account: await loadMonetizationAccount(), loaded: true }); }
    catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to load account benefits' }); }
    finally { set({ loading: false }); }
  },
  equip: async (slug) => { await equipCosmetic(slug); await get().load(true); },
  clear: () => set({ account: null, loaded: false, loading: false, error: '' }),
}));
