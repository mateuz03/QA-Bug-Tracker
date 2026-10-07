import { ProjectRole, ProjectStatus, RequirementStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { accessibleProjectsWhere, recordAudit, requireProjectRole } from '../services/project-access.js';
import { createProjectApiKeyValue } from '../services/project-api-key.js';
import { encryptSecret } from '../services/secret-crypto.js';
import { createWebhookSecret } from '../services/webhook-signing.js';
import { HttpError } from '../utils/http-error.js';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: accessibleProjectsWhere(req.user!),
    include: {
      owner: { select: { id: true, name: true, email: true } },
      environments: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] },
      _count: { select: { requirements: true, scenarios: true, executions: true, bugs: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const result = await Promise.all(projects.map(async (project) => {
    const [passed, finished] = await Promise.all([
      prisma.testExecution.count({ where: { projectId: project.id, status: 'PASSED' } }),
      prisma.testExecution.count({ where: { projectId: project.id, status: { in: ['PASSED', 'FAILED', 'BLOCKED'] } } })
    ]);
    return {
      ...project,
      passRate: finished ? Math.round((passed / finished) * 100) : null
    };
  }));

  res.json(result);
});

projectsRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const currentUserRole = await requireProjectRole(req.user!, id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }]
      },
      environments: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] },
      requirements: {
        include: { _count: { select: { scenarios: true } } },
        orderBy: { code: 'asc' }
      },
      scenarios: {
        include: {
          requirement: { select: { id: true, code: true, title: true } },
          _count: { select: { steps: true, executions: true, bugs: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 8
      },
      executions: {
        include: { scenario: { select: { code: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      _count: { select: { requirements: true, scenarios: true, executions: true, bugs: true } }
    }
  });
  if (!project) throw new HttpError(404, 'Projeto não encontrado.');
  res.json({ ...project, currentUserRole });
});

const environmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  baseUrl: z.string().trim().url(),
  isDefault: z.boolean().optional()
});

const createProjectSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  repositoryUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
  ownerId: z.number().int().positive().optional(),
  environments: z.array(environmentSchema).min(1)
});

projectsRouter.post('/', authorize(Role.ADMIN), async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  const ownerId = data.ownerId ?? req.user!.id;
  const created = await prisma.project.create({
    data: {
      code: `PRJ-TEMP-${randomUUID()}`,
      name: data.name,
      description: data.description,
      repositoryUrl: data.repositoryUrl || null,
      status: data.status,
      ownerId,
      environments: { create: data.environments },
      members: { create: { userId: ownerId, role: ProjectRole.OWNER } }
    },
    include: { environments: true, owner: { select: { id: true, name: true, email: true } } }
  });
  const project = await prisma.project.update({
    where: { id: created.id },
    data: { code: `PRJ-${String(created.id).padStart(3, '0')}` },
    include: { environments: true, owner: { select: { id: true, name: true, email: true } } }
  });
  await recordAudit({
    projectId: project.id,
    actorId: req.user!.id,
    action: 'PROJECT_CREATED',
    entityType: 'PROJECT',
    entityId: project.id,
    details: { name: project.name, ownerId }
  });
  res.status(201).json(project);
});

const requirementSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(5000),
  status: z.nativeEnum(RequirementStatus).default(RequirementStatus.READY)
});

projectsRouter.post('/:id/requirements', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const data = requirementSchema.parse(req.body);
  await requireProjectRole(req.user!, projectId, ProjectRole.MANAGER);
  const latest = await prisma.requirement.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const code = `REQ-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`;
  const requirement = await prisma.requirement.create({ data: { ...data, code, projectId } });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'REQUIREMENT_CREATED',
    entityType: 'REQUIREMENT',
    entityId: requirement.id,
    details: { code: requirement.code, title: requirement.title }
  });
  res.status(201).json(requirement);
});

const memberSchema = z.object({ role: z.enum([ProjectRole.MANAGER, ProjectRole.VIEWER]) });

projectsRouter.get('/:id/members', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId);
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }]
  });
  res.json(members);
});

