import type { ExecutionStatus } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { appendExecutionLog } from './execution-queue.js';
import { decryptSecret } from './secret-crypto.js';

export type GitHubCommitState = 'error' | 'failure' | 'pending' | 'success';

export type GitHubStatusRequest = {
  apiBaseUrl: string;
  owner: string;
  repository: string;
  sha: string;
  token: string;
  state: GitHubCommitState;
  description: string;
  context: string;
  targetUrl?: string;
};

export async function sendGitHubCommitStatus(input: GitHubStatusRequest, fetcher: typeof fetch = fetch) {
  const response = await fetcher(
    `${input.apiBaseUrl.replace(/\/$/, '')}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/statuses/${encodeURIComponent(input.sha)}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'QA-Truker'
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        state: input.state,
        description: input.description.slice(0, 140),
        context: input.context,
        target_url: input.targetUrl ?? null
      })
    }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub respondeu ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
  return response.json() as Promise<{ id: number; state: GitHubCommitState; context: string }>;
}

function stateFor(status: ExecutionStatus): GitHubCommitState {
  if (status === 'PASSED') return 'success';
  if (status === 'FAILED') return 'failure';
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'error';
  return 'pending';
}

function descriptionFor(status: ExecutionStatus, code: string) {
  if (status === 'PASSED') return `${code} aprovado pelo QA Truker.`;
  if (status === 'FAILED') return `${code} reprovado pelo QA Truker.`;
  if (status === 'BLOCKED') return `${code} bloqueado.`;
  if (status === 'CANCELLED') return `${code} cancelado.`;
  return `${code} aguardando conclusão.`;
}

export async function publishExecutionGitHubStatus(executionId: number) {
  const execution = await prisma.testExecution.findUnique({
    where: { id: executionId },
    include: {
      scenario: { select: { code: true } },
      project: { include: { github: true } }
    }
  });
  const integration = execution?.project.github;
  if (!execution?.commitSha || !integration?.enabled) return { published: false as const, reason: 'NOT_CONFIGURED' };

  try {
    await sendGitHubCommitStatus({
      apiBaseUrl: config.githubApiUrl,
      owner: integration.repositoryOwner,
      repository: integration.repositoryName,
      sha: execution.commitSha,
      token: decryptSecret({
        encrypted: integration.tokenEncrypted,
        iv: integration.tokenIv,
        tag: integration.tokenTag
      }),
      state: stateFor(execution.status),
      description: descriptionFor(execution.status, execution.code),
      context: `qa-truker/${execution.scenario.code}`,
      targetUrl: `${config.frontendUrl.replace(/\/$/, '')}/execucoes/${execution.id}`
    });
    await prisma.gitHubIntegration.update({
      where: { id: integration.id },
      data: { lastPublishedAt: new Date(), lastError: null }
    });
    await appendExecutionLog(execution.id, `Status ${stateFor(execution.status)} publicado no GitHub.`);
    return { published: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao publicar no GitHub.';
    await prisma.gitHubIntegration.update({
      where: { id: integration.id },
      data: { lastError: message.slice(0, 1000) }
    });
    await appendExecutionLog(execution.id, `Não foi possível publicar o status no GitHub: ${message}`, 'WARN');
    return { published: false as const, reason: 'GITHUB_ERROR', error: message };
  }
}
