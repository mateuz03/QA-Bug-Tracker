import { describe, expect, it, vi } from 'vitest';
import { buildGitHubIssueBody, sendGitHubIssue } from './github-issues.js';

describe('GitHub Issues', () => {
  it('cria uma issue usando o contrato oficial e sem incluir o token no corpo', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      number: 37,
      html_url: 'https://github.com/mateuz03/QA-Bug-Tracker/issues/37',
      state: 'open',
      title: '[BUG-1001] Falha no login'
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

    await sendGitHubIssue({
      apiBaseUrl: 'https://api.github.test',
      owner: 'mateuz03',
      repository: 'QA-Bug-Tracker',
      token: 'github-secret-token',
      title: '[BUG-1001] Falha no login',
      body: 'Detalhes rastreáveis do defeito.',
      state: 'open'
    }, fetchMock as unknown as typeof fetch);

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(url).toBe('https://api.github.test/repos/mateuz03/QA-Bug-Tracker/issues');
    expect(init).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer github-secret-token', 'X-GitHub-Api-Version': '2026-03-10' } });
    expect(String(init!.body)).not.toContain('github-secret-token');
  });

  it('atualiza e fecha uma issue já vinculada', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      number: 37,
      html_url: 'https://github.test/issues/37',
      state: 'closed',
      title: 'Resolvido'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await sendGitHubIssue({
      apiBaseUrl: 'https://api.github.test',
      owner: 'mateuz03',
      repository: 'QA-Bug-Tracker',
      token: 'github-secret-token',
      issueNumber: 37,
      title: 'Resolvido',
      body: 'Bug corrigido.',
      state: 'closed'
    }, fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.github.test/repos/mateuz03/QA-Bug-Tracker/issues/37');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toMatchObject({ state: 'closed' });
  });

  it('monta uma descrição com rastreabilidade e evidências', () => {
    const body = buildGitHubIssueBody({
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
    expect(body).toContain('BUG-1001');
    expect(body).toContain('CT-001 — Login válido');
    expect(body).toContain('EXEC-00001 — FAILED');
    expect(body).toContain('Timeout 5000ms');
    expect(body).toContain('https://qa.example/evidence.png');
  });
});
