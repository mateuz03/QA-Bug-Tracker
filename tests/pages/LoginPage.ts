import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('E-mail').fill(email);
    await this.page.getByLabel('Senha').fill(password);
    await this.page.getByRole('button', { name: 'Entrar no workspace' }).click();
  }
}
