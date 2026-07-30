import { expect, test } from '@playwright/test';

test.describe('API de autenticação', () => {
  test('retorna token para credenciais válidas', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email: 'admin@qatracker.dev', role: 'ADMIN' });
  });

  test('rejeita credenciais inválidas', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'incorreta' }
    });
    expect(response.status()).toBe(401);
  });
});
