import { Priority, ScenarioStatus, ScenarioType, ScreenshotMode, StepAction } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';

export const scenariosRouter = Router();
scenariosRouter.use(authenticate);

const listSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  status: z.nativeEnum(ScenarioStatus).optional(),
  type: z.nativeEnum(ScenarioType).optional()
});

scenariosRouter.get('/', async (req, res) => {
  const query = listSchema.parse(req.query);
  const scenarios = await prisma.testScenario.findMany({
    where: {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {})
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
      requirement: { select: { id: true, code: true, title: true } },
      executions: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { steps: true, executions: true, bugs: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(scenarios);
});

scenariosRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const scenario = await prisma.testScenario.findUnique({
    where: { id },
    include: {
      project: { include: { environments: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] } } },
      requirement: true,
      steps: { orderBy: { order: 'asc' } },
      executions: {
        include: { environment: true, createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      bugs: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!scenario) throw new HttpError(404, 'Cenário não encontrado.');
  res.json(scenario);
});

const stepSchema = z.object({
  action: z.nativeEnum(StepAction),
  description: z.string().trim().min(3).max(300),
  target: z.string().trim().max(1000).optional().nullable(),
  value: z.string().trim().max(3000).optional().nullable(),
  expected: z.string().trim().max(3000).optional().nullable(),
  timeoutMs: z.number().int().min(1000).max(300000).optional().nullable()
});

const scenarioSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  preconditions: z.string().trim().max(2000).optional().nullable(),
  priority: z.nativeEnum(Priority),
  type: z.nativeEnum(ScenarioType),
  status: z.nativeEnum(ScenarioStatus).default(ScenarioStatus.ACTIVE),
  automated: z.boolean().default(false),
  timeoutMs: z.number().int().min(5000).max(900000).default(60000),
  screenshotMode: z.nativeEnum(ScreenshotMode).default(ScreenshotMode.FAILURE),
  captureVideo: z.boolean().default(true),
  captureTrace: z.boolean().default(true),
  captureConsole: z.boolean().default(true),
  captureNetwork: z.boolean().default(true),
  retentionDays: z.number().int().min(1).max(365).default(30),
  projectId: z.number().int().positive(),
  requirementId: z.number().int().positive().optional().nullable(),
  steps: z.array(stepSchema).min(1, 'Inclua ao menos um passo.')
});

scenariosRouter.post('/', async (req, res) => {
  const data = scenarioSchema.parse(req.body);
  const latest = await prisma.testScenario.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const code = `CT-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`;
  const scenario = await prisma.testScenario.create({
    data: {
      code,
      title: data.title,
      description: data.description,
      preconditions: data.preconditions,
      priority: data.priority,
      type: data.type,
      status: data.status,
      automated: data.automated,
      timeoutMs: data.timeoutMs,
      screenshotMode: data.screenshotMode,
      captureVideo: data.captureVideo,
      captureTrace: data.captureTrace,
      captureConsole: data.captureConsole,
      captureNetwork: data.captureNetwork,
      retentionDays: data.retentionDays,
      projectId: data.projectId,
      requirementId: data.requirementId,
      steps: {
        create: data.steps.map((step, index) => ({ ...step, order: index + 1 }))
      }
    },
    include: { steps: { orderBy: { order: 'asc' } }, project: true, requirement: true }
  });
  res.status(201).json(scenario);
});

scenariosRouter.put('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = scenarioSchema.parse(req.body);
  const scenario = await prisma.$transaction(async (tx) => {
    await tx.scenarioStep.deleteMany({ where: { scenarioId: id } });
    return tx.testScenario.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        preconditions: data.preconditions,
        priority: data.priority,
        type: data.type,
        status: data.status,
        automated: data.automated,
        timeoutMs: data.timeoutMs,
        screenshotMode: data.screenshotMode,
        captureVideo: data.captureVideo,
        captureTrace: data.captureTrace,
        captureConsole: data.captureConsole,
        captureNetwork: data.captureNetwork,
        retentionDays: data.retentionDays,
        projectId: data.projectId,
        requirementId: data.requirementId,
        steps: { create: data.steps.map((step, index) => ({ ...step, order: index + 1 })) }
      },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
  });
  res.json(scenario);
});

scenariosRouter.post('/:id/duplicate', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const source = await prisma.testScenario.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  if (!source) throw new HttpError(404, 'Cenário não encontrado.');
  const latest = await prisma.testScenario.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const duplicate = await prisma.testScenario.create({
    data: {
      code: `CT-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`,
      title: `${source.title} — cópia`,
      description: source.description,
      preconditions: source.preconditions,
      priority: source.priority,
      type: source.type,
      status: ScenarioStatus.DRAFT,
      automated: source.automated,
      timeoutMs: source.timeoutMs,
      screenshotMode: source.screenshotMode,
      captureVideo: source.captureVideo,
      captureTrace: source.captureTrace,
      captureConsole: source.captureConsole,
      captureNetwork: source.captureNetwork,
      retentionDays: source.retentionDays,
      projectId: source.projectId,
      requirementId: source.requirementId,
      steps: {
        create: source.steps.map(({ order, action, description, target, value, expected, timeoutMs }) => ({
          order, action, description, target, value, expected, timeoutMs
        }))
      }
    }
  });
  res.status(201).json(duplicate);
});
