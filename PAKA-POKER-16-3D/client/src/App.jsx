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
          <h1>PAKA Poker 16 3D</h1>
          <p>Play freely as a guest or account holder. Optional M-PESA deposits never restrict gameplay.</p>
          <div className="auth-tabs">{['guest','login','register'].map((item) => <button className={mode === item ? 'selected' : ''} disabled={loading} type="button" key={item} onClick={() => { setMode(item); setAuthError(''); }}>{item}</button>)}</div>
          {mode !== 'login' && <><label htmlFor="player-name">Player name</label><input id="player-name" value={name} maxLength={32} autoComplete="nickname" onChange={(event) => setName(event.target.value)} placeholder="Guest" /></>}
          {mode !== 'guest' && <><label htmlFor="email">Email</label><input id="email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /><label htmlFor="password">Password</label><input id="password" type="password" minLength={mode === 'register' ? 10 : undefined} required value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(event) => setPassword(event.target.value)} /></>}
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button disabled={loading} type="submit">{loading ? 'CONNECTING…' : mode === 'guest' ? 'ENTER AS GUEST' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</button>
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
