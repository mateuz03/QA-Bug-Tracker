import { expect, test } from '@playwright/test';

test.describe('Planos, suítes e ciclos de teste', () => {
  test.describe.configure({ mode: 'serial' });
  let token: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    token = (await response.json()).token;
  });

  test('organiza uma regressão e inicia as execuções do ciclo', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const suffix = Date.now();

    const projects = await (await request.get('/api/projects', { headers })).json();
    const project = projects.find((item: { code: string }) => item.code === 'PRJ-001');
    expect(project).toBeTruthy();
    const scenarios = await (await request.get(`/api/scenarios?projectId=${project.id}`, { headers })).json();
    const scenario = scenarios.find((item: { code: string }) => item.code === 'CT-001');
    const manualScenario = scenarios.find((item: { code: string }) => item.code === 'CT-MAN-001');
    expect(scenario).toBeTruthy();
    expect(manualScenario).toBeTruthy();

    const suiteResponse = await request.post('/api/test-plans/suites', {
      headers,
      data: {
        projectId: project.id,
        name: `Smoke ${suffix}`,
        description: 'Suíte reutilizável da release.',
        scenarioIds: [scenario.id, manualScenario.id]
      }
    });
    expect(suiteResponse.status()).toBe(201);
    const suite = await suiteResponse.json();
    expect(suite.scenarios).toHaveLength(2);

    const updatedSuiteResponse = await request.put(`/api/test-plans/suites/${suite.id}`, {
      headers,
      data: {
        name: `Smoke atualizado ${suffix}`,
        description: 'Suíte revisada antes de entrar no plano.',
        scenarioIds: [manualScenario.id, scenario.id]
      }
    });
    expect(updatedSuiteResponse.status()).toBe(200);
    const updatedSuite = await updatedSuiteResponse.json();
    expect(updatedSuite).toMatchObject({ id: suite.id, name: `Smoke atualizado ${suffix}` });
    expect(updatedSuite.scenarios.map((item: { scenarioId: number }) => item.scenarioId)).toEqual([manualScenario.id, scenario.id]);

    const planResponse = await request.post('/api/test-plans', {
      headers,
      data: {
        projectId: project.id,
        name: `Plano ${suffix}`,
        releaseVersion: '2.0.0',
        objective: 'Validar o fluxo crítico antes da publicação.',
        status: 'ACTIVE',
        suiteIds: [suite.id]
      }
    });
    expect(planResponse.status()).toBe(201);
    const plan = await planResponse.json();
    expect(plan.suites).toHaveLength(1);

    const updatedPlanResponse = await request.put(`/api/test-plans/${plan.id}`, {
      headers,
      data: {
        name: `Plano revisado ${suffix}`,
        releaseVersion: '2.0.1',
        description: 'Plano atualizado antes da criação do ciclo.',
        objective: 'Validar manutenção e execução do plano.',
        status: 'ACTIVE',
        suiteIds: [suite.id]
      }
    });
    expect(updatedPlanResponse.status()).toBe(200);
    expect(await updatedPlanResponse.json()).toMatchObject({ id: plan.id, name: `Plano revisado ${suffix}`, releaseVersion: '2.0.1' });

    const cycleResponse = await request.post(`/api/test-plans/${plan.id}/cycles`, {
      headers,
      data: {
        name: `Ciclo ${suffix}`,
        environmentId: project.environments[0].id,
        browser: 'chromium'
      }
    });
    expect(cycleResponse.status()).toBe(201);
    const cycle = await cycleResponse.json();
    expect(cycle.summary).toMatchObject({ total: 2, executed: 0, progress: 0 });

    const startResponse = await request.post(`/api/test-plans/cycles/${cycle.id}/start`, { headers });
    expect(startResponse.status()).toBe(201);
    const started = await startResponse.json();
    expect(started.cycleId).toBe(cycle.id);
    expect(started.executions).toHaveLength(1);
    expect(started.executions[0]).toMatchObject({ scenarioId: scenario.id, cycleId: cycle.id });

    const manualResult = await request.patch(`/api/test-plans/cycles/${cycle.id}/scenarios/${manualScenario.id}`, {
      headers,
      data: { result: 'PASSED', notes: 'Dashboard revisado sem desvios visuais.' }
    });
    expect(manualResult.status()).toBe(200);
    expect((await manualResult.json()).item).toMatchObject({ result: 'PASSED', executedBy: { name: 'Marina Costa' } });

    const detailResponse = await request.get(`/api/test-plans/${plan.id}`, { headers });
    expect(detailResponse.status()).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.cycles[0].status).toBe('RUNNING');
    expect(detail.cycles[0].summary).toMatchObject({ executed: 2, passed: 1 });

    await Promise.all(started.executions.map((execution: { id: number }) =>
      request.post(`/api/executions/${execution.id}/cancel`, { headers })
    ));

    const completedCycle = await (await request.get(`/api/test-plans/cycles/${cycle.id}`, { headers })).json();
    expect(completedCycle.status).toBe('COMPLETED');
    expect(completedCycle.summary.progress).toBe(100);

    const targetCycleResponse = await request.post(`/api/test-plans/${plan.id}/cycles`, {
      headers,
      data: {
        name: `Ciclo comparado ${suffix}`,
        environmentId: project.environments[0].id,
        browser: 'chromium'
      }
    });
    expect(targetCycleResponse.status()).toBe(201);
    const targetCycle = await targetCycleResponse.json();
    const targetStart = await (await request.post(`/api/test-plans/cycles/${targetCycle.id}/start`, { headers })).json();
    await request.patch(`/api/test-plans/cycles/${targetCycle.id}/scenarios/${manualScenario.id}`, {
      headers,
      data: { result: 'FAILED', notes: 'Regressão manual identificada na nova rodada.' }
    });
    await Promise.all(targetStart.executions.map((execution: { id: number }) =>
      request.post(`/api/executions/${execution.id}/cancel`, { headers })
    ));

    const comparisonResponse = await request.get(
      `/api/test-plans/${plan.id}/comparison?baselineId=${cycle.id}&targetId=${targetCycle.id}`,
      { headers }
    );
    expect(comparisonResponse.status()).toBe(200);
    const comparison = await comparisonResponse.json();
    expect(comparison.summary).toMatchObject({ regressions: 1, improvements: 0, passRateDelta: -50 });
    expect(comparison.items.find((item: { scenarioId: number }) => item.scenarioId === manualScenario.id)).toMatchObject({
      baselineResult: 'PASSED',
      targetResult: 'FAILED',
      classification: 'REGRESSION'
    });

    const scheduledCycleResponse = await request.post(`/api/test-plans/${plan.id}/cycles`, {
      headers,
      data: {
        name: `Ciclo agendado ${suffix}`,
        environmentId: project.environments[0].id,
        browser: 'firefox'
      }
    });
    expect(scheduledCycleResponse.status()).toBe(201);
    const scheduledCycle = await scheduledCycleResponse.json();
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const scheduleResponse = await request.patch(`/api/test-plans/cycles/${scheduledCycle.id}/schedule`, {
      headers,
      data: { scheduledAt: futureDate }
    });
    expect(scheduleResponse.status()).toBe(200);
    expect(await scheduleResponse.json()).toMatchObject({ id: scheduledCycle.id, status: 'PLANNED' });

    const scheduledDetail = await (await request.get(`/api/test-plans/cycles/${scheduledCycle.id}`, { headers })).json();
    expect(scheduledDetail.scheduledAt).toBe(futureDate);

    const removeScheduleResponse = await request.patch(`/api/test-plans/cycles/${scheduledCycle.id}/schedule`, {
      headers,
      data: { scheduledAt: null }
    });
    expect(removeScheduleResponse.status()).toBe(200);
    expect((await removeScheduleResponse.json()).scheduledAt).toBeNull();

    await request.patch(`/api/test-plans/cycles/${scheduledCycle.id}/schedule`, {
      headers,
      data: { scheduledAt: futureDate }
    });
    const runNowResponse = await request.post(`/api/test-plans/cycles/${scheduledCycle.id}/start`, { headers });
    expect(runNowResponse.status()).toBe(201);
    const runNow = await runNowResponse.json();
    expect(runNow.executions).toHaveLength(1);

    await request.patch(`/api/test-plans/cycles/${scheduledCycle.id}/scenarios/${manualScenario.id}`, {
      headers,
      data: { result: 'PASSED', notes: 'Execução manual da rodada previamente agendada.' }
    });
    await Promise.all(runNow.executions.map((execution: { id: number }) =>
      request.post(`/api/executions/${execution.id}/cancel`, { headers })
    ));

    const runNowDetail = await (await request.get(`/api/test-plans/cycles/${scheduledCycle.id}`, { headers })).json();
    expect(runNowDetail).toMatchObject({ status: 'COMPLETED', scheduledAt: null });
  });
});
