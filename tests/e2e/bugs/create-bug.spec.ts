import { test, expect } from '../../fixtures/auth.fixture';
import { BugFormPage } from '../../pages/BugFormPage';

test.describe('Cadastro de bugs', () => {
  test('cadastra um bug com os campos obrigatórios', async ({ authenticatedPage: page }) => {
    const title = `Erro automatizado ${Date.now()}`;
    await page.goto('/bugs/novo');
    const form = new BugFormPage(page);
    await form.fillRequired(title, 'A aplicação retorna erro ao concluir o fluxo automatizado.');
    await form.submit();
    await expect(page).toHaveURL(/\/bugs\?/);
    await page.getByLabel('Pesquisar por título').fill(title);
    await expect(page.getByRole('cell', { name: title })).toBeVisible();
  });

  test('valida título obrigatório', async ({ authenticatedPage: page }) => {
    await page.goto('/bugs/novo');
    await page.getByRole('textbox', { name: /^Descrição/ }).fill('Descrição válida para testar a obrigatoriedade do título.');
    await page.getByRole('button', { name: 'Salvar ocorrência' }).click();
    await expect(page.getByRole('textbox', { name: /^Título/ })).toBeFocused();
  });
});
