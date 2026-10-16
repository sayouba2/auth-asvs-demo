'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PasswordField } from './password-field';
type Mode = 'login' | 'register' | 'change';
const copy = {
  login: { title: 'Connexion', button: 'Se connecter' },
  register: { title: 'Inscription', button: 'Créer mon compte' },
  change: { title: 'Modifier mon mot de passe', button: 'Enregistrer' },
};
export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const content = copy[mode];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get(mode === 'change' ? 'newPassword' : 'password') ?? '');
    if (mode !== 'login') {
      if ([...password].length < 8 || [...password].length > 128) {
        setError('Choisissez un mot de passe de 8 à 128 caractères.'); return;
      }
      if (password !== form.get('confirmation')) {
        setError('Les deux mots de passe ne correspondent pas.'); return;
      }
    }
    setLoading(true);
    try {
      const body = mode === 'change'
        ? { currentPassword: form.get('currentPassword'), newPassword: password }
        : { email: form.get('email'), password };
      const response = await fetch('/api/auth/' + (mode === 'change' ? 'change-password' : mode), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { message?: string };
        const retry = response.headers.get('Retry-After');
        setError(response.status === 429
          ? 'Trop de tentatives. Réessayez dans ' + (retry ?? 'quelques') + ' secondes.'
          : result.message ?? 'Impossible de terminer cette opération. Réessayez.');
        return;
      }
      // Full navigation discards the previous React cache after session mutations.
      window.location.assign(mode === 'login' ? '/welcome' : '/login?' + (mode === 'register' ? 'registered=1' : 'changed=1'));
    } catch { setError('Le service est indisponible. Veuillez réessayer.'); }
    finally { setLoading(false); }
  }
  return <>
    <h1 id="page-title">{content.title}</h1>
    {notice && <p className="notice" role="status">{notice}</p>}
    <form onSubmit={submit} aria-busy={loading}>
      {mode !== 'change' && <div className="field">
        <label htmlFor="email">Adresse e-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
          placeholder="vous@exemple.fr" autoCapitalize="none" spellCheck={false} />
      </div>}
      {mode === 'change' && <PasswordField id="currentPassword" label="Mot de passe actuel" autoComplete="current-password" />}
      <PasswordField id={mode === 'change' ? 'newPassword' : 'password'}
        label={mode === 'change' ? 'Nouveau mot de passe' : 'Mot de passe'}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        describedBy={mode === 'login' ? undefined : 'password-help'} />
      {mode !== 'login' && <>
        <p id="password-help" className="hint">8 caractères minimum. <strong>15 caractères ou plus sont recommandés.</strong></p>
        <PasswordField id="confirmation" label="Confirmer le mot de passe" autoComplete="new-password" />
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={loading}>{loading ? 'Veuillez patienter…' : content.button}</button>
    </form>
    <div className="form-bottom">{mode === 'login'
      ? <Link href="/register">Créer un compte</Link>
      : mode === 'register' ? <Link href="/login">Se connecter</Link>
        : <Link href="/welcome">Retour</Link>}</div>
  </>;
}
