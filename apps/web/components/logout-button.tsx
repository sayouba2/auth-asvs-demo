'use client';
import { useState } from 'react';
export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (response.ok || response.status === 401) window.location.assign('/login');
      else setError('Déconnexion impossible. Veuillez réessayer.');
    } catch { setError('Service indisponible. Veuillez réessayer.'); }
    finally { setLoading(false); }
  }
  return <><button className="secondary" onClick={logout} disabled={loading}>
    {loading ? 'Déconnexion…' : 'Se déconnecter'}</button>{error && <p role="alert" className="error">{error}</p>}</>;
}
