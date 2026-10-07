import { Prisma, type ExecutionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { appendExecutionLog } from './execution-queue.js';
import { publishExecutionGitHubStatus } from './github-status.js';
import { recordAudit } from './project-access.js';

type FinalExecutionStatus = Extract<ExecutionStatus, 'PASSED' | 'FAILED' | 'BLOCKED' | 'CANCELLED'>;

export type WebhookExecutionResult = {
  executionCode: string;
  status: FinalExecutionStatus;
  durationMs?: number;
  errorMessage?: string;
};

export async function processWebhookExecutionResult(input: {
  projectId: number;
  webhookId: number;
  actorId: number;
  deliveryId: string;
  payloadHash: string;
  result: WebhookExecutionResult;
}) {
  const execution = await prisma.testExecution.findFirst({
    where: { code: input.result.executionCode, projectId: input.projectId },
    select: { id: true, status: true, pipelineSource: true }
  });
  if (!execution) throw new HttpError(404, 'Execução não encontrada neste projeto.');
  if (!execution.pipelineSource) throw new HttpError(409, 'Esta execução não foi iniciada por um pipeline externo.');

  try {
    await prisma.webhookDelivery.create({
      data: {
        projectId: input.projectId,
        deliveryId: input.deliveryId,
        eventType: 'execution.completed',
        payloadHash: input.payloadHash,
        executionId: execution.id
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { duplicate: true as const, executionId: execution.id, code: input.result.executionCode };
    }
    throw error;
  }

  const finishedAt = new Date();
  const updated = await prisma.testExecution.updateMany({
    where: { id: execution.id, status: { in: ['QUEUED', 'RUNNING'] } },
    data: {
      status: input.result.status,
      progress: 100,
      startedAt: execution.status === 'QUEUED' ? finishedAt : undefined,
      finishedAt,
      durationMs: input.result.durationMs,
      errorMessage: input.result.status === 'PASSED'
        ? null
        : input.result.errorMessage ?? `Pipeline externo informou o estado ${input.result.status}.`
    }
  });
  if (!updated.count) {
    await prisma.webhookDelivery.updateMany({
      where: { projectId: input.projectId, deliveryId: input.deliveryId },
      data: { status: 'REJECTED', processedAt: new Date() }
    });
    throw new HttpError(409, 'A execução já possui um resultado final.');
  }

  await prisma.webhookDelivery.updateMany({
    where: { projectId: input.projectId, deliveryId: input.deliveryId },
    data: { status: 'ACCEPTED', processedAt: new Date() }
  });
  await appendExecutionLog(execution.id, `Resultado ${input.result.status} recebido por webhook assinado.`);
  await prisma.projectWebhook.update({
    where: { id: input.webhookId },
    data: { lastDeliveredAt: finishedAt, lastError: null }
  });
  await recordAudit({
    projectId: input.projectId,
    actorId: input.actorId,
    action: 'WEBHOOK_EXECUTION_COMPLETED',
    entityType: 'TEST_EXECUTION',
    entityId: execution.id,
    details: {
      deliveryId: input.deliveryId,
      executionCode: input.result.executionCode,
      status: input.result.status,
      durationMs: input.result.durationMs ?? null
    }
  });
  await publishExecutionGitHubStatus(execution.id);
  return { duplicate: false as const, executionId: execution.id, code: input.result.executionCode };
}

export async function recordWebhookError(webhookId: number, message: string) {
  await prisma.projectWebhook.update({
    where: { id: webhookId },
    data: { lastError: message.slice(0, 1000) }
  });
}
