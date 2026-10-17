import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '../../lib/session';
import { LogoutButton } from '../../components/logout-button';
export const dynamic = 'force-dynamic';
export default async function Welcome() {
  const user = await requireSession();
  if (user.mustChangePassword) redirect('/account/security');
  return <section className="welcome" aria-labelledby="page-title">
    <h1 id="page-title">Bienvenue ! Vous êtes authentifié.</h1>
    <div className="welcome-actions"><LogoutButton /><Link className="primary" href="/account/security">Modifier mon mot de passe</Link></div>
    {user.role === 'ADMIN' && <p><Link href="/admin">Administration des comptes</Link></p>}
  </section>;
}
