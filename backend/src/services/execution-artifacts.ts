import type { EvidenceType } from '@prisma/client';
import { mkdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';

const storageRoot = resolve(fileURLToPath(new URL('../../storage/executions/', import.meta.url)));

function safeCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function safeFilename(name: string) {
  const extension = extname(name).toLowerCase();
  const base = name.slice(0, extension ? -extension.length : undefined)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'evidencia';
  return `${base}-${randomUUID().slice(0, 8)}${extension}`;
}

function assertInsideStorage(filePath: string) {
  const pathFromRoot = relative(storageRoot, filePath);
  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new Error('Caminho de evidência inválido.');
  }
}

export async function prepareExecutionDirectory(code: string) {
  const directory = resolve(storageRoot, safeCode(code));
  assertInsideStorage(directory);
  await mkdir(directory, { recursive: true });
  return directory;
}

export function executionArtifactPath(code: string, filename: string) {
  return join(storageRoot, safeCode(code), filename);
}

export function executionArtifactUrl(code: string, filename: string) {
  return `/evidences/executions/${safeCode(code)}/${filename}`;
}

export async function registerEvidence(input: {
  executionId: number;
  executionCode: string;
  type: EvidenceType;
  name: string;
  filename: string;
  mimeType: string;
  description?: string;
  stepOrder?: number;
  uploadedById?: number;
}) {
  const filePath = executionArtifactPath(input.executionCode, input.filename);
  const fileStat = await stat(filePath);
  return prisma.executionEvidence.create({
    data: {
      executionId: input.executionId,
      type: input.type,
      name: input.name,
      path: executionArtifactUrl(input.executionCode, input.filename),
      mimeType: input.mimeType,
      sizeBytes: Number(fileStat.size),
      description: input.description,
      stepOrder: input.stepOrder,
      uploadedById: input.uploadedById
    }
  });
}

export async function writeJsonEvidence(input: {
  executionId: number;
  executionCode: string;
  type: 'CONSOLE' | 'NETWORK';
  name: string;
  filename: string;
  content: unknown;
  description?: string;
}) {
  await prepareExecutionDirectory(input.executionCode);
  await writeFile(
    executionArtifactPath(input.executionCode, input.filename),
    JSON.stringify(input.content, null, 2),
    'utf8'
  );
  return registerEvidence({
    ...input,
    mimeType: 'application/json'
  });
}

export async function saveManualEvidence(input: {
  executionId: number;
  executionCode: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  description?: string;
  uploadedById: number;
}) {
  const filename = safeFilename(input.originalName);
  await prepareExecutionDirectory(input.executionCode);
  await writeFile(executionArtifactPath(input.executionCode, filename), input.buffer);
  return registerEvidence({
    executionId: input.executionId,
    executionCode: input.executionCode,
    type: 'MANUAL',
    name: input.originalName,
    filename,
    mimeType: input.mimeType || 'application/octet-stream',
    description: input.description,
    uploadedById: input.uploadedById
  });
}

function resolveStoredPath(urlPath: string) {
  const relativeUrl = urlPath.replace(/^\/evidences\/executions\//, '');
  const filePath = resolve(storageRoot, ...relativeUrl.split('/'));
  assertInsideStorage(filePath);
  return filePath;
}

export async function deleteEvidenceFile(path: string) {
  await unlink(resolveStoredPath(path)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

export async function purgeExpiredEvidences() {
  const expired = await prisma.testExecution.findMany({
    where: {
      retentionUntil: { lt: new Date() },
      evidences: { some: {} }
    },
    select: { id: true, code: true }
  });

  for (const execution of expired) {
    const directory = resolve(storageRoot, safeCode(execution.code));
    assertInsideStorage(directory);
    await rm(directory, { recursive: true, force: true });
    await prisma.$transaction([
      prisma.executionEvidence.deleteMany({ where: { executionId: execution.id } }),
      prisma.testExecution.update({
        where: { id: execution.id },
        data: { screenshotPath: null }
      })
    ]);
  }
  return expired.length;
}
