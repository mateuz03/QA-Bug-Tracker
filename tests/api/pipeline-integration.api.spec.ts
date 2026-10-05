import { expect, test } from '@playwright/test';

test.describe('Integração com pipelines', () => {
  test('cria uma chave, dispara uma execução, consulta o status e revoga o acesso', async ({ request }) => {
    const suffix = Date.now();
    const login = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    const token = (await login.json()).token;
    const headers = { Authorization: `Bearer ${token}` };

    const projectResponse = await request.post('/api/projects', {
      headers,
      data: {
        name: `Pipeline ${suffix}`,
        description: 'Projeto isolado para validar o disparo externo.',
        environments: [{ name: 'CI', baseUrl: 'http://127.0.0.1:5173', isDefault: true }]
      }
    });
    expect(projectResponse.status()).toBe(201);
    const project = await projectResponse.json();

    const scenarioResponse = await request.post('/api/scenarios', {
      headers,
      data: {
        title: `Smoke do pipeline ${suffix}`,
        priority: 'HIGH',
        type: 'SMOKE',
        status: 'ACTIVE',
        automated: true,
        projectId: project.id,
        steps: [{ action: 'NAVIGATE', description: 'Abrir a aplicação', value: '/' }]
      }
    });
    expect(scenarioResponse.status()).toBe(201);
    const scenario = await scenarioResponse.json();

    const keyResponse = await request.post(`/api/projects/${project.id}/api-keys`, {
      headers,
      data: { name: 'GitHub Actions · main' }
    });
    expect(keyResponse.status()).toBe(201);
    const apiKey = await keyResponse.json();
    expect(apiKey.token).toMatch(/^qtk_/);
    expect(apiKey.prefix).toBe(apiKey.token.slice(0, 12));

    const keyListResponse = await request.get(`/api/projects/${project.id}/api-keys`, { headers });
    expect(keyListResponse.status()).toBe(200);
    const keyList = await keyListResponse.json();
    expect(keyList[0]).not.toHaveProperty('token');
    expect(keyList[0]).not.toHaveProperty('keyHash');

    const pipelineHeaders = { 'x-qa-api-key': apiKey.token };
    const triggerResponse = await request.post('/api/pipeline/executions', {
      headers: pipelineHeaders,
      data: {
        scenarioCode: scenario.code,
        environmentName: 'CI',
        browser: 'chromium',
        source: 'GitHub Actions',
        commitSha: '0123456789abcdef'
      }
    });
    expect(triggerResponse.status()).toBe(201);
    const triggered = await triggerResponse.json();
    expect(triggered).toMatchObject({ status: 'QUEUED', scenarioCode: scenario.code, environment: 'CI' });

    const statusResponse = await request.get(`/api/pipeline/executions/${triggered.code}`, {
      headers: pipelineHeaders
    });
    expect(statusResponse.status()).toBe(200);
    expect(await statusResponse.json()).toMatchObject({ code: triggered.code, scenario: { code: scenario.code } });

    const audit = await (await request.get(`/api/projects/${project.id}/audit`, { headers })).json();
    expect(audit.some((item: { action: string; details?: { commitSha?: string } }) =>
      item.action === 'PIPELINE_EXECUTION_QUEUED' && item.details?.commitSha === '0123456789abcdef'
    )).toBe(true);

    await request.post(`/api/executions/${triggered.id}/cancel`, { headers });
    const revokeResponse = await request.delete(`/api/projects/${project.id}/api-keys/${apiKey.id}`, { headers });
    expect(revokeResponse.status()).toBe(204);

    const deniedResponse = await request.get(`/api/pipeline/executions/${triggered.code}`, {
      headers: pipelineHeaders
    });
    expect(deniedResponse.status()).toBe(401);
  });

  test('protege e mantém a configuração de status do GitHub', async ({ request }) => {
    const suffix = Date.now();
    const login = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    const token = (await login.json()).token;
    const headers = { Authorization: `Bearer ${token}` };
    const project = await (await request.post('/api/projects', {
      headers,
      data: {
        name: `GitHub status ${suffix}`,
        environments: [{ name: 'Local', baseUrl: 'http://127.0.0.1:5173', isDefault: true }]
      }
    })).json();

    const configureResponse = await request.put(`/api/projects/${project.id}/github-integration`, {
      headers,
      data: {
        repository: 'mateuz03/QA-Bug-Tracker',
        token: `github_pat_${String(suffix).padEnd(30, '0')}`,
        enabled: true
      }
    });
    expect(configureResponse.status()).toBe(200);
    expect(await configureResponse.json()).toMatchObject({
      repositoryOwner: 'mateuz03',
      repositoryName: 'QA-Bug-Tracker',
      enabled: true
    });

    const detailResponse = await request.get(`/api/projects/${project.id}/github-integration`, { headers });
    const detail = await detailResponse.json();
    expect(detail).not.toHaveProperty('tokenEncrypted');
    expect(detail).not.toHaveProperty('tokenIv');
    expect(detail).not.toHaveProperty('tokenTag');

    const pauseResponse = await request.put(`/api/projects/${project.id}/github-integration`, {
      headers,
      data: { repository: 'mateuz03/QA-Bug-Tracker', enabled: false }
    });
    expect(pauseResponse.status()).toBe(200);
    expect((await pauseResponse.json()).enabled).toBe(false);

    const audit = await (await request.get(`/api/projects/${project.id}/audit`, { headers })).json();
    expect(audit.some((item: { action: string }) => item.action === 'GITHUB_INTEGRATION_CREATED')).toBe(true);
    expect(audit.some((item: { action: string }) => item.action === 'GITHUB_INTEGRATION_UPDATED')).toBe(true);

    expect((await request.delete(`/api/projects/${project.id}/github-integration`, { headers })).status()).toBe(204);
    expect(await (await request.get(`/api/projects/${project.id}/github-integration`, { headers })).json()).toBeNull();
  });
});
