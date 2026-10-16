import { test, expect, PASSWORD } from './helpers';
test('T-02 V6.2.1 T-07 V6.2.6 T-08 V6.2.7 recommandation, champs masqués, autocomplete et collage effectif', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const route of ['/login', '/register']) {
    await page.goto(route);
    const fields = page.locator('input[type="password"]');
    expect(await fields.count()).toBe(route === '/login' ? 1 : 2);
    for (const field of await fields.all()) {
      await expect(field).toHaveAttribute('autocomplete', route === '/login' ? 'current-password' : 'new-password');
      await page.evaluate(value => navigator.clipboard.writeText(value), PASSWORD);
      await field.focus();
      await page.keyboard.press('ControlOrMeta+V');
      await expect(field).toHaveValue(PASSWORD);
    }
    await expect(page.getByLabel('Adresse e-mail')).toHaveAttribute('autocomplete', 'username');
    await testInfo.attach(route.slice(1), { body: await page.screenshot(), contentType: 'image/png' });
  }
  await expect(page.getByText('15 caractères ou plus sont recommandés.')).toBeVisible();
  await page.getByLabel('Adresse e-mail').fill('fields@example.test');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Adresse e-mail').fill('fields@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/welcome/);
  await page.goto('/account/security');
  const fields = page.locator('input[type="password"]');
  await expect(fields).toHaveCount(3);
  for (const field of await fields.all()) {
    const name = await field.getAttribute('name');
    await expect(field).toHaveAttribute('autocomplete', name === 'currentPassword' ? 'current-password' : 'new-password');
    await page.evaluate(value => navigator.clipboard.writeText(value), PASSWORD);
    await field.focus(); await page.keyboard.press('ControlOrMeta+V'); await expect(field).toHaveValue(PASSWORD);
  }
  await expect(page.getByText('15 caractères ou plus sont recommandés.')).toBeVisible();
  await testInfo.attach('account-security', { body: await page.screenshot(), contentType: 'image/png' });
});
test('T-07 T-08 affichage mobile et navigation au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/register');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByLabel('Adresse e-mail').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Confirmer le mot de passe')).toBeFocused();
});
