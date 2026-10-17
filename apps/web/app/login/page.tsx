import { AuthForm } from '../../components/auth-form';
import { AuthShell } from '../../components/auth-shell';
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const notice = params.changed === '1' ? 'Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.'
    : params.requested === '1' ? 'Demande envoyée. Vous recevrez vos identifiants par e-mail après validation.' : undefined;
  return <AuthShell><AuthForm mode="login" notice={notice} /></AuthShell>;
}
