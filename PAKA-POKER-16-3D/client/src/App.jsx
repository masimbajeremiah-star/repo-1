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
      </main>
    );
  }
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage identity={identity} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
