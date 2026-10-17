import { test, expect, PASSWORD, NEW_PASSWORD, createUser, login } from './helpers';
test('F-01 à F-07 T-03 V6.2.2 T-12 V6.4.1 demande, validation admin, mot de passe initial puis définitif', async ({ page }) => {
  await createUser('admin@example.test', PASSWORD, 'ADMIN');
  await page.goto('/register');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByLabel('Adresse e-mail').fill('browser@example.test');
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page).toHaveURL(/login\?requested=1/);
  await expect(page.getByRole('status')).toContainText('Demande envoyée');
  await login(page, 'admin@example.test', PASSWORD);
  await page.getByRole('link', { name: 'Administration des comptes' }).click();
  await page.getByRole('listitem').filter({ hasText: 'browser@example.test' }).getByRole('button', { name: 'Valider' }).click();
  const href = await page.getByRole('link', { name: 'Envoyer les identifiants' }).getAttribute('href');
  expect(href).toMatch(/^mailto:browser%40example\.test\?subject=/);
  const initial = /Mot de passe initial : ([A-Za-z0-9_-]{24})/.exec(decodeURIComponent(href!))![1];
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/login$/);
  await login(page, 'browser@example.test', initial);
  await expect(page).toHaveURL(/account\/security/);
  await expect(page.getByRole('status')).toContainText('mot de passe définitif');
  await page.goto('/welcome');
  await expect(page).toHaveURL(/account\/security/);
  await page.getByLabel('Mot de passe actuel').fill(initial);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/login\?changed=1/);
  await page.getByLabel('Adresse e-mail').fill('browser@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(initial);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
  await page.getByLabel('Mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue ! Vous êtes authentifié.', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Modifier mon mot de passe' }).click();
  await expect(page).toHaveURL(/account\/security/);
  await page.goto('/welcome');
  const cookies = await page.context().cookies();
  const session = cookies.find(c => c.name === 'session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/login$/);
  await page.context().addCookies(cookies);
  await page.goto('/welcome');
  await expect(page).toHaveURL(/login$/);
});
test('T-05 V6.2.4 liste interdite appliquée au formulaire de changement', async ({ page }) => {
  await createUser('blocklist-browser@example.test', PASSWORD);
  await login(page, 'blocklist-browser@example.test', PASSWORD);
  await expect(page).toHaveURL(/welcome/);
  await page.goto('/account/security');
  await page.getByLabel('Mot de passe actuel').fill(PASSWORD);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('password');
  await page.getByLabel('Confirmer le mot de passe').fill('password');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('trop courant');
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/login\?changed=1/);
});
test('F-04 C-09 pages privées : redirection serveur sans contenu privé', async ({ page, request }) => {
  for (const route of ['/welcome', '/account/security', '/admin']) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect([303, 307]).toContain(response.status());
    expect(response.headers().location).toBe('/login');
    expect(await response.text()).not.toContain('Bienvenue ! Vous êtes authentifié.');
    await page.goto(route); await expect(page).toHaveURL(/login$/);
  }
  expect((await request.get('/api/auth/me')).status()).toBe(401);
});
test('T-10 V6.3.1 le proxy public écrase les adresses forgées', async ({ request }) => {
  for (let i = 0; i < 6; i++) {
    const result = await request.post('/api/auth/login', {
      headers: { Origin: process.env.PUBLIC_ORIGIN!, 'X-Forwarded-For': '192.0.2.' + i, 'X-Demo-Client-IP': '198.51.100.' + i },
      data: { email: 'unknown@example.test', password: 'incorrect' },
    });
    expect(result.status()).toBe(i < 5 ? 401 : 429);
  }
});
test('C-06 CSRF et confirmation du formulaire', async ({ page, request }) => {
  const rejected = await request.post('/api/auth/register', {
    headers: { Origin: 'https://evil.example' }, data: { email: 'csrf@example.test' },
  });
  expect(rejected.status()).toBe(403);
  await createUser('mismatch@example.test', PASSWORD);
  await login(page, 'mismatch@example.test', PASSWORD);
  await expect(page).toHaveURL(/welcome/);
  await page.goto('/account/security');
  await page.getByLabel('Mot de passe actuel').fill(PASSWORD);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('ne correspondent pas');
});
