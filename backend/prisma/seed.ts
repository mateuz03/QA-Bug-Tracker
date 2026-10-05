import {
  BugStatus,
  ExecutionStatus,
  ExecutionStepStatus,
  PrismaClient,
  Priority,
  Role,
  ScenarioStatus,
  ScenarioType,
  Severity,
  StepAction
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Qa@123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@qatracker.dev' },
    update: {},
    create: {
      name: 'Marina Costa',
      email: 'admin@qatracker.dev',
      passwordHash,
      role: Role.ADMIN
    }
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analista@qatracker.dev' },
    update: {},
    create: {
      name: 'Lucas Ribeiro',
      email: 'analista@qatracker.dev',
      passwordHash,
      role: Role.ANALYST
    }
  });

  const project = await prisma.project.upsert({
    where: { code: 'PRJ-001' },
    update: {},
    create: {
      code: 'PRJ-001',
      name: 'QA Truker',
      description: 'Plataforma de gestão, rastreabilidade e automação de qualidade.',
      repositoryUrl: 'https://github.com/mateuz03/QA-Bug-Tracker',
      ownerId: admin.id
    }
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: { role: 'OWNER' },
    create: { projectId: project.id, userId: admin.id, role: 'OWNER' }
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: analyst.id } },
    update: { role: 'MANAGER' },
    create: { projectId: project.id, userId: analyst.id, role: 'MANAGER' }
  });

  const environment = await prisma.environment.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Local' } },
    update: { baseUrl: 'http://localhost:5173', isDefault: true },
    create: {
      projectId: project.id,
      name: 'Local',
      baseUrl: 'http://localhost:5173',
      isDefault: true
    }
  });

  await prisma.environment.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Homologação' } },
    update: {},
    create: {
      projectId: project.id,
      name: 'Homologação',
      baseUrl: 'https://hml.exemplo.dev'
    }
  });

  const requirement = await prisma.requirement.upsert({
    where: { code: 'REQ-001' },
    update: {},
    create: {
      code: 'REQ-001',
      title: 'Autenticação de usuários',
      description: 'O sistema deve permitir login seguro com e-mail e senha válidos.',
      projectId: project.id,
      status: 'COVERED'
    }
  });

  const scenario = await prisma.testScenario.upsert({
    where: { code: 'CT-001' },
    update: {
      timeoutMs: 60000,
      screenshotMode: 'FAILURE',
      captureVideo: true,
      captureTrace: true,
      captureConsole: true,
      captureNetwork: true,
      retentionDays: 30
    },
    create: {
      code: 'CT-001',
      title: 'Login com usuário válido',
      description: 'Valida o acesso ao dashboard usando um administrador ativo.',
      preconditions: 'O usuário administrador deve existir e estar ativo.',
      priority: Priority.HIGH,
      type: ScenarioType.SMOKE,
      status: ScenarioStatus.ACTIVE,
      automated: true,
      projectId: project.id,
      requirementId: requirement.id
    }
  });

  if ((await prisma.scenarioStep.count({ where: { scenarioId: scenario.id } })) === 0) {
    await prisma.scenarioStep.createMany({
      data: [
        {
          scenarioId: scenario.id,
          order: 1,
          action: StepAction.NAVIGATE,
          description: 'Acessar a página de login',
          value: '/login'
        },
        {
          scenarioId: scenario.id,
          order: 2,
          action: StepAction.FILL,
          description: 'Preencher o campo E-mail',
          target: 'input[type="email"]',
          value: 'admin@qatracker.dev'
        },
        {
          scenarioId: scenario.id,
          order: 3,
          action: StepAction.FILL,
          description: 'Preencher o campo Senha',
          target: 'input[type="password"]',
          value: 'Qa@123456'
        },
        {
          scenarioId: scenario.id,
          order: 4,
          action: StepAction.CLICK,
          description: 'Clicar no botão Entrar',
          target: 'button.button-primary'
        },
        {
          scenarioId: scenario.id,
          order: 5,
          action: StepAction.ASSERT_URL,
          description: 'Validar que o dashboard foi apresentado',
          expected: '/dashboard'
        }
      ]
    });
  }

  await prisma.scenarioStep.updateMany({
    where: { scenarioId: scenario.id, order: 4 },
    data: { target: 'button.button-primary' }
  });

  const manualScenario = await prisma.testScenario.upsert({
    where: { code: 'CT-MAN-001' },
    update: {},
    create: {
      code: 'CT-MAN-001',
      title: 'Revisão exploratória do dashboard',
      description: 'Valida visualmente indicadores, navegação e legibilidade do dashboard.',
      preconditions: 'Usuário administrador autenticado e dados de demonstração carregados.',
      priority: Priority.MEDIUM,
      type: ScenarioType.REGRESSION,
      status: ScenarioStatus.ACTIVE,
      automated: false,
      projectId: project.id
    }
  });

  if ((await prisma.scenarioStep.count({ where: { scenarioId: manualScenario.id } })) === 0) {
    await prisma.scenarioStep.createMany({
      data: [
        { scenarioId: manualScenario.id, order: 1, action: StepAction.NAVIGATE, description: 'Acessar o dashboard autenticado', value: '/dashboard' },
        { scenarioId: manualScenario.id, order: 2, action: StepAction.ASSERT_VISIBLE, description: 'Conferir indicadores e navegação principal', target: 'main' }
      ]
    });
  }

  const smokeSuite = await prisma.testSuite.upsert({
    where: { code: 'SUITE-001' },
    update: {},
    create: {
      code: 'SUITE-001',
      name: 'Smoke crítico',
      description: 'Cenários essenciais para validar rapidamente uma nova versão.',
      projectId: project.id,
      createdById: admin.id
    }
  });

  await prisma.testSuiteScenario.upsert({
    where: { suiteId_scenarioId: { suiteId: smokeSuite.id, scenarioId: scenario.id } },
    update: { order: 1 },
    create: { suiteId: smokeSuite.id, scenarioId: scenario.id, order: 1 }
  });
  await prisma.testSuiteScenario.upsert({
    where: { suiteId_scenarioId: { suiteId: smokeSuite.id, scenarioId: manualScenario.id } },
    update: { order: 2 },
    create: { suiteId: smokeSuite.id, scenarioId: manualScenario.id, order: 2 }
  });

  const releasePlan = await prisma.testPlan.upsert({
    where: { code: 'PLAN-001' },
    update: {},
    create: {
      code: 'PLAN-001',
      name: 'Validação da versão 1.0',
      description: 'Plano demonstrativo para validação funcional e regressão do MVP.',
      objective: 'Comprovar que os fluxos críticos estão prontos para apresentação.',
      releaseVersion: '1.0.0',
      status: 'ACTIVE',
      projectId: project.id,
      createdById: admin.id
    }
  });

  await prisma.testPlanSuite.upsert({
    where: { planId_suiteId: { planId: releasePlan.id, suiteId: smokeSuite.id } },
    update: { order: 1 },
    create: { planId: releasePlan.id, suiteId: smokeSuite.id, order: 1 }
  });

  const releaseCycle = await prisma.testCycle.upsert({
    where: { code: 'CYCLE-001' },
    update: {},
    create: {
      code: 'CYCLE-001',
      name: 'Smoke local da versão 1.0',
      description: 'Ciclo de demonstração preparado para execução em Chromium.',
      browser: 'chromium',
      planId: releasePlan.id,
      environmentId: environment.id,
      createdById: admin.id
    }
  });

  await prisma.testCycleScenario.upsert({
    where: { cycleId_scenarioId: { cycleId: releaseCycle.id, scenarioId: scenario.id } },
    update: { order: 1 },
    create: { cycleId: releaseCycle.id, scenarioId: scenario.id, order: 1 }
  });
  await prisma.testCycleScenario.upsert({
    where: { cycleId_scenarioId: { cycleId: releaseCycle.id, scenarioId: manualScenario.id } },
    update: { order: 2 },
    create: { cycleId: releaseCycle.id, scenarioId: manualScenario.id, order: 2 }
  });

  const baselineCycle = await prisma.testCycle.upsert({
    where: { code: 'CYCLE-HIST-001' },
    update: { status: 'COMPLETED' },
    create: {
      code: 'CYCLE-HIST-001',
      name: 'Baseline estável da versão 0.9',
      description: 'Rodada histórica usada como referência para comparação.',
      status: 'COMPLETED',
      browser: 'chromium',
      plannedStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      plannedEnd: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      finishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      planId: releasePlan.id,
      environmentId: environment.id,
      createdById: admin.id,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    }
  });
  const regressionCycle = await prisma.testCycle.upsert({
    where: { code: 'CYCLE-HIST-002' },
    update: { status: 'COMPLETED' },
    create: {
      code: 'CYCLE-HIST-002',
      name: 'Regressão da versão 1.0 RC',
      description: 'Rodada histórica com uma regressão identificada no login.',
      status: 'COMPLETED',
      browser: 'chromium',
      plannedStart: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      plannedEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      finishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      planId: releasePlan.id,
      environmentId: environment.id,
      createdById: admin.id,
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    }
  });

  for (const [cycleId, automatedResult, manualResult] of [
    [baselineCycle.id, 'PASSED', 'PASSED'],
    [regressionCycle.id, 'FAILED', 'PASSED']
  ] as const) {
    await prisma.testCycleScenario.upsert({
      where: { cycleId_scenarioId: { cycleId, scenarioId: scenario.id } },
      update: { order: 1, result: automatedResult, executedById: admin.id },
      create: { cycleId, scenarioId: scenario.id, order: 1, result: automatedResult, executedById: admin.id, executedAt: new Date() }
    });
    await prisma.testCycleScenario.upsert({
      where: { cycleId_scenarioId: { cycleId, scenarioId: manualScenario.id } },
      update: { order: 2, result: manualResult, executedById: admin.id },
      create: { cycleId, scenarioId: manualScenario.id, order: 2, result: manualResult, executedById: admin.id, executedAt: new Date() }
    });
  }

  const existingBugs = await prisma.bug.count();
  if (existingBugs === 0) {
    await prisma.bug.createMany({
      data: [
        {
          code: 'BUG-1001',
          title: 'Checkout exibe valor incorreto no frete',
          description: 'O total do pedido não considera o cupom aplicado ao frete.',
          reproduction: '1. Adicionar produto ao carrinho\n2. Aplicar cupom FRETEGRATIS\n3. Avançar para pagamento',
          expectedResult: 'Frete deve ser zerado no total.',
          actualResult: 'Frete permanece somado ao pedido.',
          severity: Severity.HIGH,
          priority: Priority.URGENT,
          environment: 'Homologação',
          browser: 'Chrome',
          status: BugStatus.IN_PROGRESS,
          reporterId: admin.id,
          assigneeId: analyst.id,
          projectId: project.id
        },
        {
          code: 'BUG-1002',
          title: 'Campo de telefone aceita caracteres especiais',
          description: 'A validação permite letras e símbolos no telefone.',
          severity: Severity.MEDIUM,
          priority: Priority.MEDIUM,
          environment: 'Produção',
          browser: 'Firefox',
          status: BugStatus.OPEN,
          reporterId: analyst.id,
          assigneeId: analyst.id,
          projectId: project.id
        },
        {
          code: 'BUG-1003',
          title: 'Sessão não expira após período de inatividade',
          description: 'Usuário continua autenticado após o limite de segurança.',
          severity: Severity.CRITICAL,
          priority: Priority.HIGH,
          environment: 'Homologação',
          browser: 'Todos',
          status: BugStatus.IN_REVIEW,
          reporterId: admin.id,
          assigneeId: admin.id,
          projectId: project.id,
          scenarioId: scenario.id
        },
        {
          code: 'BUG-1004',
          title: 'Alinhamento do botão salvar em telas pequenas',
          description: 'Botão ultrapassa a área visível em 320px.',
          severity: Severity.LOW,
          priority: Priority.LOW,
          environment: 'Desenvolvimento',
          browser: 'Safari iOS',
          status: BugStatus.RESOLVED,
          reporterId: analyst.id,
          assigneeId: analyst.id,
          projectId: project.id
        }
      ]
    });
  } else {
    await prisma.bug.updateMany({
      where: { projectId: null },
      data: { projectId: project.id }
    });
  }

  if ((await prisma.testExecution.count()) === 0) {
    const execution = await prisma.testExecution.create({
      data: {
        code: 'EXEC-00125',
        status: ExecutionStatus.FAILED,
        browser: 'chromium',
        durationMs: 9200,
        timeoutMs: 60000,
        screenshotMode: 'FAILURE',
        captureVideo: true,
        captureTrace: true,
        captureConsole: true,
        captureNetwork: true,
        retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        progress: 100,
        errorMessage: 'Timeout aguardando a navegação para /dashboard.',
        scenarioId: scenario.id,
        environmentId: environment.id,
        projectId: project.id,
        createdById: analyst.id,
        startedAt: new Date(Date.now() - 9200),
        finishedAt: new Date(),
        steps: {
          create: [
            { order: 1, action: StepAction.NAVIGATE, description: 'Acessar a página de login', status: ExecutionStepStatus.PASSED, durationMs: 820, actual: 'http://localhost:5173/login' },
            { order: 2, action: StepAction.FILL, description: 'Preencher o campo E-mail', status: ExecutionStepStatus.PASSED, durationMs: 130, actual: 'admin@qatracker.dev' },
            { order: 3, action: StepAction.FILL, description: 'Preencher o campo Senha', status: ExecutionStepStatus.PASSED, durationMs: 110, actual: '[VALOR PROTEGIDO]' },
            { order: 4, action: StepAction.CLICK, description: 'Clicar no botão Entrar', status: ExecutionStepStatus.PASSED, durationMs: 240, actual: 'Clique concluído.' },
            {
              order: 5,
              action: StepAction.ASSERT_URL,
              description: 'Validar que o dashboard foi apresentado',
              status: ExecutionStepStatus.FAILED,
              durationMs: 5000,
              expected: '/dashboard',
              actual: 'http://localhost:5173/login',
              error: 'URL esperada /dashboard não foi apresentada.'
            }
          ]
        },
        logs: {
          create: [
            { level: 'INFO', message: 'Execução de demonstração iniciada.' },
            { level: 'ERROR', message: 'Execução concluída com falha.', stepOrder: 5 }
          ]
        }
      }
    });

    await prisma.bug.update({
      where: { code: 'BUG-1003' },
      data: { executionId: execution.id }
    });
  }

  await prisma.testExecution.updateMany({
    where: { status: { in: ['PASSED', 'FAILED', 'BLOCKED'] } },
    data: { progress: 100 }
  });

  await prisma.testExecution.updateMany({
    where: { retentionUntil: null },
    data: { retentionUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
  });

  console.log('Banco preparado. Login: admin@qatracker.dev / Qa@123456');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
