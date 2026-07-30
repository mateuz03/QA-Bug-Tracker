import { Priority, Severity } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { deleteEvidenceFile, saveManualEvidence } from '../services/execution-artifacts.js';
import { appendExecutionLog, enqueueExecution } from '../services/execution-queue.js';
import {
  createExecutionCsv,
  createExecutionPdf,
  executionReportInclude
} from '../services/execution-reports.js';
import { HttpError } from '../utils/http-error.js';

export const executionsRouter = Router();
executionsRouter.use(authenticate);

executionsRouter.get('/', async (req, res) => {
  const projectId = z.coerce.number().int().positive().optional().parse(req.query.projectId);
  const executions = await prisma.testExecution.findMany({
    where: projectId ? { projectId } : {},
    include: {
      scenario: { select: { id: true, code: true, title: true } },
      project: { select: { id: true, code: true, name: true } },
      environment: { select: { id: true, name: true, baseUrl: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { bugs: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(executions);
});

executionsRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const execution = await prisma.testExecution.findUnique({
    where: { id },
    include: {
      scenario: { include: { requirement: true } },
      project: true,
      environment: true,
      createdBy: { select: { id: true, name: true, email: true } },
      steps: { orderBy: { order: 'asc' } },
      logs: { orderBy: { createdAt: 'asc' } },
      evidences: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' }
      },
      retryOf: { select: { id: true, code: true, status: true } },
      retries: { select: { id: true, code: true, status: true }, orderBy: { createdAt: 'desc' } },
      bugs: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!execution) throw new HttpError(404, 'Execução não encontrada.');
  res.json(execution);
});

const executeSchema = z.object({
  scenarioId: z.number().int().positive(),
  environmentId: z.number().int().positive(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium')
});

executionsRouter.post('/', async (req, res) => {
  const data = executeSchema.parse(req.body);
  const execution = await enqueueExecution({ ...data, createdById: req.user!.id });
  res.status(201).json(execution);
});

executionsRouter.post('/:id/cancel', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const execution = await prisma.testExecution.findUnique({ where: { id } });
  if (!execution) throw new HttpError(404, 'Execução não encontrada.');
  if (!['QUEUED', 'RUNNING'].includes(execution.status)) {
    throw new HttpError(409, 'Esta execução já foi finalizada.');
  }

  const cancelled = await prisma.testExecution.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelRequestedAt: new Date(),
      ...(execution.status === 'QUEUED' ? { finishedAt: new Date(), progress: 0 } : {})
    }
  });
  if (execution.status === 'QUEUED') {
    await prisma.executionStep.updateMany({
      where: { executionId: id, status: 'PENDING' },
      data: { status: 'SKIPPED', finishedAt: new Date() }
    });
    await appendExecutionLog(id, 'Execução removida da fila pelo usuário.', 'WARN');
  } else {
    await appendExecutionLog(id, 'Cancelamento solicitado pelo usuário.', 'WARN');
  }
  res.json(cancelled);
});

executionsRouter.post('/:id/retry', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const source = await prisma.testExecution.findUnique({ where: { id } });
  if (!source) throw new HttpError(404, 'Execução não encontrada.');
  if (['QUEUED', 'RUNNING'].includes(source.status)) {
    throw new HttpError(409, 'A execução atual ainda não foi finalizada.');
  }

  const execution = await enqueueExecution({
    scenarioId: source.scenarioId,
    environmentId: source.environmentId,
    browser: source.browser,
    createdById: req.user!.id,
    retryOfId: source.id
  });
  res.status(201).json(execution);
});

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});
const allowedEvidenceTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
  'application/zip'
]);

executionsRouter.post('/:id/evidences', evidenceUpload.single('file'), async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const description = z.string().trim().max(500).optional().parse(req.body.description || undefined);
  const execution = await prisma.testExecution.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!execution) throw new HttpError(404, 'Execução não encontrada.');
  if (!req.file) throw new HttpError(400, 'Selecione um arquivo para anexar.');
  if (!allowedEvidenceTypes.has(req.file.mimetype)) {
    throw new HttpError(415, 'Formato não permitido. Use imagem, PDF, TXT, JSON ou ZIP.');
  }

  const evidence = await saveManualEvidence({
    executionId: execution.id,
    executionCode: execution.code,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    buffer: req.file.buffer,
    description,
    uploadedById: req.user!.id
  });
  await appendExecutionLog(id, `Evidência manual adicionada: ${evidence.name}.`);
  res.status(201).json(evidence);
});

