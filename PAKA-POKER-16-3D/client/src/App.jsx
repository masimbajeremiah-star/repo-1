import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { getTestIdentity, saveTestIdentity, registerEmail, loginEmail } from './services/socketService';

export default function App() {
  const [identity, setIdentity] = useState(() => getTestIdentity());
  const [name, setName] = useState(identity?.name || '');
  const [mode, setMode] = useState('guest');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!identity) {
    return (
      <main className="entry-screen">
        <form className="entry-card" onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true); setAuthError('');
          try {
            const result = mode === 'guest' ? await saveTestIdentity(name || 'Guest') : mode === 'register' ? await registerEmail(name, email, password) : await loginEmail(email, password);
            setIdentity(result);
          } catch (error) { setAuthError(error.message || 'Authentication failed'); } finally { setLoading(false); }
        }}>
          <img src="/assets/icons/logo.svg" alt="PAKA Poker 16" />
          <h1>PAKA Poker 16 3D</h1>
          <p>Game-chip accounts only. No real-money payments.</p>
          <div className="auth-tabs">{['guest','login','register'].map((item) => <button className={mode === item ? 'selected' : ''} type="button" key={item} onClick={() => setMode(item)}>{item}</button>)}</div>
          {mode !== 'login' && <><label htmlFor="player-name">Player name</label><input id="player-name" value={name} maxLength={32} autoComplete="nickname" onChange={(event) => setName(event.target.value)} placeholder="Guest" /></>}
          {mode !== 'guest' && <><label htmlFor="email">Email</label><input id="email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /><label htmlFor="password">Password</label><input id="password" type="password" minLength={10} value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(event) => setPassword(event.target.value)} /></>}
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