projectsRouter.put('/:id/members/:userId', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const userId = z.coerce.number().int().positive().parse(req.params.userId);
  const { role } = memberSchema.parse(req.body);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);

  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, active: true } })
  ]);
  if (!user?.active) throw new HttpError(404, 'Usuário ativo não encontrado.');
  if (project?.ownerId === userId) throw new HttpError(409, 'O papel do proprietário não pode ser alterado.');

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { role },
    create: { projectId, userId, role },
    include: { user: { select: { id: true, name: true, email: true, role: true } } }
  });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'PROJECT_MEMBER_UPSERTED',
    entityType: 'PROJECT_MEMBER',
    entityId: userId,
    details: { userName: user.name, role }
  });
  res.json(member);
});

projectsRouter.delete('/:id/members/:userId', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const userId = z.coerce.number().int().positive().parse(req.params.userId);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
  if (project?.ownerId === userId) throw new HttpError(409, 'O proprietário não pode ser removido do projeto.');
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { user: { select: { name: true } } }
  });
  if (!member) throw new HttpError(404, 'Membro não encontrado.');
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'PROJECT_MEMBER_REMOVED',
    entityType: 'PROJECT_MEMBER',
    entityId: userId,
    details: { userName: member.user.name, previousRole: member.role }
  });
  res.status(204).send();
});

projectsRouter.get('/:id/audit', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.MANAGER);
  const logs = await prisma.auditLog.findMany({
    where: { projectId },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(logs);
});

projectsRouter.get('/:id/api-keys', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const keys = await prisma.projectApiKey.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(keys);
});

const apiKeySchema = z.object({
  name: z.string().trim().min(3).max(80),
  expiresAt: z.coerce.date().optional().nullable()
});

projectsRouter.post('/:id/api-keys', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const data = apiKeySchema.parse(req.body);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  if (data.expiresAt && data.expiresAt <= new Date()) {
    throw new HttpError(400, 'A expiração deve estar no futuro.');
  }
  const generated = createProjectApiKeyValue();
  const key = await prisma.projectApiKey.create({
    data: {
      name: data.name,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      projectId,
      createdById: req.user!.id,
      expiresAt: data.expiresAt
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'PROJECT_API_KEY_CREATED',
    entityType: 'PROJECT_API_KEY',
    entityId: key.id,
    details: { name: key.name, prefix: key.prefix, expiresAt: key.expiresAt?.toISOString() ?? null }
  });
  res.status(201).json({ ...key, token: generated.token });
});

projectsRouter.delete('/:id/api-keys/:keyId', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const keyId = z.coerce.number().int().positive().parse(req.params.keyId);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const key = await prisma.projectApiKey.findFirst({ where: { id: keyId, projectId } });
  if (!key) throw new HttpError(404, 'Chave de integração não encontrada.');
  if (!key.revokedAt) {
    await prisma.projectApiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
    await recordAudit({
      projectId,
      actorId: req.user!.id,
      action: 'PROJECT_API_KEY_REVOKED',
      entityType: 'PROJECT_API_KEY',
      entityId: key.id,
      details: { name: key.name, prefix: key.prefix }
    });
  }
  res.status(204).send();
});

