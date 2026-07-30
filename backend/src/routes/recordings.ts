import { RecordingStatus, StepAction } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';

export const recordingsRouter = Router();
recordingsRouter.use(authenticate);

recordingsRouter.get('/', async (_req, res) => {
  const recordings = await prisma.recordingSession.findMany({
    include: {
      project: { select: { id: true, code: true, name: true } },
      scenario: { select: { id: true, code: true, title: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { events: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(recordings);
});

const createRecordingSchema = z.object({
  projectId: z.number().int().positive(),
  scenarioId: z.number().int().positive().optional().nullable(),
  title: z.string().trim().min(3).max(160)
});

recordingsRouter.post('/', async (req, res) => {
  const data = createRecordingSchema.parse(req.body);
  const latest = await prisma.recordingSession.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const recording = await prisma.recordingSession.create({
    data: {
      code: `REC-${String((latest?.id ?? 0) + 1).padStart(5, '0')}`,
      ...data,
      createdById: req.user!.id
    }
  });
  res.status(201).json(recording);
});

const eventSchema = z.object({
  action: z.nativeEnum(StepAction),
  url: z.string().trim().url().optional().nullable(),
  selector: z.string().trim().max(1000).optional().nullable(),
  value: z.string().max(3000).optional().nullable(),
  text: z.string().trim().max(1000).optional().nullable()
});

recordingsRouter.post('/:id/events', async (req, res) => {
  const sessionId = z.coerce.number().int().positive().parse(req.params.id);
  const data = eventSchema.parse(req.body);
  const session = await prisma.recordingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true }
  });
  if (!session) throw new HttpError(404, 'Sessão de gravação não encontrada.');
  if (session.status !== RecordingStatus.RECORDING) {
    throw new HttpError(409, 'Esta gravação já foi finalizada.');
  }
  const count = await prisma.recordedEvent.count({ where: { sessionId } });
  const event = await prisma.recordedEvent.create({
    data: { ...data, order: count + 1, sessionId }
  });
  res.status(201).json(event);
});

recordingsRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const recording = await prisma.recordingSession.findUnique({
    where: { id },
    include: {
      project: true,
      scenario: true,
      events: { orderBy: { order: 'asc' } }
    }
  });
  if (!recording) throw new HttpError(404, 'Sessão de gravação não encontrada.');
  res.json(recording);
});

recordingsRouter.patch('/:id/finish', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const recording = await prisma.recordingSession.findUnique({
    where: { id },
    include: { events: { orderBy: { order: 'asc' } } }
  });
  if (!recording) throw new HttpError(404, 'Sessão de gravação não encontrada.');
  if (!recording.events.length) throw new HttpError(409, 'Nenhum evento foi gravado.');

  const steps = recording.events.map((event, index) => ({
    order: index + 1,
    action: event.action,
    description:
      event.action === 'NAVIGATE'
        ? `Navegar para ${event.url}`
        : `${event.action === 'FILL' ? 'Preencher' : event.action === 'CLICK' ? 'Clicar em' : 'Executar'} ${event.text || event.selector || ''}`.trim(),
    target: event.selector,
    value: event.action === 'NAVIGATE' ? event.url : event.value,
    expected: null
  }));

  let scenarioId = recording.scenarioId;
  if (scenarioId) {
    await prisma.$transaction(async (tx) => {
      await tx.scenarioStep.deleteMany({ where: { scenarioId: scenarioId! } });
      await tx.scenarioStep.createMany({
        data: steps.map((step) => ({ ...step, scenarioId: scenarioId! }))
      });
      await tx.testScenario.update({
        where: { id: scenarioId! },
        data: { automated: true, status: 'ACTIVE' }
      });
    });
  } else {
    const latest = await prisma.testScenario.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const scenario = await prisma.testScenario.create({
      data: {
        code: `CT-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`,
        title: recording.title,
        priority: 'MEDIUM',
        type: 'FUNCTIONAL',
        status: 'ACTIVE',
        automated: true,
        projectId: recording.projectId,
        steps: { create: steps }
      }
    });
    scenarioId = scenario.id;
  }

  const updated = await prisma.recordingSession.update({
    where: { id },
    data: { status: 'SAVED', scenarioId, finishedAt: new Date() },
    include: { scenario: true, events: { orderBy: { order: 'asc' } } }
  });
  res.json(updated);
});
