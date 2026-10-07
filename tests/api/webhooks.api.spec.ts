import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

function signature(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(timestamp).update('.').update(body).digest('hex')}`;
}

test.describe('Webhooks assinados', () => {
  test('aceita um resultado assinado, atualiza a execução e ignora repetição', async ({ request }) => {
    const suffix = Date.now();
    const login = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    const token = (await login.json()).token;
    const headers = { Authorization: `Bearer ${token}` };
    const project = await (await request.post('/api/projects', {
      headers,
      data: {
        name: `Webhook ${suffix}`,
        environments: [{ name: 'CI', baseUrl: 'http://127.0.0.1:5173', isDefault: true }]
      }
    })).json();
    const scenario = await (await request.post('/api/scenarios', {
      headers,
      data: {
        title: `Resultado externo ${suffix}`,
        priority: 'HIGH',
        type: 'SMOKE',
        status: 'ACTIVE',
        automated: true,
        projectId: project.id,
        steps: [{ action: 'NAVIGATE', description: 'Abrir aplicação', value: '/' }]
      }
    })).json();
    const apiKey = await (await request.post(`/api/projects/${project.id}/api-keys`, {
      headers,
      data: { name: 'Webhook pipeline' }
    })).json();
    const execution = await (await request.post('/api/pipeline/executions', {
      headers: { 'x-qa-api-key': apiKey.token },
      data: { scenarioCode: scenario.code, environmentName: 'CI', source: 'Pipeline remoto' }
    })).json();
    const webhook = await (await request.put(`/api/projects/${project.id}/webhook`, {
      headers,
      data: { enabled: true }
    })).json();
    expect(webhook.secret).toMatch(/^qwh_/);

    const body = JSON.stringify({
      event: 'execution.completed',
      executionCode: execution.code,
      status: 'PASSED',
      durationMs: 1400
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const webhookHeaders = {
      'content-type': 'application/json',
      'x-qa-delivery': `delivery-${suffix}`,
      'x-qa-timestamp': timestamp,
      'x-qa-signature-256': signature(webhook.secret, timestamp, body)
    };
    const delivered = await request.post(`/api/webhooks/projects/${project.id}/pipeline`, { headers: webhookHeaders, data: body });
    expect(delivered.status(), await delivered.text()).toBe(202);
    expect(await delivered.json()).toMatchObject({ accepted: true, duplicate: false, executionCode: execution.code });

    const status = await request.get(`/api/pipeline/executions/${execution.code}`, { headers: { 'x-qa-api-key': apiKey.token } });
    expect(await status.json()).toMatchObject({ status: 'PASSED', progress: 100, durationMs: 1400 });

    const repeated = await request.post(`/api/webhooks/projects/${project.id}/pipeline`, { headers: webhookHeaders, data: body });
    expect(repeated.status()).toBe(200);
    expect(await repeated.json()).toMatchObject({ accepted: true, duplicate: true });

    const invalid = await request.post(`/api/webhooks/projects/${project.id}/pipeline`, {
      headers: { ...webhookHeaders, 'x-qa-delivery': `invalid-${suffix}`, 'x-qa-signature-256': 'sha256=invalid' },
      data: body
    });
    expect(invalid.status()).toBe(401);
  });
});