projectsRouter.get('/:id/github-integration', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const integration = await prisma.gitHubIntegration.findUnique({
    where: { projectId },
    select: {
      id: true,
      repositoryOwner: true,
      repositoryName: true,
      enabled: true,
      lastPublishedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
  res.json(integration);
});

const githubIntegrationSchema = z.object({
  repository: z.string().trim().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use o formato proprietario/repositorio.'),
  token: z.string().trim().min(20).max(500).optional(),
  enabled: z.boolean().default(true)
});

projectsRouter.put('/:id/github-integration', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const data = githubIntegrationSchema.parse(req.body);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const existing = await prisma.gitHubIntegration.findUnique({ where: { projectId } });
  if (!existing && !data.token) throw new HttpError(400, 'Informe um token do GitHub para ativar a integração.');
  const [repositoryOwner, repositoryName] = data.repository.split('/');
  if (!repositoryOwner || !repositoryName) throw new HttpError(400, 'Use o formato proprietario/repositorio.');
  const encrypted = data.token ? encryptSecret(data.token) : null;
  const integration = existing
    ? await prisma.gitHubIntegration.update({
      where: { id: existing.id },
      data: {
        repositoryOwner,
        repositoryName,
        enabled: data.enabled,
        lastError: null,
        ...(encrypted ? {
          tokenEncrypted: encrypted.encrypted,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag
        } : {})
      }
    })
    : await prisma.gitHubIntegration.create({
      data: {
        projectId,
        repositoryOwner,
        repositoryName,
        enabled: data.enabled,
        createdById: req.user!.id,
        tokenEncrypted: encrypted!.encrypted,
        tokenIv: encrypted!.iv,
        tokenTag: encrypted!.tag
      }
    });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: existing ? 'GITHUB_INTEGRATION_UPDATED' : 'GITHUB_INTEGRATION_CREATED',
    entityType: 'GITHUB_INTEGRATION',
    entityId: integration.id,
    details: { repository: `${repositoryOwner}/${repositoryName}`, enabled: integration.enabled, tokenRotated: Boolean(data.token) }
  });
  res.json({
    id: integration.id,
    repositoryOwner: integration.repositoryOwner,
    repositoryName: integration.repositoryName,
    enabled: integration.enabled,
    lastPublishedAt: integration.lastPublishedAt,
    lastError: integration.lastError,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt
  });
});

projectsRouter.delete('/:id/github-integration', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const integration = await prisma.gitHubIntegration.findUnique({ where: { projectId } });
  if (!integration) throw new HttpError(404, 'Integração com GitHub não encontrada.');
  await prisma.gitHubIntegration.delete({ where: { id: integration.id } });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'GITHUB_INTEGRATION_REMOVED',
    entityType: 'GITHUB_INTEGRATION',
    entityId: integration.id,
    details: { repository: `${integration.repositoryOwner}/${integration.repositoryName}` }
  });
  res.status(204).send();
});

projectsRouter.get('/:id/jira-integration', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const integration = await prisma.jiraIntegration.findUnique({
    where: { projectId },
    select: {
      id: true,
      siteUrl: true,
      email: true,
      jiraProjectKey: true,
      issueType: true,
      enabled: true,
      lastSyncedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
  res.json(integration);
});

const jiraSiteUrl = z.string().trim().url('Informe uma URL válida do Jira Cloud.').refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:'
    && url.hostname.endsWith('.atlassian.net')
    && !url.username
    && !url.password
    && !url.port
    && (url.pathname === '/' || url.pathname === '')
    && !url.search
    && !url.hash;
}, 'Use a URL HTTPS raiz do Jira Cloud, como https://empresa.atlassian.net.').transform((value) => value.replace(/\/$/, ''));

const jiraIntegrationSchema = z.object({
  siteUrl: jiraSiteUrl,
  email: z.string().trim().email('Informe o e-mail da conta Atlassian.'),
  projectKey: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]{1,19}$/, 'Informe uma chave de projeto válida.').transform((value) => value.toUpperCase()),
  issueType: z.string().trim().min(2).max(80).default('Bug'),
  token: z.string().trim().min(20).max(1000).optional(),
  enabled: z.boolean().default(true)
});

