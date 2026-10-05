import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { appendExecutionLog, enqueueExecution } from '../services/execution-queue.js';
import { authenticateProjectApiKey } from '../services/project-api-key.js';
import { recordAudit } from '../services/project-access.js';
import { publishExecutionGitHubStatus } from '../services/github-status.js';
import { HttpError } from '../utils/http-error.js';

export const pipelineRouter = Router();

const triggerSchema = z.object({
  scenarioId: z.number().int().positive().optional(),
  scenarioCode: z.string().trim().min(1).optional(),
  environmentId: z.number().int().positive().optional(),
  environmentName: z.string().trim().min(1).optional(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  source: z.string().trim().max(80).optional(),
  commitSha: z.string().trim().regex(/^[a-fA-F0-9]{7,64}$/, 'Informe um SHA de commit válido.').optional()
}).refine((value) => value.scenarioId || value.scenarioCode, {
  message: 'Informe scenarioId ou scenarioCode.'
});

pipelineRouter.post('/executions', async (req, res) => {
  const key = await authenticateProjectApiKey(req.header('x-qa-api-key'));
  const data = triggerSchema.parse(req.body);
  const scenario = await prisma.testScenario.findFirst({
    where: {
      projectId: key.projectId,
      ...(data.scenarioId ? { id: data.scenarioId } : { code: data.scenarioCode })
    },
    select: { id: true, code: true }
  });
  if (!scenario) throw new HttpError(404, 'Cenário não encontrado neste projeto.');

  const environment = await prisma.environment.findFirst({
    where: {
      projectId: key.projectId,
      ...(data.environmentId
        ? { id: data.environmentId }
        : data.environmentName
          ? { name: data.environmentName }
          : { isDefault: true })
    },
    select: { id: true, name: true }
  });
  if (!environment) throw new HttpError(404, 'Ambiente não encontrado neste projeto.');

  const execution = await enqueueExecution({
    scenarioId: scenario.id,
    environmentId: environment.id,
    browser: data.browser,
    createdById: key.createdById
  });
  const source = data.source || 'pipeline externo';
  if (data.commitSha) {
    await prisma.testExecution.update({
      where: { id: execution.id },
      data: { commitSha: data.commitSha, pipelineSource: source }
    });
  }
  await appendExecutionLog(execution.id, `Execução solicitada por ${source} usando a chave ${key.prefix}.`);
  await recordAudit({
    projectId: key.projectId,
    actorId: key.createdById,
    action: 'PIPELINE_EXECUTION_QUEUED',
    entityType: 'TEST_EXECUTION',
    entityId: execution.id,
    details: {
      apiKeyId: key.id,
      apiKeyPrefix: key.prefix,
      scenarioCode: scenario.code,
      environment: environment.name,
      browser: data.browser,
      source,
      commitSha: data.commitSha ?? null
    }
  });
  if (data.commitSha) await publishExecutionGitHubStatus(execution.id);
  res.status(201).json({
    id: execution.id,
    code: execution.code,
    status: execution.status,
    scenarioCode: scenario.code,
    environment: environment.name,
    statusUrl: `/api/pipeline/executions/${execution.code}`
  });
});

pipelineRouter.get('/executions/:code', async (req, res) => {
  const key = await authenticateProjectApiKey(req.header('x-qa-api-key'));
  const code = z.string().trim().min(1).parse(req.params.code);
  const execution = await prisma.testExecution.findFirst({
    where: { code, projectId: key.projectId },
    select: {
      id: true,
      code: true,
      status: true,
      progress: true,
      durationMs: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      scenario: { select: { code: true, title: true } },
      environment: { select: { name: true } }
    }
  });
  if (!execution) throw new HttpError(404, 'Execução não encontrada neste projeto.');
  res.json(execution);
});
