import { describe, expect, it, vi } from 'vitest';
import { buildJiraDescription, sendJiraIssue } from './jira-issues.js';

const description = {
  type: 'doc' as const,
  version: 1 as const,
  content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Falha reproduzível.' }] }]
};

describe('Jira Issues', () => {
  it('cria uma issue pela API v3 com ADF e sem expor o token no corpo', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: '10001', key: 'QA-37', self: 'https://empresa.atlassian.net/rest/api/3/issue/10001' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    }));
    const result = await sendJiraIssue({
      siteUrl: 'https://empresa.atlassian.net',
      email: 'qa@empresa.com',
      token: 'atlassian-secret-token',
      projectKey: 'QA',
      issueType: 'Bug',
      summary: '[BUG-1001] Falha no login',
      description,
      labels: ['qa-truker', 'severity-high']
    }, fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ key: 'QA-37', url: 'https://empresa.atlassian.net/browse/QA-37' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://empresa.atlassian.net/rest/api/3/issue');
    expect(init).toMatchObject({ method: 'POST' });
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('qa@empresa.com:atlassian-secret-token').toString('base64')}`
    });
    const body = JSON.parse(String(init?.body));
    expect(body.fields).toMatchObject({
      project: { key: 'QA' },
      issuetype: { name: 'Bug' },
      description: { type: 'doc', version: 1 }
    });
    expect(String(init?.body)).not.toContain('atlassian-secret-token');
  });

  it('atualiza uma issue existente sem sobrescrever projeto, tipo ou labels', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    const result = await sendJiraIssue({
      siteUrl: 'https://empresa.atlassian.net/',
      email: 'qa@empresa.com',
      token: 'atlassian-secret-token',
      projectKey: 'QA',
      issueType: 'Bug',
      issueKey: 'QA-37',
      summary: 'Resumo atualizado',
      description,
      labels: ['qa-truker']
    }, fetchMock as unknown as typeof fetch);

    expect(result.key).toBe('QA-37');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://empresa.atlassian.net/rest/api/3/issue/QA-37');
    expect(init?.method).toBe('PUT');
    const fields = JSON.parse(String(init?.body)).fields;
    expect(fields.summary).toBe('Resumo atualizado');
    expect(fields).not.toHaveProperty('project');
    expect(fields).not.toHaveProperty('issuetype');
    expect(fields).not.toHaveProperty('labels');
  });

  it('monta a descrição no Atlassian Document Format com rastreabilidade', () => {
    const document = buildJiraDescription({
      id: 1,
      code: 'BUG-1001',
      description: 'O dashboard não foi apresentado.',
      reproduction: '1. Fazer login',
      expectedResult: 'Abrir dashboard',
      actualResult: 'Permaneceu no login',
      severity: 'HIGH',
      priority: 'URGENT',
      environment: 'Homologação',
      browser: 'chromium',
      technicalError: 'Timeout 5000ms',
      evidenceUrl: 'https://qa.example/evidence.png',
      scenario: { code: 'CT-001', title: 'Login válido' },
      execution: { code: 'EXEC-00001', status: 'FAILED' }
    });
    expect(document).toMatchObject({ type: 'doc', version: 1 });
    expect(JSON.stringify(document)).toContain('CT-001 — Login válido');
    expect(JSON.stringify(document)).toContain('Timeout 5000ms');
    expect(JSON.stringify(document)).toContain('https://qa.example/evidence.png');
  });
});
