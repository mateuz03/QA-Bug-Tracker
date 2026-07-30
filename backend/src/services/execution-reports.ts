import type { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';

export const executionReportInclude = {
  scenario: { include: { requirement: true } },
  project: true,
  environment: true,
  createdBy: { select: { id: true, name: true, email: true } },
  steps: { orderBy: { order: 'asc' as const } },
  evidences: { orderBy: { createdAt: 'asc' as const } }
} satisfies Prisma.TestExecutionInclude;

type ReportExecution = Prisma.TestExecutionGetPayload<{
  include: typeof executionReportInclude;
}>;

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function createExecutionCsv(execution: ReportExecution) {
  const rows = [
    ['Execução', execution.code],
    ['Status', execution.status],
    ['Projeto', `${execution.project.code} - ${execution.project.name}`],
    ['Cenário', `${execution.scenario.code} - ${execution.scenario.title}`],
    ['Requisito', execution.scenario.requirement?.code ?? 'Não vinculado'],
    ['Ambiente', `${execution.environment.name} - ${execution.environment.baseUrl}`],
    ['Navegador', execution.browser],
    ['Responsável', `${execution.createdBy.name} - ${execution.createdBy.email}`],
    ['Início', execution.startedAt?.toISOString() ?? ''],
    ['Fim', execution.finishedAt?.toISOString() ?? ''],
    ['Duração (ms)', execution.durationMs ?? ''],
    ['Erro', execution.errorMessage ?? '']
  ];
  const summary = rows.map((row) => row.map(csvCell).join(','));
  const steps = [
    '',
    ['Ordem', 'Ação', 'Descrição', 'Status', 'Esperado', 'Encontrado', 'Duração (ms)', 'Erro']
      .map(csvCell)
      .join(','),
    ...execution.steps.map((step) => [
      step.order,
      step.action,
      step.description,
      step.status,
      step.expected ?? '',
      step.actual ?? '',
      step.durationMs ?? '',
      step.error ?? ''
    ].map(csvCell).join(','))
  ];
  const evidences = [
    '',
    ['Evidência', 'Tipo', 'Arquivo', 'Tamanho (bytes)', 'Passo', 'Criada em']
      .map(csvCell)
      .join(','),
    ...execution.evidences.map((evidence) => [
      evidence.name,
      evidence.type,
      evidence.path,
      evidence.sizeBytes,
      evidence.stepOrder ?? '',
      evidence.createdAt.toISOString()
    ].map(csvCell).join(','))
  ];
  return `\uFEFF${[...summary, ...steps, ...evidences].join('\r\n')}`;
}

export async function createExecutionPdf(execution: ReportExecution) {
  const document = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `Relatório ${execution.code}` } });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  document.fillColor('#181620').fontSize(22).font('Helvetica-Bold').text('QA Truker');
  document.moveDown(0.25).fillColor('#7658f6').fontSize(11).text(`RELATÓRIO DE EXECUÇÃO · ${execution.code}`);
  document.moveDown(1);

  document.fillColor('#181620').fontSize(16).text(execution.scenario.title);
  document.moveDown(0.4).font('Helvetica').fontSize(10).fillColor('#5f5967');
  document.text(`Status: ${execution.status}`);
  document.text(`Projeto: ${execution.project.code} · ${execution.project.name}`);
  document.text(`Ambiente: ${execution.environment.name} · ${execution.environment.baseUrl}`);
  document.text(`Navegador: ${execution.browser}`);
  document.text(`Responsável: ${execution.createdBy.name} (${execution.createdBy.email})`);
  document.text(`Duração: ${execution.durationMs ?? 0} ms`);
  if (execution.errorMessage) {
    document.moveDown(0.5).fillColor('#ad3148').text(`Erro: ${execution.errorMessage}`);
  }

  document.moveDown(1.2).fillColor('#181620').font('Helvetica-Bold').fontSize(13).text('Resultado por passo');
  document.moveDown(0.4);
  for (const step of execution.steps) {
    if (document.y > 700) document.addPage();
    const color = step.status === 'PASSED' ? '#277f5c' : step.status === 'FAILED' ? '#b9354c' : '#77717f';
    document.fillColor(color).font('Helvetica-Bold').fontSize(10).text(`${step.order}. ${step.description} — ${step.status}`);
    document.fillColor('#5f5967').font('Helvetica').fontSize(9);
    document.text(`Ação: ${step.action} · Duração: ${step.durationMs ?? 0} ms`);
    if (step.expected) document.text(`Esperado: ${step.expected}`);
    if (step.actual) document.text(`Encontrado: ${step.actual}`);
    if (step.error) document.fillColor('#ad3148').text(`Erro: ${step.error}`);
    document.moveDown(0.65);
  }

  if (document.y > 650) document.addPage();
  document.fillColor('#181620').font('Helvetica-Bold').fontSize(13).text('Evidências');
  document.moveDown(0.4).fillColor('#5f5967').font('Helvetica').fontSize(9);
  if (execution.evidences.length === 0) {
    document.text('Nenhuma evidência vinculada.');
  } else {
    for (const evidence of execution.evidences) {
      document.text(`• ${evidence.name} (${evidence.type}) — ${evidence.sizeBytes} bytes`);
    }
  }

  document.moveDown(1.2).fillColor('#99939f').fontSize(8)
    .text(`Gerado em ${new Date().toLocaleString('pt-BR')} pelo QA Truker.`, { align: 'center' });
  document.end();
  return completed;
}
