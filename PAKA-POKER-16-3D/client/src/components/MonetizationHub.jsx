import { useMemo, useState } from 'react';
import PrimaryButton from '../ui/components/PrimaryButton';
import { MONETIZATION_FLAGS, PLUS_PRODUCT, REVENUE_SCENARIOS } from '../monetization/config';
import { trackMonetizationEvent } from '../monetization/analytics';
import { pendingPlatformBillingProvider } from '../services/monetizationService';
import { useMonetizationStore } from '../store/useMonetizationStore';

const plusBenefits = ['No Ads', 'Premium Tables', 'Premium Avatars', 'Premium Card Backs', 'Advanced Statistics', 'Extended Match History', 'Match Replays', 'Private Clubs', 'Premium Profile Badge', 'Seasonal Cosmetics'];
const labels = { profile: 'Player Profile', plus: 'PAKA Plus', cosmetics: 'Cosmetics', rankings: 'Rankings', creators: 'Creators', clubs: 'Clubs', business: 'Business Scenarios' };

export default function MonetizationHub({ initialView, onClose }) {
  const [view, setView] = useState(initialView || 'profile');
  const [message, setMessage] = useState('');
  const [activeUsers, setActiveUsers] = useState(2_000_000);
  const [conversion, setConversion] = useState(5);
  const { account, loading, error, equip } = useMonetizationStore();
  const isPlus = account?.entitlements.plan === 'plus';
  const conversionScenario = useMemo(() => {
    const subscribers = Math.round(activeUsers * conversion / 100);
    return { subscribers, monthlyGross: subscribers * PLUS_PRODUCT.price };
  }, [activeUsers, conversion]);

  const purchase = async () => {
    setMessage('');
    trackMonetizationEvent('subscription_started', { plan: PLUS_PRODUCT.id });
    try { await pendingPlatformBillingProvider.purchase(PLUS_PRODUCT.id); }
    catch (purchaseError) {
      trackMonetizationEvent('subscription_failed', { reason: 'provider_not_configured' });
      setMessage(purchaseError instanceof Error ? purchaseError.message : 'Purchase unavailable');
    }
  };
  const restore = async () => {
    setMessage('');
    try { await pendingPlatformBillingProvider.restorePurchases(); }
    catch (restoreError) { setMessage(restoreError instanceof Error ? restoreError.message : 'Restore unavailable'); }
  };

  return <div className="monetization-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="monetization-hub" role="dialog" aria-modal="true" aria-label={labels[view] || 'PAKA account'}>
      <button className="hub-close" type="button" onClick={onClose} aria-label="Close">×</button>
      <nav className="hub-nav" aria-label="Account features">
        {Object.entries(labels).filter(([key]) => key !== 'business' || import.meta.env.VITE_ADMIN_VIEW === 'true').map(([key, label]) =>
          <button type="button" key={key} className={view === key ? 'selected' : ''} onClick={() => { setView(key); if (key === 'plus') trackMonetizationEvent('subscription_viewed'); }}>{label}</button>)}
      </nav>
      <div className="hub-content">
        {loading && <p>Loading your PAKA account…</p>}
        {error && <p className="hub-message error">{error}</p>}
        {!loading && view === 'plus' && <>
          <span className="hub-eyebrow">OPTIONAL DIGITAL MEMBERSHIP</span>
          <h2>PAKA PLUS</h2>
          <p className="plus-price">KSh {PLUS_PRODUCT.price} <small>/ month</small></p>
          <p>Premium service and cosmetic benefits only. PAKA Plus never changes cards, draws, turns, matchmaking fairness, KADI, or winning.</p>
          <div className="benefit-grid">{plusBenefits.map((benefit) => <article key={benefit}><span>◆</span><strong>{benefit}</strong></article>)}</div>
          <div className="hub-actions">
            <PrimaryButton disabled={isPlus || !MONETIZATION_FLAGS.plus} onClick={purchase}>{isPlus ? 'PAKA Plus Active' : 'Upgrade to PAKA Plus'}</PrimaryButton>
            <PrimaryButton onClick={restore}>Restore Purchases</PrimaryButton>
          </div>
          <small>Apple/Google/web billing verification is pending. This screen cannot activate Plus locally.</small>
        </>}
        {!loading && view === 'profile' && <>
          <span className={`plan-badge ${isPlus ? 'plus' : ''}`}>{isPlus ? 'PLUS' : 'FREE'}</span>
          <h2>{account?.profile.user.displayName || 'PAKA Player'}</h2>
          <p>{account?.profile.progression.league || 'Bronze'} League · Level {account?.profile.progression.level || 1}</p>
          <div className="profile-stat-grid">
            <article><strong>{account?.profile.progression.xp || 0}</strong><span>XP</span></article>
            <article><strong>{account?.profile.stats.gamesPlayed || 0}</strong><span>Games</span></article>
            <article><strong>{account?.profile.stats.gamesWon || 0}</strong><span>Wins</span></article>
            <article><strong>{account?.profile.followerCount || 0}</strong><span>Followers</span></article>
          </div>
          <h3>Achievements</h3>
          <p>{account?.profile.achievements.length ? account.profile.achievements.map((achievement) => achievement.name).join(' · ') : 'Play matches to begin earning non-cash achievements and XP.'}</p>
        </>}
        {!loading && view === 'cosmetics' && <>
          <span className="hub-eyebrow">NON-PAY-TO-WIN CUSTOMIZATION</span><h2>Cosmetics</h2>
          <p>Cosmetics change appearance only and have no effect on card outcomes or legal play.</p>
          <div className="cosmetic-grid">{(account?.cosmetics || []).map((item) => {
            const accessible = item.owned || item.price === 0 || (item.premiumOnly && isPlus);
            return <article key={item.slug} className={item.equipped ? 'equipped' : ''}>
              <small>{item.category.replaceAll('_', ' ')}</small><strong>{item.name}</strong><p>{item.description}</p>
              <span>{item.price ? `KSh ${item.price}` : 'Included'}</span>
              <button disabled={!accessible || item.equipped} type="button" onClick={async () => { setMessage(''); try { await equip(item.slug); setMessage(`${item.name} equipped.`); } catch (equipError) { setMessage(equipError instanceof Error ? equipError.message : 'Unable to equip cosmetic'); } }}>{item.equipped ? 'Equipped' : accessible ? 'Equip' : item.premiumOnly ? 'Plus / ownership required' : 'Purchase required'}</button>
            </article>;
          })}</div>
        </>}
        {!loading && view === 'rankings' && <><span className="hub-eyebrow">COMPETITIVE, NON-CASH PROGRESSION</span><h2>Rankings & XP</h2><p>Bronze → Silver → Gold → Platinum → Diamond → Master → Legend</p><div className="foundation-card"><strong>Current rank: {account?.profile.progression.league || 'Bronze'}</strong><p>Rankings, XP, streaks and achievements have no cash redemption value.</p></div></>}
        {!loading && view === 'creators' && <><span className="hub-eyebrow">CREATOR FOUNDATION</span><h2>Creators</h2><div className="foundation-card"><strong>Audience tools are being prepared</strong><p>Profiles, following and engagement metrics will support future creators. Creator monetization coming later; no fake revenue is displayed.</p></div></>}
        {!loading && view === 'clubs' && <><span className="hub-eyebrow">SOCIAL GAME HOSTING</span><h2>Clubs</h2><div className="foundation-card"><strong>{isPlus ? 'Private club creation unlocked' : 'Public discovery foundation available'}</strong><p>Clubs and private rooms are social features only. They never contain stakes or player-funded cash pots.</p></div></>}
        {!loading && view === 'business' && <><span className="hub-eyebrow">ADMIN SCENARIO — NOT A FORECAST</span><h2>Revenue Scenarios</h2><p>Gross revenue before store fees, taxes and operating costs.</p><div className="scenario-grid">{REVENUE_SCENARIOS.map((scenario) => <article key={scenario.subscribers}><strong>{scenario.subscribers.toLocaleString()} subscribers</strong><span>KSh {scenario.monthlyGross.toLocaleString()} / month</span><span>KSh {scenario.yearlyGross.toLocaleString()} / year</span></article>)}</div><div className="conversion-calculator"><label>Monthly active users<input type="number" min="0" value={activeUsers} onChange={(event) => setActiveUsers(Number(event.target.value) || 0)} /></label><label>Conversion rate (%)<input type="number" min="0" max="100" step="0.1" value={conversion} onChange={(event) => setConversion(Number(event.target.value) || 0)} /></label><strong>{conversionScenario.subscribers.toLocaleString()} subscribers · KSh {conversionScenario.monthlyGross.toLocaleString()} monthly gross</strong></div></>}
        {message && <p className="hub-message" role="status">{message}</p>}
      </div>
    </section>
  </div>;
}
