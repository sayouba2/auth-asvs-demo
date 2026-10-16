import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export async function requireSession() {
  const jar = await cookies();
  const response = await fetch((process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001') + '/api/auth/me', {
    headers: { Cookie: jar.toString() },
    cache: 'no-store',
  });
  if (response.status === 401) redirect('/login');
  if (!response.ok) throw new Error('Impossible de vérifier votre session.');
  return response.json() as Promise<{ id: string; email: string; createdAt: string }>;
}
