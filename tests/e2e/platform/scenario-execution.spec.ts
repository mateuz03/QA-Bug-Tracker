import { expect, test } from '../../fixtures/auth.fixture';

test.describe('Ciclo de automação', () => {
  test('executa um cenário Playwright e exibe o resultado por passo', async ({ authenticatedPage: page }) => {
    test.setTimeout(90_000);
    await page.goto('/cenarios');
    await page.getByRole('link', { name: 'Login com usuário válido' }).click();
    await expect(page.getByRole('heading', { name: 'Login com usuário válido' })).toBeVisible();

    await page.getByRole('button', { name: 'Executar agora' }).click();

    await expect(page).toHaveURL(/\/execucoes\/\d+$/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Execução aprovada' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Resultado por passo' })).toBeVisible();
    await expect(page.locator('.execution-steps .step-passed')).toHaveCount(5);
    await expect(page.locator('.evidence-card')).toHaveCount(4);
  });
});
