import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { decryptSecret } from './secret-crypto.js';

type AdfText = { type: 'text'; text: string; marks?: { type: 'link'; attrs: { href: string } }[] };
type AdfBlock = {
  type: 'heading' | 'paragraph' | 'codeBlock';
  attrs?: { level?: number; language?: string };
  content: AdfText[];
};

export type JiraDocument = {
  type: 'doc';
  version: 1;
  content: AdfBlock[];
};

export type JiraIssueRequest = {
  siteUrl: string;
  email: string;
  token: string;
  projectKey: string;
  issueType: string;
  issueKey?: string;
  summary: string;
  description: JiraDocument;
  labels: string[];
};

export async function sendJiraIssue(input: JiraIssueRequest, fetcher: typeof fetch = fetch) {
  const siteUrl = input.siteUrl.replace(/\/$/, '');
  const endpoint = `${siteUrl}/rest/api/3/issue${input.issueKey ? `/${encodeURIComponent(input.issueKey)}` : ''}`;
  const fields = {
    summary: input.summary,
    description: input.description,
    ...(!input.issueKey ? {
      project: { key: input.projectKey },
      issuetype: { name: input.issueType },
      labels: input.labels
    } : {})
  };
  const response = await fetcher(endpoint, {
    method: input.issueKey ? 'PUT' : 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${input.email}:${input.token}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'QA-Truker'
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ fields })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Jira respondeu ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
  if (input.issueKey) return { key: input.issueKey, url: `${siteUrl}/browse/${encodeURIComponent(input.issueKey)}` };
  const created = await response.json() as { key: string };
  if (!created.key) throw new Error('Jira não retornou a chave da issue criada.');
  return { key: created.key, url: `${siteUrl}/browse/${encodeURIComponent(created.key)}` };
}

function text(value: string, href?: string): AdfText {
  return { type: 'text', text: value.slice(0, 20_000), ...(href ? { marks: [{ type: 'link', attrs: { href } }] } : {}) };
}

function heading(value: string): AdfBlock {
  return { type: 'heading', attrs: { level: 2 }, content: [text(value)] };
}

function paragraph(value: string, href?: string): AdfBlock {
  return { type: 'paragraph', content: [text(value, href)] };
}

export function buildJiraDescription(bug: {
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
}): JiraDocument {
  const bugUrl = `${config.frontendUrl.replace(/\/$/, '')}/bugs/${bug.id}/editar`;
  const content: AdfBlock[] = [
    paragraph(`Sincronizado a partir do ${bug.code} no QA Truker`, bugUrl),
    heading('Descrição'),
    paragraph(bug.description)
  ];
  const section = (title: string, value?: string | null) => {
    if (!value) return;
    content.push(heading(title), paragraph(value));
  };
  section('Passos para reprodução', bug.reproduction);
  section('Resultado esperado', bug.expectedResult);
  section('Resultado obtido', bug.actualResult);
  section('Classificação', `Severidade: ${bug.severity} | Prioridade: ${bug.priority}`);
  section('Ambiente', [bug.environment, bug.browser].filter(Boolean).join(' | '));
  section('Cenário', bug.scenario ? `${bug.scenario.code} — ${bug.scenario.title}` : null);
  section('Execução', bug.execution ? `${bug.execution.code} — ${bug.execution.status}` : null);
  if (bug.technicalError) {
    content.push(heading('Erro técnico'), {
      type: 'codeBlock',
      attrs: { language: 'text' },
      content: [text(bug.technicalError)]
    });
  }
  if (bug.evidenceUrl) content.push(heading('Evidência'), paragraph(bug.evidenceUrl, bug.evidenceUrl));
  return { type: 'doc', version: 1, content };
}

export async function syncBugToJira(bugId: number) {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    include: {
      project: { include: { jira: true } },
      scenario: { select: { code: true, title: true } },
      execution: { select: { code: true, status: true } },
      externalIssues: { where: { provider: 'JIRA' }, take: 1 }
    }
  });
  if (!bug) throw new HttpError(404, 'Bug não encontrado.');
  if (!bug.projectId) throw new HttpError(409, 'Vincule o bug a um projeto antes de sincronizar.');
  const integration = bug.project?.jira;
  if (!integration?.enabled) throw new HttpError(409, 'Configure e ative a integração com Jira neste projeto.');
  const existing = bug.externalIssues[0];

  try {
    const issue = await sendJiraIssue({
      siteUrl: integration.siteUrl,
      email: integration.email,
      token: decryptSecret({
        encrypted: integration.tokenEncrypted,
        iv: integration.tokenIv,
        tag: integration.tokenTag
      }),
      projectKey: integration.jiraProjectKey,
      issueType: integration.issueType,
      issueKey: existing?.externalKey,
      summary: `[${bug.code}] ${bug.title}`,
      description: buildJiraDescription(bug),
      labels: ['qa-truker', `severity-${bug.severity.toLowerCase()}`]
    });
    const syncedAt = new Date();
    const externalIssue = await prisma.bugExternalIssue.upsert({
      where: { bugId_provider: { bugId: bug.id, provider: 'JIRA' } },
      update: {
        externalKey: issue.key,
        url: issue.url,
        state: 'synchronized',
        lastSyncedAt: syncedAt,
        lastError: null,
        metadata: { projectKey: integration.jiraProjectKey, issueType: integration.issueType, localBugStatus: bug.status }
      },
      create: {
        bugId: bug.id,
        provider: 'JIRA',
        externalKey: issue.key,
        url: issue.url,
        state: 'synchronized',
        lastSyncedAt: syncedAt,
        metadata: { projectKey: integration.jiraProjectKey, issueType: integration.issueType, localBugStatus: bug.status }
      }
    });
    await prisma.jiraIntegration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: syncedAt, lastError: null }
    });
    return externalIssue;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao sincronizar com Jira.';
    await prisma.jiraIntegration.update({
      where: { id: integration.id },
      data: { lastError: message.slice(0, 1000) }
    });
    if (existing) {
      await prisma.bugExternalIssue.update({
        where: { id: existing.id },
        data: { lastError: message.slice(0, 1000) }
      });
    }
    throw new HttpError(502, 'Não foi possível sincronizar o bug com o Jira.', { reason: message });
  }
}