executionsRouter.delete('/:id/evidences/:evidenceId', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const evidenceId = z.coerce.number().int().positive().parse(req.params.evidenceId);
  const evidence = await prisma.executionEvidence.findFirst({
    where: { id: evidenceId, executionId: id }
  });
  if (!evidence) throw new HttpError(404, 'Evidência não encontrada.');

  await deleteEvidenceFile(evidence.path);
  await prisma.executionEvidence.delete({ where: { id: evidence.id } });
  await appendExecutionLog(id, `Evidência removida: ${evidence.name}.`, 'WARN');
  res.status(204).end();
});

const retentionSchema = z.object({
  retentionDays: z.number().int().min(1).max(365)
});

executionsRouter.patch('/:id/retention', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { retentionDays } = retentionSchema.parse(req.body);
  const execution = await prisma.testExecution.update({
    where: { id },
    data: { retentionUntil: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000) }
  });
  await appendExecutionLog(id, `Retenção de evidências alterada para ${retentionDays} dia(s).`);
  res.json(execution);
});

executionsRouter.get('/:id/report.csv', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const execution = await prisma.testExecution.findUnique({
    where: { id },
    include: executionReportInclude
  });
  if (!execution) throw new HttpError(404, 'Execução não encontrada.');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${execution.code.toLowerCase()}.csv"`);
  res.send(createExecutionCsv(execution));
});

executionsRouter.get('/:id/report.pdf', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const execution = await prisma.testExecution.findUnique({
    where: { id },
    include: executionReportInclude
  });
  if (!execution) throw new HttpError(404, 'Execução não encontrada.');
  const pdf = await createExecutionPdf(execution);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${execution.code.toLowerCase()}.pdf"`);
  res.send(pdf);
});

const bugFromExecutionSchema = z.object({
  title: z.string().trim().min(5).max(140).optional(),
  severity: z.nativeEnum(Severity).default(Severity.HIGH),
  priority: z.nativeEnum(Priority).default(Priority.HIGH),
  assigneeId: z.number().int().positive().optional().nullable()
});

executionsRouter.post('/:id/bugs', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = bugFromExecutionSchema.parse(req.body);
  const execution = await prisma.testExecution.findUnique({
    where: { id },
    include: { scenario: { include: { steps: { orderBy: { order: 'asc' } } } }, environment: true }
  });
  if (!execution) throw new HttpError(404, 'Execução não encontrada.');
  if (execution.status !== 'FAILED') throw new HttpError(409, 'Somente execuções com falha podem gerar bugs.');

  const failedStep = await prisma.executionStep.findFirst({
    where: { executionId: execution.id, status: 'FAILED' },
    orderBy: { order: 'asc' }
  });
  const latest = await prisma.bug.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const bug = await prisma.bug.create({
    data: {
      code: `BUG-${1001 + (latest?.id ?? 0)}`,
      title: data.title ?? `Falha em ${execution.scenario.title}`,
      description: `Falha identificada automaticamente durante ${execution.code}.`,
      reproduction: execution.scenario.steps.map((step) => `${step.order}. ${step.description}`).join('\n'),
      expectedResult: failedStep?.description ?? 'O cenário deveria ser concluído com sucesso.',
      actualResult: execution.errorMessage ?? 'A execução foi finalizada com falha.',
      technicalError: failedStep?.error ?? execution.errorMessage,
      severity: data.severity,
      priority: data.priority,
      environment: execution.environment.name,
      browser: execution.browser,
      status: 'OPEN',
      evidenceUrl: execution.screenshotPath,
      assigneeId: data.assigneeId,
      reporterId: req.user!.id,
      projectId: execution.projectId,
      scenarioId: execution.scenarioId,
      executionId: execution.id
    },
    include: { scenario: true, execution: true, project: true }
  });
  res.status(201).json(bug);
});
