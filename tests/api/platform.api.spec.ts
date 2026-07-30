import { expect, test } from '@playwright/test';

test.describe('Plataforma de qualidade', () => {
  test.describe.configure({ mode: 'serial' });
  let token: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    token = (await response.json()).token;
  });

  test('cria projeto, requisito e cenário rastreável', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const suffix = Date.now();
    const projectResponse = await request.post('/api/projects', {
      headers,
      data: {
        name: `Projeto API ${suffix}`,
        description: 'Projeto criado pela suíte de integração da plataforma.',
        environments: [
          { name: 'Local', baseUrl: 'http://localhost:5173', isDefault: true }
        ]
      }
    });
    expect(projectResponse.status()).toBe(201);
    const project = await projectResponse.json();

    const requirementResponse = await request.post(`/api/projects/${project.id}/requirements`, {
      headers,
      data: {
        title: 'Autenticação do projeto de integração',
        description: 'Usuários ativos devem conseguir acessar o produto.'
      }
    });
    expect(requirementResponse.status()).toBe(201);
    const requirement = await requirementResponse.json();

    const scenarioResponse = await request.post('/api/scenarios', {
      headers,
      data: {
        title: `Login rastreável ${suffix}`,
        description: 'Cenário criado por teste de API.',
        priority: 'HIGH',
        type: 'SMOKE',
        status: 'ACTIVE',
        automated: true,
        projectId: project.id,
        requirementId: requirement.id,
        steps: [
          {
            action: 'NAVIGATE',
            description: 'Acessar a tela de login',
            value: '/login'
          },
          {
            action: 'ASSERT_VISIBLE',
            description: 'Validar formulário de acesso',
            target: 'form'
          }
        ]
      }
    });
    expect(scenarioResponse.status()).toBe(201);
    const scenario = await scenarioResponse.json();
    expect(scenario).toMatchObject({
      projectId: project.id,
      requirementId: requirement.id,
      automated: true
    });
    expect(scenario.steps).toHaveLength(2);

    const detail = await request.get(`/api/scenarios/${scenario.id}`, { headers });
    expect(detail.status()).toBe(200);
    expect((await detail.json()).requirement.code).toBe(requirement.code);
  });

  test('converte eventos gravados em um cenário', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const projects = await (await request.get('/api/projects', { headers })).json();
    const project = projects[0];
    const recordingResponse = await request.post('/api/recordings', {
      headers,
      data: { projectId: project.id, title: `Gravação ${Date.now()}` }
    });
    expect(recordingResponse.status()).toBe(201);
    const recording = await recordingResponse.json();

    await request.post(`/api/recordings/${recording.id}/events`, {
      headers,
      data: { action: 'NAVIGATE', url: 'http://localhost:5173/login' }
    });
    await request.post(`/api/recordings/${recording.id}/events`, {
      headers,
      data: { action: 'CLICK', selector: 'button.button-primary', text: 'Entrar' }
    });

    const finished = await request.patch(`/api/recordings/${recording.id}/finish`, { headers });
    expect(finished.status()).toBe(200);
    const body = await finished.json();
    expect(body.status).toBe('SAVED');
    expect(body.scenario.code).toMatch(/^CT-/);
  });

  test('controla fila, duplicidade, cancelamento e nova tentativa', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const suffix = Date.now();
    const projectResponse = await request.post('/api/projects', {
      headers,
      data: {
        name: `Fila ${suffix}`,
        environments: [
          { name: 'Local', baseUrl: 'http://127.0.0.1:5173', isDefault: true }
        ]
      }
    });
    const project = await projectResponse.json();
    const scenarioResponse = await request.post('/api/scenarios', {
      headers,
      data: {
        title: `Cenário de fila ${suffix}`,
        priority: 'MEDIUM',
        type: 'FUNCTIONAL',
        status: 'ACTIVE',
        automated: true,
        timeoutMs: 60000,
        projectId: project.id,
        steps: [
          {
            action: 'NAVIGATE',
            description: 'Abrir uma página para validar o controle da fila',
            value: '/',
            timeoutMs: 30000
          }
        ]
      }
    });
    const scenario = await scenarioResponse.json();

    const queuedResponse = await request.post('/api/executions', {
      headers,
      data: {
        scenarioId: scenario.id,
        environmentId: project.environments[0].id,
        browser: 'chromium'
      }
    });
    expect(queuedResponse.status()).toBe(201);
    const queued = await queuedResponse.json();
    expect(['QUEUED', 'RUNNING']).toContain(queued.status);

    const duplicateResponse = await request.post('/api/executions', {
      headers,
      data: {
        scenarioId: scenario.id,
        environmentId: project.environments[0].id,
        browser: 'chromium'
      }
    });
    expect(duplicateResponse.status()).toBe(409);
    expect((await duplicateResponse.json()).details.executionId).toBe(queued.id);

    const cancelResponse = await request.post(`/api/executions/${queued.id}/cancel`, { headers });
    expect(cancelResponse.status()).toBe(200);
    expect((await cancelResponse.json()).status).toBe('CANCELLED');

    const retryResponse = await request.post(`/api/executions/${queued.id}/retry`, { headers });
    expect(retryResponse.status()).toBe(201);
    const retried = await retryResponse.json();
    expect(retried.retryOfId).toBe(queued.id);
    expect(retried.status).toBe('QUEUED');

    await request.post(`/api/executions/${retried.id}/cancel`, { headers });
    const detailResponse = await request.get(`/api/executions/${retried.id}`, { headers });
    const detail = await detailResponse.json();
    expect(detail.logs.length).toBeGreaterThan(0);
  });

  test('anexa, retém, exporta e remove evidências', async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` };
    const executionsResponse = await request.get('/api/executions', { headers });
    const executions = await executionsResponse.json();
    const execution = executions[0];

    const uploadResponse = await request.post(`/api/executions/${execution.id}/evidences`, {
      headers,
      multipart: {
        description: 'Arquivo anexado pela suíte de API.',
        file: {
          name: 'evidencia-manual.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Evidência manual do QA Truker.', 'utf8')
        }
      }
    });
    expect(uploadResponse.status()).toBe(201);
    const evidence = await uploadResponse.json();
    expect(evidence).toMatchObject({
      type: 'MANUAL',
      name: 'evidencia-manual.txt',
      mimeType: 'text/plain'
    });

    const retentionResponse = await request.patch(`/api/executions/${execution.id}/retention`, {
      headers,
      data: { retentionDays: 45 }
    });
    expect(retentionResponse.status()).toBe(200);
    expect((await retentionResponse.json()).retentionUntil).toBeTruthy();

    const csvResponse = await request.get(`/api/executions/${execution.id}/report.csv`, { headers });
    expect(csvResponse.status()).toBe(200);
    expect(csvResponse.headers()['content-type']).toContain('text/csv');
    expect(await csvResponse.text()).toContain(execution.code);

    const pdfResponse = await request.get(`/api/executions/${execution.id}/report.pdf`, { headers });
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe('%PDF');

    const deleteResponse = await request.delete(
      `/api/executions/${execution.id}/evidences/${evidence.id}`,
      { headers }
    );
    expect(deleteResponse.status()).toBe(204);
  });
});
