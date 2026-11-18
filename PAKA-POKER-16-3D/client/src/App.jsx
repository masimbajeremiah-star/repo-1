import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { restoreIdentity, saveTestIdentity, registerEmail, loginEmail } from './services/socketService';
import { icons } from './assets';

export default function App() {
  const [identity, setIdentity] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [name, setName] = useState(identity?.name || '');
  const [mode, setMode] = useState('guest');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    let active = true;
    restoreIdentity()
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setIdentity(saved);
          setName(saved.name);
        }
      })
      .catch((error) => {
        if (active) setAuthError(error instanceof Error ? error.message : 'Could not verify your saved session.');
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  if (checkingSession) {
    return (
      <main className="entry-screen">
        <div className="entry-card">
          <img src={icons.logo} alt="PAKA Poker 16" />
          <h1>PAKA Poker 16 3D</h1>
          <p>Checking your saved player session…</p>
        </div>
        <FeedbackPanel />
      </main>
    );
  }

  if (!identity) {
    return (
      <main className="entry-screen">
        <form className="entry-card" onSubmit={async (event) => {
          event.preventDefault();
          if (loading) return;
          setLoading(true); setAuthError('');
          try {
            const cleanName = name.trim();
            const cleanEmail = email.trim();
            if (mode === 'register' && !cleanName) throw new Error('Enter a player name to create your account.');
            if (mode !== 'guest' && !cleanEmail) throw new Error('Enter your email address.');
            if (mode !== 'guest' && !password) throw new Error('Enter your password.');
            if (mode === 'register' && password.length < 10) throw new Error('New passwords must contain at least 10 characters.');
            const result = mode === 'guest' ? await saveTestIdentity(cleanName || 'Guest') : mode === 'register' ? await registerEmail(cleanName, cleanEmail, password) : await loginEmail(cleanEmail, password);
            setIdentity(result);
          } catch (error) { setAuthError(error instanceof Error ? error.message : 'Authentication failed'); } finally { setLoading(false); }
        }}>
          <img src={icons.logo} alt="PAKA Poker 16" />
          <span className="welcome-eyebrow">KENYA'S MULTIPLAYER CARD EXPERIENCE</span>
          <h1>PAKA POWER <span>16 3D</span></h1>
          <p className="welcome-intro">A free-to-play multiplayer card game for fun and friendly competition.</p>
          <aside className="free-play-notice" aria-label="Free game, no gambling">
            <strong>100% FREE TO PLAY</strong>
            <span>NOT A GAMBLING APP</span>
            <small>No real-money betting · No wagering · No deposits · No cash prizes</small>
          </aside>
          <section className="quick-start" aria-label="Quick start">
            <h2>QUICK START</h2>
            <div className="quick-start-grid">
              <button type="button" className={mode === 'guest' ? 'quick-start-action active' : 'quick-start-action'} onClick={() => { setMode('guest'); setAuthError(''); }}>♠ <span>Play as Guest</span></button>
              <button type="button" className={mode === 'register' ? 'quick-start-action active' : 'quick-start-action'} onClick={() => { setMode('register'); setAuthError(''); }}>＋ <span>Create Account</span></button>
              <button type="button" className={mode === 'login' ? 'quick-start-action active' : 'quick-start-action'} onClick={() => { setMode('login'); setAuthError(''); }}>↪ <span>Login</span></button>
              <button type="button" className="quick-start-action" onClick={() => setShowHowTo(true)}>ⓘ <span>How to Play</span></button>
            </div>
          </section>
          <div className="auth-tabs">{['guest','login','register'].map((item) => <button className={mode === item ? 'selected' : ''} disabled={loading} type="button" key={item} onClick={() => { setMode(item); setAuthError(''); }}>{item}</button>)}</div>
          {mode !== 'login' && <><label htmlFor="player-name">Player name</label><input id="player-name" value={name} maxLength={32} autoComplete="nickname" onChange={(event) => setName(event.target.value)} placeholder="Guest" /></>}
          {mode !== 'guest' && <><label htmlFor="email">Email</label><input id="email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /><label htmlFor="password">Password</label><input id="password" type="password" minLength={mode === 'register' ? 10 : undefined} required value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(event) => setPassword(event.target.value)} /></>}
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button disabled={loading} type="submit">{loading ? 'CONNECTING…' : mode === 'guest' ? 'ENTER AS GUEST' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</button>
          {showHowTo && (
            <div className="how-to-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowHowTo(false); }}>
              <section className="how-to-dialog" role="dialog" aria-modal="true" aria-labelledby="how-to-title">
                <button type="button" className="how-to-close" onClick={() => setShowHowTo(false)} aria-label="Close instructions">×</button>
                <span className="welcome-eyebrow">PAKA POWER 16 3D</span>
                <h2 id="how-to-title">How to Play KADI</h2>
                <ol>
                  <li>Choose Play as Guest or sign in to your account.</li>
                  <li>Create a table or join an available public table.</li>
                  <li>Match the top card by suit or rank. If you cannot play, draw a card.</li>
                  <li>Use special cards strategically and follow the house rules at your table.</li>
                  <li>When you have one card left, call <strong>KADI!</strong> before the next player begins.</li>
                  <li>Play your final valid card to win the round.</li>
                </ol>
                <p>PAKA POWER 16 3D is for entertainment only. There is no real-money betting, wagering, deposits or cash prizes.</p>
                <button type="button" onClick={() => setShowHowTo(false)}>GOT IT</button>
              </section>
            </div>
          )}
        </form>
        <FeedbackPanel />
      </main>
    );
  }
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage identity={identity} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FeedbackPanel />
    </div>
  );
}

function FeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const feedbackMessage = message.trim() || 'I would like to share feedback about PAKA POWER 16 3D.';
  const emailSubject = encodeURIComponent('PAKA POWER 16 3D – User Testing Feedback');
  const emailBody = encodeURIComponent('Hello,\n\n' + feedbackMessage + '\n\nSent from PAKA POWER 16 3D user testing.');
  const whatsappText = encodeURIComponent('Hello, I am testing PAKA POWER 16 3D.\n\n' + feedbackMessage);

  return (
    <>
      <button
        className="feedback-launcher"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">✉</span>
        <span>USER FEEDBACK</span>
      </button>
      {open && (
        <div className="feedback-backdrop" onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <button className="feedback-close" type="button" onClick={() => setOpen(false)} aria-label="Close feedback">×</button>
            <span className="feedback-eyebrow">PAKA POWER 16 3D · USER TESTING</span>
            <h2 id="feedback-title">Help us improve the game</h2>
            <p>Found a bug? Have an idea or suggestion? Send it directly to the developer.</p>
            <label htmlFor="paka-feedback-message">Your comments or suggestions</label>
            <textarea
              id="paka-feedback-message"
              rows={5}
              maxLength={3000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us what worked, what did not, or what you would like improved…"
            />
            <div className="feedback-send-options">
              <a className="feedback-email-link" href={`mailto:masimbajeremiah@gmail.com?subject=${emailSubject}&body=${emailBody}`}>
                <span aria-hidden="true">✉</span>
                Send by Email
              </a>
              <a className="feedback-whatsapp-link" href={`https://wa.me/971553549577?text=${whatsappText}`} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">◉</span>
                Send on WhatsApp
              </a>
            </div>
            <div className="feedback-contact-details">
              <span>Email: masimbajeremiah@gmail.com</span>
              <span>WhatsApp: +971 55 354 9577</span>
            </div>
            <small>Your message opens in your email app or WhatsApp. Review it and tap Send there.</small>
          </section>
        </div>
      )}
    </>
  );
}
