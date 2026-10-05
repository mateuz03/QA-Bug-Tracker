import type { CycleScenarioResult, ExecutionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';
import { enqueueExecution } from './execution-queue.js';

type CycleSnapshot = {
  scenarios: { scenarioId: number; result: CycleScenarioResult }[];
  executions: { scenarioId: number; status: ExecutionStatus }[];
};

const finishedStatuses = new Set<string>(['PASSED', 'FAILED', 'BLOCKED', 'CANCELLED']);

export function summarizeCycle(cycle: CycleSnapshot) {
  const latestByScenario = new Map<number, string>();
  for (const execution of cycle.executions) {
    if (!latestByScenario.has(execution.scenarioId)) latestByScenario.set(execution.scenarioId, execution.status);
  }

  const results = cycle.scenarios.map((item) => {
    const executionStatus = latestByScenario.get(item.scenarioId);
    return executionStatus ?? item.result;
  });
  const finished = results.filter((status) => finishedStatuses.has(status));

  return {
    total: cycle.scenarios.length,
    executed: results.filter((status) => status !== 'NOT_RUN').length,
    passed: results.filter((status) => status === 'PASSED').length,
    failed: results.filter((status) => status === 'FAILED').length,
    blocked: results.filter((status) => status === 'BLOCKED').length,
    running: results.filter((status) => status === 'RUNNING').length,
    queued: results.filter((status) => status === 'QUEUED').length,
    notRun: results.filter((status) => status === 'NOT_RUN').length,
    progress: cycle.scenarios.length ? Math.round((finished.length / cycle.scenarios.length) * 100) : 0
  };
}

export async function syncCycleStatus(cycleId?: number | null) {
  if (!cycleId) return null;
  const cycle = await prisma.testCycle.findUnique({
    where: { id: cycleId },
    include: {
      scenarios: { select: { scenarioId: true, result: true } },
      executions: {
        select: { scenarioId: true, status: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!cycle || cycle.status === 'CANCELLED') return cycle;

  const summary = summarizeCycle(cycle);
  if (summary.total > 0 && summary.progress === 100) {
    return prisma.testCycle.update({
      where: { id: cycle.id },
      data: { status: 'COMPLETED', startedAt: cycle.startedAt ?? new Date(), finishedAt: new Date() }
    });
  }
  if (summary.executed > 0 && cycle.status === 'PLANNED') {
    return prisma.testCycle.update({
      where: { id: cycle.id },
      data: { status: 'RUNNING', startedAt: new Date(), finishedAt: null }
    });
  }
  return cycle;
}

export async function startCycleExecution(cycleId: number, createdById: number) {
  const cycle = await prisma.testCycle.findUnique({
    where: { id: cycleId },
    include: { scenarios: { include: { scenario: true }, orderBy: { order: 'asc' } } }
  });
  if (!cycle) throw new HttpError(404, 'Ciclo não encontrado.');
  if (cycle.status !== 'PLANNED') throw new HttpError(409, 'Somente ciclos planejados podem ser iniciados.');

  const candidates = cycle.scenarios.filter((entry) => entry.scenario.automated && entry.scenario.status === 'ACTIVE');
  if (!candidates.length) throw new HttpError(409, 'O ciclo não possui cenários automatizados e ativos.');

  const claimed = await prisma.testCycle.updateMany({
    where: { id: cycle.id, status: 'PLANNED' },
    data: { status: 'RUNNING', startedAt: new Date(), scheduledAt: null }
  });
  if (!claimed.count) throw new HttpError(409, 'O ciclo já foi iniciado por outro processo.');

  const executions = [];
  const skipped: { scenarioId: number; reason: string }[] = [];
  for (const entry of candidates) {
    try {
      executions.push(await enqueueExecution({
        scenarioId: entry.scenarioId,
        environmentId: cycle.environmentId,
        browser: cycle.browser,
        createdById,
        cycleId: cycle.id
      }));
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        skipped.push({ scenarioId: entry.scenarioId, reason: error.message });
      } else {
        throw error;
      }
    }
  }
  if (!executions.length) {
    await prisma.testCycle.update({
      where: { id: cycle.id },
      data: { status: 'PLANNED', startedAt: null, scheduledAt: cycle.scheduledAt }
    });
    throw new HttpError(409, 'Nenhuma execução pôde ser adicionada à fila.', { skipped });
  }
  return { cycleId: cycle.id, executions, skipped };
}

export async function startDueCycles() {
  const dueCycles = await prisma.testCycle.findMany({
    where: { status: 'PLANNED', scheduledAt: { lte: new Date() } },
    select: { id: true, code: true, createdById: true },
    orderBy: { scheduledAt: 'asc' },
    take: 10
  });
  const results: { cycleId: number; code: string; started: boolean; error?: string }[] = [];
  for (const cycle of dueCycles) {
    try {
      await startCycleExecution(cycle.id, cycle.createdById);
      results.push({ cycleId: cycle.id, code: cycle.code, started: true });
    } catch (error) {
      results.push({
        cycleId: cycle.id,
        code: cycle.code,
        started: false,
        error: error instanceof Error ? error.message : 'Falha desconhecida.'
      });
    }
  }
  return results;
}

type ComparableCycle = {
  id: number;
  code: string;
  name: string;
  status: string;
  createdAt: Date;
  finishedAt: Date | null;
  scenarios: {
    scenarioId: number;
    result: CycleScenarioResult;
    scenario: { id: number; code: string; title: string; automated: boolean };
  }[];
  executions: { scenarioId: number; status: ExecutionStatus }[];
};

function comparableResults(cycle: ComparableCycle) {
  const latestByScenario = new Map<number, ExecutionStatus>();
  for (const execution of cycle.executions) {
    if (!latestByScenario.has(execution.scenarioId)) latestByScenario.set(execution.scenarioId, execution.status);
  }
  return new Map(cycle.scenarios.map((item) => [item.scenarioId, {
    scenario: item.scenario,
    result: latestByScenario.get(item.scenarioId) ?? item.result
  }]));
}

export function compareCycles(baseline: ComparableCycle, target: ComparableCycle) {
  const baselineResults = comparableResults(baseline);
  const targetResults = comparableResults(target);
  const scenarioIds = [...new Set([...baselineResults.keys(), ...targetResults.keys()])];
  const items = scenarioIds.map((scenarioId) => {
    const before = baselineResults.get(scenarioId);
    const after = targetResults.get(scenarioId);
    let classification: 'REGRESSION' | 'IMPROVEMENT' | 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'CHANGED';
    if (!before) classification = 'ADDED';
    else if (!after) classification = 'REMOVED';
    else if (before.result === after.result) classification = 'UNCHANGED';
    else if (before.result === 'PASSED' && (after.result === 'FAILED' || after.result === 'BLOCKED')) classification = 'REGRESSION';
    else if ((before.result === 'FAILED' || before.result === 'BLOCKED') && after.result === 'PASSED') classification = 'IMPROVEMENT';
    else classification = 'CHANGED';
    return {
      scenarioId,
      scenario: after?.scenario ?? before!.scenario,
      baselineResult: before?.result ?? null,
      targetResult: after?.result ?? null,
      classification
    };
  }).sort((left, right) => {
    const priority = { REGRESSION: 0, IMPROVEMENT: 1, CHANGED: 2, ADDED: 3, REMOVED: 4, UNCHANGED: 5 };
    return priority[left.classification] - priority[right.classification]
      || left.scenario.code.localeCompare(right.scenario.code);
  });

  const passRate = (cycle: ComparableCycle) => {
    const results = [...comparableResults(cycle).values()];
    return results.length ? Math.round((results.filter((item) => item.result === 'PASSED').length / results.length) * 100) : 0;
  };
  const baselinePassRate = passRate(baseline);
  const targetPassRate = passRate(target);

  return {
    baseline: { id: baseline.id, code: baseline.code, name: baseline.name, status: baseline.status, createdAt: baseline.createdAt, finishedAt: baseline.finishedAt, passRate: baselinePassRate },
    target: { id: target.id, code: target.code, name: target.name, status: target.status, createdAt: target.createdAt, finishedAt: target.finishedAt, passRate: targetPassRate },
    summary: {
      total: items.length,
      regressions: items.filter((item) => item.classification === 'REGRESSION').length,
      improvements: items.filter((item) => item.classification === 'IMPROVEMENT').length,
      changed: items.filter((item) => item.classification === 'CHANGED').length,
      unchanged: items.filter((item) => item.classification === 'UNCHANGED').length,
      added: items.filter((item) => item.classification === 'ADDED').length,
      removed: items.filter((item) => item.classification === 'REMOVED').length,
      passRateDelta: targetPassRate - baselinePassRate
    },
    items
  };
}
