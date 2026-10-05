import { expect, test } from '@playwright/test';

test.describe('Integração com Jira Cloud', () => {
  test('protege, atualiza e remove a configuração do projeto', async ({ request }) => {
    const suffix = Date.now();
    const login = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    const token = (await login.json()).token;
    const headers = { Authorization: `Bearer ${token}` };
    const project = await (await request.post('/api/projects', {
      headers,
      data: {
        name: `Jira ${suffix}`,
        environments: [{ name: 'Local', baseUrl: 'http://127.0.0.1:5173', isDefault: true }]
      }
    })).json();

    const configureResponse = await request.put(`/api/projects/${project.id}/jira-integration`, {
      headers,
      data: {
        siteUrl: 'https://qa-truker.atlassian.net',
        email: 'qa@example.com',
        projectKey: 'qat',
        issueType: 'Bug',
        token: `jira_api_token_${String(suffix).padEnd(24, '0')}`,
        enabled: true
      }
    });
    expect(configureResponse.status()).toBe(200);
    expect(await configureResponse.json()).toMatchObject({
      siteUrl: 'https://qa-truker.atlassian.net',
      email: 'qa@example.com',
      jiraProjectKey: 'QAT',
      issueType: 'Bug',
      enabled: true
    });

    const detailResponse = await request.get(`/api/projects/${project.id}/jira-integration`, { headers });
    const detail = await detailResponse.json();
    expect(detail).not.toHaveProperty('tokenEncrypted');
    expect(detail).not.toHaveProperty('tokenIv');
    expect(detail).not.toHaveProperty('tokenTag');

    const pauseResponse = await request.put(`/api/projects/${project.id}/jira-integration`, {
      headers,
      data: {
        siteUrl: 'https://qa-truker.atlassian.net/',
        email: 'qa@example.com',
        projectKey: 'QAT',
        issueType: 'Defect',
        enabled: false
      }
    });
    expect(pauseResponse.status()).toBe(200);
    expect(await pauseResponse.json()).toMatchObject({ issueType: 'Defect', enabled: false });

    const audit = await (await request.get(`/api/projects/${project.id}/audit`, { headers })).json();
    expect(audit.some((item: { action: string }) => item.action === 'JIRA_INTEGRATION_CREATED')).toBe(true);
    expect(audit.some((item: { action: string }) => item.action === 'JIRA_INTEGRATION_UPDATED')).toBe(true);

    expect((await request.delete(`/api/projects/${project.id}/jira-integration`, { headers })).status()).toBe(204);
    expect(await (await request.get(`/api/projects/${project.id}/jira-integration`, { headers })).json()).toBeNull();
  });
});
