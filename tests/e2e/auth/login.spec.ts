import { expect, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Autenticação', () => {
  test('realiza login com dados válidos', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login('admin@qatracker.dev', 'Qa@123456');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  });

  test('bloqueia login com senha inválida', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login('admin@qatracker.dev', 'senha-invalida');
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('impede acesso a página privada sem autenticação', async ({ page }) => {
    await page.goto('/bugs');
    await expect(page).toHaveURL(/\/login$/);
  });
});
