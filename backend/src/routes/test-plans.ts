import { CycleScenarioResult, TestCycleStatus, TestPlanStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { compareCycles, startCycleExecution, summarizeCycle, syncCycleStatus } from '../services/test-cycle.js';
import { HttpError } from '../utils/http-error.js';

export const testPlansRouter = Router();
testPlansRouter.use(authenticate);

const browserSchema = z.enum(['chromium', 'firefox', 'webkit']);

const planInclude = {
  project: { select: { id: true, code: true, name: true, environments: true } },
  createdBy: { select: { id: true, name: true } },
  suites: {
    include: {
      suite: {
        include: {
          scenarios: {
            include: { scenario: { select: { id: true, code: true, title: true, automated: true, status: true } } },
            orderBy: { order: 'asc' as const }
          }
        }
      }
    },
    orderBy: { order: 'asc' as const }
  },
  cycles: {
    include: {
      environment: { select: { id: true, name: true, baseUrl: true } },
      scenarios: { select: { scenarioId: true, result: true } },
      executions: {
        select: { id: true, code: true, scenarioId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' as const }
      }
    },
    orderBy: { createdAt: 'desc' as const }
  }
};

testPlansRouter.get('/', async (req, res) => {
  const projectId = z.coerce.number().int().positive().optional().parse(req.query.projectId);
  const plans = await prisma.testPlan.findMany({
    where: projectId ? { projectId } : {},
    include: planInclude,
    orderBy: { updatedAt: 'desc' }
  });
  res.json(plans.map((plan) => ({
    ...plan,
    cycles: plan.cycles.map((cycle) => ({ ...cycle, summary: summarizeCycle(cycle) }))
  })));
});

testPlansRouter.get('/suites', async (req, res) => {
  const projectId = z.coerce.number().int().positive().optional().parse(req.query.projectId);
  const suites = await prisma.testSuite.findMany({
    where: projectId ? { projectId } : {},
    include: {
      project: { select: { id: true, code: true, name: true } },
      scenarios: {
        include: { scenario: { select: { id: true, code: true, title: true, automated: true, status: true } } },
        orderBy: { order: 'asc' }
      },
      _count: { select: { plans: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(suites);
});

testPlansRouter.get('/cycles/:cycleId', async (req, res) => {
  const cycleId = z.coerce.number().int().positive().parse(req.params.cycleId);
  await syncCycleStatus(cycleId);
  const cycle = await prisma.testCycle.findUnique({
    where: { id: cycleId },
    include: {
      plan: {
        include: { project: { select: { id: true, code: true, name: true } } }
      },
      environment: true,
      createdBy: { select: { id: true, name: true } },
      scenarios: {
        include: {
          scenario: {
            include: {
              requirement: { select: { id: true, code: true, title: true } },
              _count: { select: { steps: true, bugs: true, executions: true } }
            }
          },
          executedBy: { select: { id: true, name: true } }
        },
        orderBy: { order: 'asc' }
      },
      executions: {
        include: {
          scenario: { select: { id: true, code: true, title: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { bugs: true } }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!cycle) throw new HttpError(404, 'Ciclo não encontrado.');
  res.json({ ...cycle, summary: summarizeCycle(cycle) });
});

const manualResultSchema = z.object({
  result: z.nativeEnum(CycleScenarioResult),
  notes: z.string().trim().max(2000).optional().nullable()
});

testPlansRouter.patch('/cycles/:cycleId/scenarios/:scenarioId', async (req, res) => {
  const cycleId = z.coerce.number().int().positive().parse(req.params.cycleId);
  const scenarioId = z.coerce.number().int().positive().parse(req.params.scenarioId);
  const data = manualResultSchema.parse(req.body);
  const item = await prisma.testCycleScenario.findUnique({
    where: { cycleId_scenarioId: { cycleId, scenarioId } },
    include: { scenario: { select: { automated: true } } }
  });
  if (!item) throw new HttpError(404, 'Cenário não encontrado neste ciclo.');
  if (item.scenario.automated) {
    throw new HttpError(409, 'O resultado de um cenário automatizado é atualizado pela execução.');
  }

  const updated = await prisma.testCycleScenario.update({
    where: { cycleId_scenarioId: { cycleId, scenarioId } },
    data: {
      result: data.result,
      notes: data.notes,
      executedById: data.result === CycleScenarioResult.NOT_RUN ? null : req.user!.id,
      executedAt: data.result === CycleScenarioResult.NOT_RUN ? null : new Date()
    },
    include: { scenario: true, executedBy: { select: { id: true, name: true } } }
  });
  const cycle = await syncCycleStatus(cycleId);
  res.json({ item: updated, cycleStatus: cycle?.status });
});

const suiteSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  scenarioIds: z.array(z.number().int().positive()).min(1)
});

testPlansRouter.post('/suites', async (req, res) => {
  const data = suiteSchema.parse(req.body);
  const scenarioIds = [...new Set(data.scenarioIds)];
  const scenarios = await prisma.testScenario.findMany({
    where: { id: { in: scenarioIds }, projectId: data.projectId },
    select: { id: true }
  });
  if (scenarios.length !== scenarioIds.length) {
    throw new HttpError(400, 'Todos os cenários da suíte devem pertencer ao projeto selecionado.');
  }

  const latest = await prisma.testSuite.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const suite = await prisma.testSuite.create({
    data: {
      code: `SUITE-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`,
      name: data.name,
      description: data.description,
      projectId: data.projectId,
      createdById: req.user!.id,
      scenarios: { create: scenarioIds.map((scenarioId, index) => ({ scenarioId, order: index + 1 })) }
    },
    include: { scenarios: { include: { scenario: true }, orderBy: { order: 'asc' } } }
  });
  res.status(201).json(suite);
});

const updateSuiteSchema = suiteSchema.omit({ projectId: true });

testPlansRouter.put('/suites/:suiteId', async (req, res) => {
  const suiteId = z.coerce.number().int().positive().parse(req.params.suiteId);
  const data = updateSuiteSchema.parse(req.body);
  const suite = await prisma.testSuite.findUnique({ where: { id: suiteId }, select: { id: true, projectId: true } });
  if (!suite) throw new HttpError(404, 'Suíte não encontrada.');

  const scenarioIds = [...new Set(data.scenarioIds)];
  const scenarios = await prisma.testScenario.findMany({
    where: { id: { in: scenarioIds }, projectId: suite.projectId },
    select: { id: true }
  });
  if (scenarios.length !== scenarioIds.length) {
    throw new HttpError(400, 'Todos os cenários da suíte devem pertencer ao projeto selecionado.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.testSuiteScenario.deleteMany({ where: { suiteId } });
    return tx.testSuite.update({
      where: { id: suiteId },
      data: {
        name: data.name,
        description: data.description,
        scenarios: { create: scenarioIds.map((scenarioId, index) => ({ scenarioId, order: index + 1 })) }
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        scenarios: { include: { scenario: true }, orderBy: { order: 'asc' } },
        _count: { select: { plans: true } }
      }
    });
  });
  res.json(updated);
});

const planSchema = z.object({
  projectId: z.number().int().positive(),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  objective: z.string().trim().max(2000).optional().nullable(),
  releaseVersion: z.string().trim().max(60).optional().nullable(),
  status: z.nativeEnum(TestPlanStatus).default(TestPlanStatus.DRAFT),
  suiteIds: z.array(z.number().int().positive()).default([])
});

testPlansRouter.post('/', async (req, res) => {
  const data = planSchema.parse(req.body);
  const suiteIds = [...new Set(data.suiteIds)];
  const suites = await prisma.testSuite.findMany({
    where: { id: { in: suiteIds }, projectId: data.projectId },
    select: { id: true }
  });
  if (suites.length !== suiteIds.length) {
    throw new HttpError(400, 'Todas as suítes devem pertencer ao projeto selecionado.');
  }

  const latest = await prisma.testPlan.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const plan = await prisma.testPlan.create({
    data: {
      code: `PLAN-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`,
      name: data.name,
      description: data.description,
      objective: data.objective,
      releaseVersion: data.releaseVersion,
      status: data.status,
      projectId: data.projectId,
      createdById: req.user!.id,
      suites: { create: suiteIds.map((suiteId, index) => ({ suiteId, order: index + 1 })) }
    },
    include: planInclude
  });
  res.status(201).json(plan);
});

const updatePlanSchema = planSchema.omit({ projectId: true }).extend({
  status: z.nativeEnum(TestPlanStatus)
});

testPlansRouter.put('/:id', async (req, res) => {
  const planId = z.coerce.number().int().positive().parse(req.params.id);
  const data = updatePlanSchema.parse(req.body);
  const plan = await prisma.testPlan.findUnique({ where: { id: planId }, select: { id: true, projectId: true } });
  if (!plan) throw new HttpError(404, 'Plano de teste não encontrado.');

  const suiteIds = [...new Set(data.suiteIds)];
  const suites = await prisma.testSuite.findMany({
    where: { id: { in: suiteIds }, projectId: plan.projectId },
    select: { id: true }
  });
  if (suites.length !== suiteIds.length) {
    throw new HttpError(400, 'Todas as suítes devem pertencer ao projeto do plano.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.testPlanSuite.deleteMany({ where: { planId } });
    return tx.testPlan.update({
      where: { id: planId },
      data: {
        name: data.name,
        description: data.description,
        objective: data.objective,
        releaseVersion: data.releaseVersion,
        status: data.status,
        suites: { create: suiteIds.map((suiteId, index) => ({ suiteId, order: index + 1 })) }
      },
      include: planInclude
    });
  });
  res.json({
    ...updated,
    cycles: updated.cycles.map((cycle) => ({ ...cycle, summary: summarizeCycle(cycle) }))
  });
});

testPlansRouter.get('/:id/comparison', async (req, res) => {
  const planId = z.coerce.number().int().positive().parse(req.params.id);
  const query = z.object({
    baselineId: z.coerce.number().int().positive().optional(),
    targetId: z.coerce.number().int().positive().optional()
  }).parse(req.query);
  const plan = await prisma.testPlan.findUnique({
    where: { id: planId },
    select: { id: true, code: true, name: true, releaseVersion: true, project: { select: { id: true, code: true, name: true } } }
  });
  if (!plan) throw new HttpError(404, 'Plano de teste não encontrado.');

  const cycles = await prisma.testCycle.findMany({
    where: { planId },
    include: {
      scenarios: {
        include: { scenario: { select: { id: true, code: true, title: true, automated: true } } }
      },
      executions: {
        select: { scenarioId: true, status: true },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  if (cycles.length < 2) throw new HttpError(409, 'Crie ao menos dois ciclos para realizar a comparação.');

  const target = query.targetId ? cycles.find((cycle) => cycle.id === query.targetId) : cycles[0];
  const baseline = query.baselineId ? cycles.find((cycle) => cycle.id === query.baselineId) : cycles.find((cycle) => cycle.id !== target?.id);
  if (!baseline || !target) throw new HttpError(400, 'Selecione ciclos que pertençam a este plano.');
  if (baseline.id === target.id) throw new HttpError(400, 'Selecione dois ciclos diferentes.');

  res.json({ plan, ...compareCycles(baseline, target) });
});

testPlansRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const plan = await prisma.testPlan.findUnique({ where: { id }, include: planInclude });
  if (!plan) throw new HttpError(404, 'Plano de teste não encontrado.');
  res.json({
    ...plan,
    cycles: plan.cycles.map((cycle) => ({ ...cycle, summary: summarizeCycle(cycle) }))
  });
});

const attachSuiteSchema = z.object({ suiteId: z.number().int().positive() });

testPlansRouter.post('/:id/suites', async (req, res) => {
  const planId = z.coerce.number().int().positive().parse(req.params.id);
  const { suiteId } = attachSuiteSchema.parse(req.body);
  const [plan, suite] = await Promise.all([
    prisma.testPlan.findUnique({ where: { id: planId }, select: { id: true, projectId: true } }),
    prisma.testSuite.findUnique({ where: { id: suiteId }, select: { id: true, projectId: true } })
  ]);
  if (!plan || !suite) throw new HttpError(404, 'Plano ou suíte não encontrado.');
  if (plan.projectId !== suite.projectId) throw new HttpError(400, 'Plano e suíte devem pertencer ao mesmo projeto.');
  const order = (await prisma.testPlanSuite.count({ where: { planId } })) + 1;
  const item = await prisma.testPlanSuite.create({ data: { planId, suiteId, order }, include: { suite: true } });
  res.status(201).json(item);
});

const cycleSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  environmentId: z.number().int().positive(),
  browser: browserSchema.default('chromium'),
  plannedStart: z.coerce.date().optional().nullable(),
  plannedEnd: z.coerce.date().optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  suiteIds: z.array(z.number().int().positive()).optional()
});

testPlansRouter.post('/:id/cycles', async (req, res) => {
  const planId = z.coerce.number().int().positive().parse(req.params.id);
  const data = cycleSchema.parse(req.body);
  const plan = await prisma.testPlan.findUnique({
    where: { id: planId },
    include: {
      project: { include: { environments: true } },
      suites: {
        where: data.suiteIds?.length ? { suiteId: { in: [...new Set(data.suiteIds)] } } : {},
        include: { suite: { include: { scenarios: { orderBy: { order: 'asc' } } } } },
        orderBy: { order: 'asc' }
      }
    }
  });
  if (!plan) throw new HttpError(404, 'Plano de teste não encontrado.');
  if (!plan.project.environments.some((environment) => environment.id === data.environmentId)) {
    throw new HttpError(400, 'O ambiente deve pertencer ao projeto do plano.');
  }
  if (data.suiteIds?.length && plan.suites.length !== new Set(data.suiteIds).size) {
    throw new HttpError(400, 'Selecione apenas suítes vinculadas ao plano.');
  }
  if (data.scheduledAt && data.scheduledAt.getTime() <= Date.now() + 5000) {
    throw new HttpError(400, 'Agende o ciclo com pelo menos cinco segundos de antecedência.');
  }

  const scenarioIds = [...new Set(plan.suites.flatMap((item) => item.suite.scenarios.map((entry) => entry.scenarioId)))];
  if (!scenarioIds.length) throw new HttpError(409, 'O plano precisa possuir ao menos um cenário antes de criar o ciclo.');

  const latest = await prisma.testCycle.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const cycle = await prisma.testCycle.create({
    data: {
      code: `CYCLE-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`,
      name: data.name,
      description: data.description,
      browser: data.browser,
      plannedStart: data.plannedStart ?? data.scheduledAt,
      plannedEnd: data.plannedEnd,
      scheduledAt: data.scheduledAt,
      planId,
      environmentId: data.environmentId,
      createdById: req.user!.id,
      scenarios: { create: scenarioIds.map((scenarioId, index) => ({ scenarioId, order: index + 1 })) }
    },
    include: {
      environment: true,
      scenarios: { include: { scenario: true }, orderBy: { order: 'asc' } },
      executions: true
    }
  });
  res.status(201).json({ ...cycle, summary: summarizeCycle(cycle) });
});

testPlansRouter.post('/cycles/:cycleId/start', async (req, res) => {
  const cycleId = z.coerce.number().int().positive().parse(req.params.cycleId);
  res.status(201).json(await startCycleExecution(cycleId, req.user!.id));
});

const scheduleSchema = z.object({ scheduledAt: z.coerce.date().nullable() });

testPlansRouter.patch('/cycles/:cycleId/schedule', async (req, res) => {
  const cycleId = z.coerce.number().int().positive().parse(req.params.cycleId);
  const { scheduledAt } = scheduleSchema.parse(req.body);
  const cycle = await prisma.testCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new HttpError(404, 'Ciclo não encontrado.');
  if (cycle.status !== TestCycleStatus.PLANNED) {
    throw new HttpError(409, 'Somente ciclos planejados podem ser agendados.');
  }
  if (scheduledAt && scheduledAt.getTime() <= Date.now() + 5000) {
    throw new HttpError(400, 'Agende o ciclo com pelo menos cinco segundos de antecedência.');
  }
  const updated = await prisma.testCycle.update({
    where: { id: cycleId },
    data: { scheduledAt, plannedStart: scheduledAt ?? cycle.plannedStart }
  });
  res.json(updated);
});

const statusSchema = z.object({ status: z.nativeEnum(TestCycleStatus) });

testPlansRouter.patch('/cycles/:cycleId/status', async (req, res) => {
  const cycleId = z.coerce.number().int().positive().parse(req.params.cycleId);
  const { status } = statusSchema.parse(req.body);
  const cycle = await prisma.testCycle.update({
    where: { id: cycleId },
    data: {
      status,
      ...(status === TestCycleStatus.RUNNING ? { startedAt: new Date(), finishedAt: null } : {}),
      ...(status === TestCycleStatus.COMPLETED || status === TestCycleStatus.CANCELLED
        ? { finishedAt: new Date(), scheduledAt: null }
        : {})
    }
  });
  res.json(cycle);
});
