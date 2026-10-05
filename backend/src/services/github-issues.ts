import type { BugStatus } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { decryptSecret } from './secret-crypto.js';

type GitHubIssueState = 'open' | 'closed';

export type GitHubIssueRequest = {
  apiBaseUrl: string;
  owner: string;
  repository: string;
  token: string;
  issueNumber?: number;
  title: string;
  body: string;
  state: GitHubIssueState;
};

export async function sendGitHubIssue(input: GitHubIssueRequest, fetcher: typeof fetch = fetch) {
  const repositoryUrl = `${input.apiBaseUrl.replace(/\/$/, '')}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/issues`;
  const response = await fetcher(input.issueNumber ? `${repositoryUrl}/${input.issueNumber}` : repositoryUrl, {
    method: input.issueNumber ? 'PATCH' : 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'QA-Truker'
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ title: input.title, body: input.body, state: input.state })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub respondeu ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
  return response.json() as Promise<{
    number: number;
    html_url: string;
    state: GitHubIssueState;
    title: string;
  }>;
}

function githubState(status: BugStatus): GitHubIssueState {
  return status === 'RESOLVED' || status === 'CLOSED' ? 'closed' : 'open';
}

export function buildGitHubIssueBody(bug: {
  id: number;
  code: string;
  description: string;
  reproduction: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  severity: string;
  priority: string;
  environment: string | null;
  browser: string | null;
  technicalError: string | null;
  evidenceUrl: string | null;
  scenario: { code: string; title: string } | null;
  execution: { code: string; status: string } | null;
}) {
  const sections = [
    `> Sincronizado automaticamente a partir do [${bug.code}](${config.frontendUrl.replace(/\/$/, '')}/bugs/${bug.id}/editar) no QA Truker.`,
    `## Descrição\n\n${bug.description}`,
    bug.reproduction ? `## Passos para reprodução\n\n${bug.reproduction}` : null,
    bug.expectedResult ? `## Resultado esperado\n\n${bug.expectedResult}` : null,
    bug.actualResult ? `## Resultado obtido\n\n${bug.actualResult}` : null,
    `## Classificação\n\n- Severidade: **${bug.severity}**\n- Prioridade: **${bug.priority}**`,
    bug.environment || bug.browser
      ? `## Ambiente\n\n- Ambiente: ${bug.environment || 'Não informado'}\n- Navegador: ${bug.browser || 'Não informado'}`
      : null,
    bug.scenario ? `## Cenário\n\n${bug.scenario.code} — ${bug.scenario.title}` : null,
    bug.execution ? `## Execução\n\n${bug.execution.code} — ${bug.execution.status}` : null,
    bug.technicalError ? `## Erro técnico\n\n\`\`\`text\n${bug.technicalError}\n\`\`\`` : null,
    bug.evidenceUrl ? `## Evidência\n\n${bug.evidenceUrl}` : null
  ];
  return sections.filter(Boolean).join('\n\n').slice(0, 65_000);
}

export async function syncBugToGitHub(bugId: number) {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    include: {
      project: { include: { github: true } },
      scenario: { select: { code: true, title: true } },
      execution: { select: { code: true, status: true } },
      externalIssues: { where: { provider: 'GITHUB' }, take: 1 }
    }
  });
  if (!bug) throw new HttpError(404, 'Bug não encontrado.');
  if (!bug.projectId) throw new HttpError(409, 'Vincule o bug a um projeto antes de sincronizar.');
  const integration = bug.project?.github;
  if (!integration?.enabled) throw new HttpError(409, 'Configure e ative a integração com GitHub neste projeto.');
  const existing = bug.externalIssues[0];

  try {
    const issue = await sendGitHubIssue({
      apiBaseUrl: config.githubApiUrl,
      owner: integration.repositoryOwner,
      repository: integration.repositoryName,
      token: decryptSecret({
        encrypted: integration.tokenEncrypted,
        iv: integration.tokenIv,
        tag: integration.tokenTag
      }),
      issueNumber: existing ? Number(existing.externalKey) : undefined,
      title: `[${bug.code}] ${bug.title}`,
      body: buildGitHubIssueBody(bug),
      state: githubState(bug.status)
    });
    const externalIssue = await prisma.bugExternalIssue.upsert({
      where: { bugId_provider: { bugId: bug.id, provider: 'GITHUB' } },
      update: {
        externalKey: String(issue.number),
        url: issue.html_url,
        state: issue.state,
        lastSyncedAt: new Date(),
        lastError: null,
        metadata: { repository: `${integration.repositoryOwner}/${integration.repositoryName}` }
      },
      create: {
        bugId: bug.id,
        provider: 'GITHUB',
        externalKey: String(issue.number),
        url: issue.html_url,
        state: issue.state,
        lastSyncedAt: new Date(),
        metadata: { repository: `${integration.repositoryOwner}/${integration.repositoryName}` }
      }
    });
    await prisma.gitHubIntegration.update({ where: { id: integration.id }, data: { lastError: null } });
    return externalIssue;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao sincronizar com GitHub.';
    await prisma.gitHubIntegration.update({ where: { id: integration.id }, data: { lastError: message.slice(0, 1000) } });
    if (existing) {
      await prisma.bugExternalIssue.update({
        where: { id: existing.id },
        data: { lastError: message.slice(0, 1000) }
      });
    }
    throw new HttpError(502, 'Não foi possível sincronizar o bug com o GitHub.', { reason: message });
  }
}
