import { prisma } from './lib/prisma.js';
import { purgeExpiredEvidences } from './services/execution-artifacts.js';
import { claimNextExecution, recoverInterruptedExecutions } from './services/execution-queue.js';
import { executeQueuedScenario } from './services/scenario-runner.js';

let shuttingDown = false;
let processing = false;

async function processQueue() {
  if (processing || shuttingDown) return;
  processing = true;
  try {
    const executionId = await claimNextExecution();
    if (executionId) await executeQueuedScenario(executionId);
  } catch (error) {
    console.error('Falha no worker de execuções:', error);
  } finally {
    processing = false;
  }
}

async function start() {
  const recovered = await recoverInterruptedExecutions();
  const purged = await purgeExpiredEvidences();
  console.log(`Worker de execuções disponível.${recovered ? ` ${recovered} execução(ões) recuperada(s).` : ''}${purged ? ` ${purged} pacote(s) de evidências expirado(s) removido(s).` : ''}`);
  await processQueue();
  const timer = setInterval(() => {
    void processQueue();
  }, 750);
  const retentionTimer = setInterval(() => {
    void purgeExpiredEvidences().catch((error) => console.error('Falha ao aplicar retenção:', error));
  }, 60 * 60 * 1000);

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(timer);
    clearInterval(retentionTimer);
    while (processing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void start().catch(async (error) => {
  console.error('Não foi possível iniciar o worker:', error);
  await prisma.$disconnect();
  process.exit(1);
});
