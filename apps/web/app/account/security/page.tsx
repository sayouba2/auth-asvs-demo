import { requireSession } from '../../../lib/session';
import { AuthForm } from '../../../components/auth-form';
import { AuthShell } from '../../../components/auth-shell';
export const dynamic = 'force-dynamic';
export default async function Security() {
  await requireSession();
  return <AuthShell><AuthForm mode="change" /></AuthShell>;
}
