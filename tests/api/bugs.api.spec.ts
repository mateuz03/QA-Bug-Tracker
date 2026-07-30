import { expect, test } from '@playwright/test';

test.describe('API de bugs', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    token = (await response.json()).token;
  });

  test('exige autenticação na listagem', async ({ request }) => {
    const response = await request.get('/api/bugs');
    expect(response.status()).toBe(401);
  });

  test('cria, consulta, altera status e exclui um bug', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const created = await request.post('/api/bugs', {
      headers,
      data: {
        title: `Falha de API ${Date.now()}`,
        description: 'Falha criada pela suíte de contrato da API.',
        severity: 'HIGH',
        priority: 'HIGH'
      }
    });
    expect(created.status()).toBe(201);
    const bug = await created.json();
    expect(bug).toMatchObject({ severity: 'HIGH', status: 'OPEN' });

    const detail = await request.get(`/api/bugs/${bug.id}`, { headers });
    expect(detail.status()).toBe(200);
    expect((await detail.json()).code).toBe(bug.code);

    const updated = await request.patch(`/api/bugs/${bug.id}/status`, {
      headers,
      data: { status: 'IN_PROGRESS' }
    });
    expect(updated.status()).toBe(200);
    expect((await updated.json()).status).toBe('IN_PROGRESS');

    const removed = await request.delete(`/api/bugs/${bug.id}`, { headers });
    expect(removed.status()).toBe(204);
  });

  test('valida payload obrigatório', async ({ request }) => {
    const response = await request.post('/api/bugs', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '', description: '' }
    });
    expect(response.status()).toBe(400);
  });
});
