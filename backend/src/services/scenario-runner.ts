import type { Browser, BrowserContext, Page, Video } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import { basename } from 'node:path';
import { prisma } from '../lib/prisma.js';
import {
  executionArtifactPath,
  executionArtifactUrl,
  prepareExecutionDirectory,
  registerEvidence,
  writeJsonEvidence
} from './execution-artifacts.js';
import { appendExecutionLog } from './execution-queue.js';

class StepResultError extends Error {
  constructor(message: string, public readonly actual: string) {
    super(message);
  }
}

function resolveUrl(baseUrl: string, value?: string | null) {
  if (!value) return baseUrl;
  return new URL(value, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function truncate(value: string | null | undefined, size = 1000) {
  if (!value) return '';
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

async function performStep(
  page: Page,
  baseUrl: string,
  step: {
    action: string;
    target: string | null;
    value: string | null;
    expected: string | null;
  },
  timeoutMs: number
) {
  switch (step.action) {
    case 'NAVIGATE':
      await page.goto(resolveUrl(baseUrl, step.value), {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });
      return page.url();
    case 'FILL': {
      if (!step.target) throw new Error('Seletor não informado para preenchimento.');
      await page.locator(step.target).fill(step.value ?? '', { timeout: timeoutMs });
      if (/password|senha/i.test(step.target)) return '[VALOR PROTEGIDO]';
      return truncate(await page.locator(step.target).inputValue({ timeout: timeoutMs }));
    }
    case 'CLICK':
      if (!step.target) throw new Error('Seletor não informado para clique.');
      await page.locator(step.target).click({ timeout: timeoutMs });
      return `Clique concluído. URL atual: ${page.url()}`;
    case 'SELECT':
      if (!step.target) throw new Error('Seletor não informado para seleção.');
      await page.locator(step.target).selectOption(step.value ?? '', { timeout: timeoutMs });
      return truncate(await page.locator(step.target).inputValue({ timeout: timeoutMs }));
    case 'CHECK':
      if (!step.target) throw new Error('Seletor não informado para marcação.');
      await page.locator(step.target).check({ timeout: timeoutMs });
      return (await page.locator(step.target).isChecked({ timeout: timeoutMs })) ? 'Marcado' : 'Não marcado';
    case 'ASSERT_TEXT': {
      const content = await page.locator(step.target || 'body').textContent({ timeout: timeoutMs });
      const expected = step.expected ?? step.value ?? '';
      const actual = truncate(content);
      if (!content?.includes(expected)) {
        throw new StepResultError(`Texto esperado não encontrado: ${expected}.`, actual || 'Nenhum texto encontrado.');
      }
      return `Texto encontrado: ${expected}`;
    }
    case 'ASSERT_VISIBLE': {
      if (!step.target) throw new StepResultError('Seletor não informado para validação.', 'Seletor ausente.');
      const visible = await page.locator(step.target).isVisible({ timeout: timeoutMs });
      if (!visible) throw new StepResultError(`Elemento não está visível: ${step.target}.`, 'Elemento não visível.');
      return `Elemento visível: ${step.target}`;
    }
    case 'ASSERT_URL': {
      const expected = step.expected ?? step.value ?? '';
      try {
        await page.waitForURL((url) => url.toString().includes(expected), { timeout: timeoutMs });
      } catch {
        throw new StepResultError(`URL esperada não encontrada: ${expected}.`, page.url());
      }
      return page.url();
    }
    default:
      throw new Error(`Ação ${step.action} ainda não é executável pelo worker.`);
  }
}

async function captureScreenshot(input: {
  page: Page;
  executionId: number;
  executionCode: string;
  stepOrder: number;
  failed: boolean;
}) {
  const filename = `passo-${String(input.stepOrder).padStart(2, '0')}-${input.failed ? 'falha' : 'aprovado'}.png`;
  await input.page.screenshot({
    path: executionArtifactPath(input.executionCode, filename),
    fullPage: true,
    timeout: 5000
  });
  await registerEvidence({
    executionId: input.executionId,
    executionCode: input.executionCode,
    type: 'SCREENSHOT',
    name: input.failed ? `Screenshot da falha no passo ${input.stepOrder}` : `Screenshot do passo ${input.stepOrder}`,
    filename,
    mimeType: 'image/png',
    description: input.failed ? 'Captura automática realizada na falha.' : 'Captura automática após aprovação.',
    stepOrder: input.stepOrder
  });
  return executionArtifactUrl(input.executionCode, filename);
}

export async function executeQueuedScenario(executionId: number) {
  const execution = await prisma.testExecution.findUnique({
    where: { id: executionId },
    include: {
      scenario: { include: { steps: { orderBy: { order: 'asc' } } } },
      environment: true
    }
  });
  if (!execution || execution.status !== 'RUNNING') return;

  const started = Date.now();
  let browserInstance: Browser | null = null;
  let context: BrowserContext | null = null;
  let video: Video | null = null;
  let tracing = false;
  let browserStarted = false;
  let failedMessage: string | null = null;
  let screenshotPath: string | null = null;
  let cancelled = false;
  let cancellationCheckRunning = false;
  const consoleEvents: Array<Record<string, unknown>> = [];
  const networkEvents: Array<Record<string, unknown>> = [];

  await prepareExecutionDirectory(execution.code);

  const cancellationTimer = setInterval(() => {
    if (cancellationCheckRunning || cancelled) return;
    cancellationCheckRunning = true;
    void prisma.testExecution.findUnique({
      where: { id: execution.id },
      select: { status: true }
    }).then(async (current) => {
      if (current?.status === 'CANCELLED') {
        cancelled = true;
        await browserInstance?.close().catch(() => undefined);
      }
    }).finally(() => {
      cancellationCheckRunning = false;
    });
  }, 500);

  try {
    await appendExecutionLog(execution.id, `Abrindo ${execution.browser}.`);
    const browserType = execution.browser === 'firefox'
      ? firefox
      : execution.browser === 'webkit'
        ? webkit
        : chromium;
    browserInstance = await browserType.launch({
      headless: true,
      timeout: Math.min(execution.timeoutMs, 30_000)
    });
    browserStarted = true;
    context = await browserInstance.newContext({
      ...(execution.captureVideo
        ? {
            recordVideo: {
              dir: await prepareExecutionDirectory(execution.code),
              size: { width: 1280, height: 720 }
            }
          }
        : {})
    });
    if (execution.captureTrace) {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      tracing = true;
    }
    const page = await context.newPage();
    video = page.video();

    if (execution.captureConsole) {
      page.on('console', (message) => {
        if (consoleEvents.length >= 2000) return;
        consoleEvents.push({
          timestamp: new Date().toISOString(),
          type: message.type(),
          text: message.text(),
          location: message.location()
        });
      });
      page.on('pageerror', (error) => {
        if (consoleEvents.length >= 2000) return;
        consoleEvents.push({
          timestamp: new Date().toISOString(),
          type: 'pageerror',
          text: error.message,
          stack: error.stack
        });
      });
    }
    if (execution.captureNetwork) {
      page.on('response', (response) => {
        if (networkEvents.length >= 3000) return;
        networkEvents.push({
          timestamp: new Date().toISOString(),
          type: 'response',
          method: response.request().method(),
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          ok: response.ok()
        });
      });
      page.on('requestfailed', (request) => {
        if (networkEvents.length >= 3000) return;
        networkEvents.push({
          timestamp: new Date().toISOString(),
          type: 'requestfailed',
          method: request.method(),
          url: request.url(),
          error: request.failure()?.errorText
        });
      });
    }

    for (const [index, step] of execution.scenario.steps.entries()) {
      const current = await prisma.testExecution.findUnique({
        where: { id: execution.id },
        select: { status: true }
      });
      if (current?.status === 'CANCELLED') {
        cancelled = true;
        break;
      }

      const elapsed = Date.now() - started;
      const remainingExecutionMs = execution.timeoutMs - elapsed;
      if (remainingExecutionMs <= 0) {
        failedMessage = `Tempo limite do cenário excedido (${execution.timeoutMs} ms).`;
        await appendExecutionLog(execution.id, failedMessage, 'ERROR', step.order);
        break;
      }

      const stepTimeoutMs = Math.min(step.timeoutMs ?? 15_000, remainingExecutionMs);
      const stepStarted = Date.now();
      await prisma.testExecution.update({
        where: { id: execution.id },
        data: {
          currentStep: step.order,
          progress: Math.round((index / execution.scenario.steps.length) * 100),
          heartbeatAt: new Date()
        }
      });
      await prisma.executionStep.update({
        where: { executionId_order: { executionId: execution.id, order: step.order } },
        data: { startedAt: new Date() }
      });
      await appendExecutionLog(execution.id, `Passo ${step.order} iniciado: ${step.description}`, 'INFO', step.order);

      try {
        const actual = await performStep(page, execution.environment.baseUrl, step, stepTimeoutMs);
        const durationMs = Date.now() - stepStarted;
        await prisma.executionStep.update({
          where: { executionId_order: { executionId: execution.id, order: step.order } },
          data: {
            status: 'PASSED',
            durationMs,
            actual,
            finishedAt: new Date()
          }
        });
        if (execution.screenshotMode === 'ALL') {
          await captureScreenshot({
            page,
            executionId: execution.id,
            executionCode: execution.code,
            stepOrder: step.order,
            failed: false
          });
        }
        await appendExecutionLog(execution.id, `Passo ${step.order} aprovado em ${durationMs} ms.`, 'INFO', step.order);
      } catch (error) {
        const currentStatus = await prisma.testExecution.findUnique({
          where: { id: execution.id },
          select: { status: true }
        });
        if (cancelled || currentStatus?.status === 'CANCELLED') {
          cancelled = true;
          break;
        }

        failedMessage = error instanceof Error ? error.message : 'Falha desconhecida.';
        const actual = error instanceof StepResultError ? error.actual : `URL atual: ${page.url()}`;
        const durationMs = Date.now() - stepStarted;
        await prisma.executionStep.update({
          where: { executionId_order: { executionId: execution.id, order: step.order } },
          data: {
            status: 'FAILED',
            durationMs,
            error: failedMessage,
            actual,
            finishedAt: new Date()
          }
        });
        await appendExecutionLog(execution.id, `Passo ${step.order} reprovado: ${failedMessage}`, 'ERROR', step.order);
        if (execution.screenshotMode !== 'NONE') {
          screenshotPath = await captureScreenshot({
            page,
            executionId: execution.id,
            executionCode: execution.code,
            stepOrder: step.order,
            failed: true
          }).catch(() => null);
        }
        break;
      }
    }
  } catch (error) {
    if (!cancelled) {
      const detail = error instanceof Error ? error.message : 'Falha desconhecida.';
      failedMessage = browserStarted
        ? detail
        : `Não foi possível iniciar o navegador ${execution.browser}: ${detail}`;
      await appendExecutionLog(execution.id, failedMessage, 'ERROR');
    }
  } finally {
    clearInterval(cancellationTimer);

    if (tracing && context) {
      const filename = 'trace.zip';
      await context.tracing.stop({ path: executionArtifactPath(execution.code, filename) })
        .then(() => registerEvidence({
          executionId: execution.id,
          executionCode: execution.code,
          type: 'TRACE',
          name: 'Trace Playwright',
          filename,
          mimeType: 'application/zip',
          description: 'Trace interativo com snapshots, rede e fontes.'
        }))
        .catch(() => undefined);
    }
    await context?.close().catch(() => undefined);

    if (execution.captureVideo && video) {
      await video.path()
        .then((videoPath) => registerEvidence({
          executionId: execution.id,
          executionCode: execution.code,
          type: 'VIDEO',
          name: 'Vídeo da execução',
          filename: basename(videoPath),
          mimeType: 'video/webm',
          description: 'Gravação completa da execução no navegador.'
        }))
        .catch(() => undefined);
    }
    await browserInstance?.close().catch(() => undefined);

    if (execution.captureConsole) {
      await writeJsonEvidence({
        executionId: execution.id,
        executionCode: execution.code,
        type: 'CONSOLE',
        name: 'Console do navegador',
        filename: 'console.json',
        content: consoleEvents,
        description: `${consoleEvents.length} evento(s) de console e erro de página.`
      }).catch(() => undefined);
    }
    if (execution.captureNetwork) {
      await writeJsonEvidence({
        executionId: execution.id,
        executionCode: execution.code,
        type: 'NETWORK',
        name: 'Tráfego de rede',
        filename: 'network.json',
        content: networkEvents,
        description: `${networkEvents.length} resposta(s) e falha(s) de rede.`
      }).catch(() => undefined);
    }
  }

  const current = await prisma.testExecution.findUnique({
    where: { id: execution.id },
    select: { status: true }
  });
  cancelled = cancelled || current?.status === 'CANCELLED';

  if (cancelled) {
    await prisma.executionStep.updateMany({
      where: { executionId: execution.id, status: 'PENDING' },
      data: { status: 'SKIPPED', finishedAt: new Date() }
    });
    await appendExecutionLog(execution.id, 'Execução cancelada pelo usuário.', 'WARN');
    await prisma.testExecution.update({
      where: { id: execution.id },
      data: {
        status: 'CANCELLED',
        durationMs: Date.now() - started,
        currentStep: null,
        heartbeatAt: new Date(),
        finishedAt: new Date()
      }
    });
    return;
  }

  if (failedMessage) {
    await prisma.executionStep.updateMany({
      where: { executionId: execution.id, status: 'PENDING' },
      data: { status: 'SKIPPED', finishedAt: new Date() }
    });
  }

  const finalStatus = failedMessage ? 'FAILED' : 'PASSED';
  await appendExecutionLog(
    execution.id,
    finalStatus === 'PASSED' ? 'Execução concluída com sucesso.' : 'Execução concluída com falha.',
    finalStatus === 'PASSED' ? 'INFO' : 'ERROR'
  );
  await prisma.testExecution.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      progress: 100,
      currentStep: null,
      heartbeatAt: new Date(),
      durationMs: Date.now() - started,
      errorMessage: failedMessage,
      screenshotPath,
      finishedAt: new Date()
    }
  });
}
