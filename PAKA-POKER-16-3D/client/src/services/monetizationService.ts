import { getServerUrl, getTestIdentity } from './socketService';
import type { MonetizationAccount } from '../monetization/types';

async function authorizedRequest(path: string, options: RequestInit = {}) {
  const token = getTestIdentity()?.token;
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`${getServerUrl()}/api/monetization${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'PAKA services are temporarily unavailable');
  return payload;
}

export const loadMonetizationAccount = () => authorizedRequest('/me') as Promise<MonetizationAccount>;
export const equipCosmetic = (slug: string) => authorizedRequest('/cosmetics/equip', { method: 'POST', body: JSON.stringify({ slug }) });
export const followPlayer = (userId: string) => authorizedRequest('/follow', { method: 'POST', body: JSON.stringify({ userId }) });
export const createClub = (input: { name: string; description?: string; privacy?: string }) => authorizedRequest('/clubs', { method: 'POST', body: JSON.stringify(input) });

export interface SubscriptionProvider {
  purchase(planId: string): Promise<never>;
  restorePurchases(): Promise<never>;
  getSubscriptionStatus(): Promise<MonetizationAccount>;
}

export const pendingPlatformBillingProvider: SubscriptionProvider = {
  async purchase() { throw new Error('Secure platform billing is not configured yet. No purchase was made.'); },
  async restorePurchases() { throw new Error('Purchase restoration will be available with Apple/Google billing integration.'); },
  getSubscriptionStatus: loadMonetizationAccount,
};
