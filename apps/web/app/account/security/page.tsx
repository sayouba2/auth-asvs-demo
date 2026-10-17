import { requireSession } from '../../../lib/session';
import { AuthForm } from '../../../components/auth-form';
import { AuthShell } from '../../../components/auth-shell';
export const dynamic = 'force-dynamic';
export default async function Security() {
  const user = await requireSession();
  const notice = user.mustChangePassword
    ? 'Choisissez votre mot de passe définitif. Le mot de passe reçu par e-mail ne fonctionne qu\'une seule fois.' : undefined;
  return <AuthShell><AuthForm mode="change" notice={notice} /></AuthShell>;
}
