import { randomUUID } from 'node:crypto';
import type { ExecutionLogLevel, ExecutionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

const activeStatuses: ExecutionStatus[] = ['QUEUED', 'RUNNING'];

export async function appendExecutionLog(
  executionId: number,
  message: string,
  level: ExecutionLogLevel = 'INFO',
  stepOrder?: number
) {
  return prisma.executionLog.create({
    data: { executionId, message, level, stepOrder }
  });
}

export async function enqueueExecution(input: {
  scenarioId: number;
  environmentId: number;
  browser: string;
  createdById: number;
  retryOfId?: number;
  cycleId?: number;
}) {
  const scenario = await prisma.testScenario.findUnique({
    where: { id: input.scenarioId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  const environment = await prisma.environment.findUnique({ where: { id: input.environmentId } });

  if (!scenario || !environment || environment.projectId !== scenario.projectId) {
    throw new HttpError(400, 'Cenário ou ambiente inválido.');
  }
  if (scenario.status !== 'ACTIVE') {
    throw new HttpError(409, 'Somente cenários ativos podem ser executados.');
  }

  const active = await prisma.testExecution.findFirst({
    where: {
      scenarioId: scenario.id,
      environmentId: environment.id,
      browser: input.browser,
      status: { in: activeStatuses }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (active) {
    throw new HttpError(
      409,
      `${active.code} já está ${active.status === 'QUEUED' ? 'na fila' : 'em execução'}.`,
      { executionId: active.id, code: active.code, status: active.status }
    );
  }

  const execution = await prisma.testExecution.create({
    data: {
      code: `QUEUE-${randomUUID()}`,
      status: 'QUEUED',
      browser: input.browser,
      timeoutMs: scenario.timeoutMs,
      screenshotMode: scenario.screenshotMode,
      captureVideo: scenario.captureVideo,
      captureTrace: scenario.captureTrace,
      captureConsole: scenario.captureConsole,
      captureNetwork: scenario.captureNetwork,
      retentionUntil: new Date(Date.now() + scenario.retentionDays * 24 * 60 * 60 * 1000),
      scenarioId: scenario.id,
      environmentId: environment.id,
      projectId: scenario.projectId,
      createdById: input.createdById,
      retryOfId: input.retryOfId,
      cycleId: input.cycleId,
      steps: {
        create: scenario.steps.map((step) => ({
          order: step.order,
          description: step.description,
          action: step.action,
          expected: step.expected ?? step.value,
          status: 'PENDING'
        }))
      }
    }
  });

  const queued = await prisma.testExecution.update({
    where: { id: execution.id },
    data: { code: `EXEC-${String(execution.id).padStart(5, '0')}` },
    include: {
      scenario: true,
      environment: true,
      project: true,
      steps: { orderBy: { order: 'asc' } },
      logs: { orderBy: { createdAt: 'asc' } }
    }
  });
  await appendExecutionLog(queued.id, 'Execução adicionada à fila.');
  return queued;
}

export async function claimNextExecution() {
  const next = await prisma.testExecution.findFirst({
    where: { status: 'QUEUED' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true }
  });
  if (!next) return null;

  const claimed = await prisma.testExecution.updateMany({
    where: { id: next.id, status: 'QUEUED' },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      heartbeatAt: new Date(),
      errorMessage: null
    }
  });
  if (claimed.count === 0) return null;

  await appendExecutionLog(next.id, 'Worker iniciou a execução.');
  return next.id;
}

export async function recoverInterruptedExecutions() {
  const staleBefore = new Date(Date.now() - 30_000);
  const interrupted = await prisma.testExecution.findMany({
    where: {
      status: 'RUNNING',
      OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: staleBefore } }]
    },
    select: { id: true, code: true }
  });

  for (const execution of interrupted) {
    await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        status: 'QUEUED',
        startedAt: null,
        heartbeatAt: null,
        currentStep: null,
        errorMessage: null
      }
    });
    await appendExecutionLog(execution.id, 'Execução recuperada após interrupção do worker.', 'WARN');
  }
  return interrupted.length;
}
