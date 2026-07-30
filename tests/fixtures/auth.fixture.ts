import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

export const test = base.extend<{ authenticatedPage: import('@playwright/test').Page }>({
  authenticatedPage: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login('admin@qatracker.dev', 'Qa@123456');
    await page.waitForURL('**/dashboard');
    await use(page);
  }
});

export { expect } from '@playwright/test';
