import { getServerUrl, getTestIdentity } from './socketService';
import type { MonetizationAccount } from '../monetization/types';
import { Capacitor, registerPlugin } from '@capacitor/core';

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
  purchase(planId: string): Promise<MonetizationAccount>;
  restorePurchases(): Promise<MonetizationAccount>;
  getSubscriptionStatus(): Promise<MonetizationAccount>;
}

type NativePurchase = { productId: string; purchaseToken: string; packageName: string };
type NativePurchases = { purchases: NativePurchase[] };
interface GooglePlayBillingPlugin {
  purchase(options: { productId: string; obfuscatedAccountId?: string }): Promise<NativePurchase>;
  restorePurchases(): Promise<NativePurchases>;
}

const nativeBilling = registerPlugin<GooglePlayBillingPlugin>('GooglePlayBilling');

async function verifyPurchase(purchase: NativePurchase) {
  return authorizedRequest('/google-play/verify', { method: 'POST', body: JSON.stringify(purchase) }) as Promise<MonetizationAccount>;
}

function requireAndroid() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('PAKA Plus subscriptions are available in the Android app through Google Play.');
  }
}

async function obfuscateAccountId(accountId?: string) {
  if (!accountId) return undefined;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accountId));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const googlePlayBillingProvider: SubscriptionProvider = {
  async purchase(planId) {
    requireAndroid();
    const obfuscatedAccountId = await obfuscateAccountId(getTestIdentity()?.id);
    return verifyPurchase(await nativeBilling.purchase({ productId: planId, obfuscatedAccountId }));
  },
  async restorePurchases() {
    requireAndroid();
    const { purchases } = await nativeBilling.restorePurchases();
    if (!purchases.length) throw new Error('No active Google Play subscription was found.');
    let account: MonetizationAccount | null = null;
    for (const purchase of purchases) account = await verifyPurchase(purchase);
    return account as MonetizationAccount;
  },
  getSubscriptionStatus: loadMonetizationAccount,
};
