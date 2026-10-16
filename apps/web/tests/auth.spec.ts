import { test, expect, PASSWORD, NEW_PASSWORD } from './helpers';
test('F-01 à F-07 T-03 V6.2.2 parcours complet et reconnexion après changement', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Adresse e-mail').fill('browser@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/login\?registered=1/);
  await expect(page.getByRole('status')).toContainText('Votre compte est créé');
  await page.getByLabel('Adresse e-mail').fill('browser@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue ! Vous êtes authentifié.', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Modifier mon mot de passe' }).click();
  await expect(page).toHaveURL(/account\/security/);
  await page.getByLabel('Mot de passe actuel').fill(PASSWORD);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/login\?changed=1/);
  await page.getByLabel('Adresse e-mail').fill('browser@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
  await page.getByLabel('Mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/welcome/);
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
test('T-05 V6.2.4 liste interdite appliquée aux formulaires inscription et changement', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Adresse e-mail').fill('blocklist-browser@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('password');
  await page.getByLabel('Confirmer le mot de passe').fill('password');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('alert')).toContainText('trop courant');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Adresse e-mail').fill('blocklist-browser@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/welcome/);
  await page.goto('/account/security');
  await page.getByLabel('Mot de passe actuel').fill(PASSWORD);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('password');
  await page.getByLabel('Confirmer le mot de passe').fill('password');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toContainText('trop courant');
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(/login\?changed=1/);
});
test('F-04 C-09 pages privées : redirection serveur sans contenu privé', async ({ page, request }) => {
  for (const route of ['/welcome', '/account/security']) {
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
    headers: { Origin: 'https://evil.example' }, data: { email: 'csrf@example.test', password: PASSWORD },
  });
  expect(rejected.status()).toBe(403);
  await page.goto('/register');
  await page.getByLabel('Adresse e-mail').fill('mismatch@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('alert')).toContainText('ne correspondent pas');
});
