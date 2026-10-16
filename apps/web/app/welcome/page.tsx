import Link from 'next/link';
import { requireSession } from '../../lib/session';
import { LogoutButton } from '../../components/logout-button';
export const dynamic = 'force-dynamic';
export default async function Welcome() {
  await requireSession();
  return <section className="welcome" aria-labelledby="page-title">
    <h1 id="page-title">Bienvenue ! Vous êtes authentifié.</h1>
    <div className="welcome-actions"><LogoutButton /><Link className="primary" href="/account/security">Modifier mon mot de passe</Link></div>
  </section>;
}