projectsRouter.put('/:id/jira-integration', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const data = jiraIntegrationSchema.parse(req.body);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const existing = await prisma.jiraIntegration.findUnique({ where: { projectId } });
  if (!existing && !data.token) throw new HttpError(400, 'Informe um API token do Jira para ativar a integração.');
  const encrypted = data.token ? encryptSecret(data.token) : null;
  const integration = existing
    ? await prisma.jiraIntegration.update({
      where: { id: existing.id },
      data: {
        siteUrl: data.siteUrl,
        email: data.email,
        jiraProjectKey: data.projectKey,
        issueType: data.issueType,
        enabled: data.enabled,
        lastError: null,
        ...(encrypted ? {
          tokenEncrypted: encrypted.encrypted,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag
        } : {})
      }
    })
    : await prisma.jiraIntegration.create({
      data: {
        projectId,
        siteUrl: data.siteUrl,
        email: data.email,
        jiraProjectKey: data.projectKey,
        issueType: data.issueType,
        enabled: data.enabled,
        createdById: req.user!.id,
        tokenEncrypted: encrypted!.encrypted,
        tokenIv: encrypted!.iv,
        tokenTag: encrypted!.tag
      }
    });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: existing ? 'JIRA_INTEGRATION_UPDATED' : 'JIRA_INTEGRATION_CREATED',
    entityType: 'JIRA_INTEGRATION',
    entityId: integration.id,
    details: {
      siteUrl: integration.siteUrl,
      projectKey: integration.jiraProjectKey,
      issueType: integration.issueType,
      enabled: integration.enabled,
      tokenRotated: Boolean(data.token)
    }
  });
  res.json({
    id: integration.id,
    siteUrl: integration.siteUrl,
    email: integration.email,
    jiraProjectKey: integration.jiraProjectKey,
    issueType: integration.issueType,
    enabled: integration.enabled,
    lastSyncedAt: integration.lastSyncedAt,
    lastError: integration.lastError,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt
  });
});

projectsRouter.delete('/:id/jira-integration', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const integration = await prisma.jiraIntegration.findUnique({ where: { projectId } });
  if (!integration) throw new HttpError(404, 'Integração com Jira não encontrada.');
  await prisma.jiraIntegration.delete({ where: { id: integration.id } });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'JIRA_INTEGRATION_REMOVED',
    entityType: 'JIRA_INTEGRATION',
    entityId: integration.id,
    details: { siteUrl: integration.siteUrl, projectKey: integration.jiraProjectKey }
  });
  res.status(204).send();
});

projectsRouter.get('/:id/webhook', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const webhook = await prisma.projectWebhook.findUnique({
    where: { projectId },
    select: {
      id: true,
      enabled: true,
      lastDeliveredAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } }
    }
  });
  res.json(webhook);
});

const webhookSchema = z.object({
  enabled: z.boolean().default(true),
  rotateSecret: z.boolean().default(false)
});

projectsRouter.put('/:id/webhook', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const data = webhookSchema.parse(req.body);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const existing = await prisma.projectWebhook.findUnique({ where: { projectId } });
  const secret = !existing || data.rotateSecret ? createWebhookSecret() : null;
  const encrypted = secret ? encryptSecret(secret) : null;
  const webhook = existing
    ? await prisma.projectWebhook.update({
      where: { id: existing.id },
      data: {
        enabled: data.enabled,
        lastError: null,
        ...(encrypted ? {
          secretEncrypted: encrypted.encrypted,
          secretIv: encrypted.iv,
          secretTag: encrypted.tag
        } : {})
      }
    })
    : await prisma.projectWebhook.create({
      data: {
        projectId,
        enabled: data.enabled,
        createdById: req.user!.id,
        secretEncrypted: encrypted!.encrypted,
        secretIv: encrypted!.iv,
        secretTag: encrypted!.tag
      }
    });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: existing ? (secret ? 'PROJECT_WEBHOOK_SECRET_ROTATED' : 'PROJECT_WEBHOOK_UPDATED') : 'PROJECT_WEBHOOK_CREATED',
    entityType: 'PROJECT_WEBHOOK',
    entityId: webhook.id,
    details: { enabled: webhook.enabled, secretRotated: Boolean(secret) }
  });
  res.json({
    id: webhook.id,
    enabled: webhook.enabled,
    lastDeliveredAt: webhook.lastDeliveredAt,
    lastError: webhook.lastError,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
    ...(secret ? { secret } : {})
  });
});

projectsRouter.delete('/:id/webhook', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  await requireProjectRole(req.user!, projectId, ProjectRole.OWNER);
  const webhook = await prisma.projectWebhook.findUnique({ where: { projectId } });
  if (!webhook) throw new HttpError(404, 'Webhook do projeto não encontrado.');
  await prisma.projectWebhook.delete({ where: { id: webhook.id } });
  await recordAudit({
    projectId,
    actorId: req.user!.id,
    action: 'PROJECT_WEBHOOK_REMOVED',
    entityType: 'PROJECT_WEBHOOK',
    entityId: webhook.id,
    details: {}
  });
  res.status(204).send();
});
