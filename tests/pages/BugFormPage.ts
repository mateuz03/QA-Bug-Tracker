import type { Page } from '@playwright/test';

export class BugFormPage {
  constructor(private readonly page: Page) {}

  async fillRequired(title: string, description: string) {
    await this.page.getByRole('textbox', { name: /^Título/ }).fill(title);
    await this.page.getByRole('textbox', { name: /^Descrição/ }).fill(description);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Salvar ocorrência' }).click();
  }
}
