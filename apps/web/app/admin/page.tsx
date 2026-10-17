import { redirect } from 'next/navigation';
import { requireSession } from '../../lib/session';
import { AdminRequests } from '../../components/admin-requests';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const user = await requireSession();
  if (user.role !== 'ADMIN' || user.mustChangePassword) redirect('/welcome');
  return <section className="form-card" aria-labelledby="page-title"><AdminRequests /></section>;
}
