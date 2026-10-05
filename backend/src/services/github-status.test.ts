import { describe, expect, it, vi } from 'vitest';
import { sendGitHubCommitStatus } from './github-status.js';

describe('sendGitHubCommitStatus', () => {
  it('envia o contrato oficial de commit status sem expor o token no corpo', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: 42, state: 'success', context: 'qa-truker/CT-001' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    }));

    await sendGitHubCommitStatus({
      apiBaseUrl: 'https://api.github.test/',
      owner: 'mateuz03',
      repository: 'QA-Bug-Tracker',
      sha: '0123456789abcdef',
      token: 'github-secret-token',
      state: 'success',
      description: 'Execução aprovada.',
      context: 'qa-truker/CT-001',
      targetUrl: 'https://qa.example/execucoes/42'
    }, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call!;
    expect(init).toBeDefined();
    expect(url).toBe('https://api.github.test/repos/mateuz03/QA-Bug-Tracker/statuses/0123456789abcdef');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer github-secret-token',
        'X-GitHub-Api-Version': '2026-03-10'
      }
    });
    expect(JSON.parse(String(init!.body))).toEqual({
      state: 'success',
      description: 'Execução aprovada.',
      context: 'qa-truker/CT-001',
      target_url: 'https://qa.example/execucoes/42'
    });
    expect(String(init!.body)).not.toContain('github-secret-token');
  });

  it('transforma uma resposta rejeitada do GitHub em erro controlado', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"message":"Bad credentials"}', { status: 401 }));
    await expect(sendGitHubCommitStatus({
      apiBaseUrl: 'https://api.github.test',
      owner: 'mateuz03',
      repository: 'QA-Bug-Tracker',
      sha: '0123456',
      token: 'invalid-token',
      state: 'pending',
      description: 'Aguardando.',
      context: 'qa-truker/CT-001'
    }, fetchMock as unknown as typeof fetch)).rejects.toThrow('GitHub respondeu 401');
  });
});
