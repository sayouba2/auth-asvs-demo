'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Request = { id: string; email: string };
type Approved = { email: string; initialPassword: string; expiresAt: string };
// Pas de serveur d'e-mail : le lien ouvre la messagerie de l'administrateur avec le message prérempli.
function mailto(account: Approved) {
  const body = 'Bonjour,\n\nVotre demande de compte a été validée.\n\nIdentifiant : ' + account.email +
    '\nMot de passe initial : ' + account.initialPassword +
    '\n\nCe mot de passe ne fonctionne qu\'une seule fois, jusqu\'au ' + new Date(account.expiresAt).toLocaleString('fr-FR') +
    '. À la première connexion, vous devrez choisir votre propre mot de passe : ' + window.location.origin + '/login';
  return 'mailto:' + encodeURIComponent(account.email) + '?subject=' + encodeURIComponent('Vos identifiants de connexion') +
    '&body=' + encodeURIComponent(body);
}
export function AdminRequests() {
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [approved, setApproved] = useState<Approved[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/admin/requests', { credentials: 'same-origin' })
      .then(async response => { if (!response.ok) throw new Error(); setRequests(await response.json() as Request[]); })
      .catch(() => setError('Impossible de charger les demandes.'));
  }, []);
  async function approve(id: string) {
    setError('');
    const response = await fetch('/api/admin/requests/' + id + '/approve', { method: 'POST', credentials: 'same-origin' })
      .catch(() => null);
    if (!response?.ok) { setError('Validation impossible. Réessayez.'); return; }
    const account = await response.json() as Approved;
    setApproved(list => [...list, account]);
    setRequests(list => list?.filter(r => r.id !== id) ?? null);
  }
  return <>
    <h1 id="page-title">Demandes de compte</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {approved.map(account => <div className="notice" role="status" key={account.email}>
      <p>Compte créé pour {account.email}.</p>
      <a className="primary" href={mailto(account)}>Envoyer les identifiants</a>
    </div>)}
    {requests === null ? !error && <p>Chargement…</p>
      : requests.length === 0 ? <p>Aucune demande en attente.</p>
        : <ul className="requests">{requests.map(r => <li key={r.id}>
          <span>{r.email}</span>
          <button className="secondary" type="button" onClick={() => void approve(r.id)}>Valider</button>
        </li>)}</ul>}
    <div className="form-bottom"><Link href="/welcome">Retour</Link></div>
  </>;
}
