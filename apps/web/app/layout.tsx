import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Accès · Démonstrateur d’authentification',
  description: 'Un espace simple pour créer votre compte et gérer votre accès.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>
    <main id="main">{children}</main>
  </body></html>;
}
