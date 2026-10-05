import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

const tokenPrefix = 'qtk_';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createProjectApiKeyValue() {
  const token = `${tokenPrefix}${randomBytes(32).toString('base64url')}`;
  return {
    token,
    prefix: token.slice(0, 12),
    keyHash: hashToken(token)
  };
}

export async function authenticateProjectApiKey(value?: string) {
  if (!value?.startsWith(tokenPrefix)) throw new HttpError(401, 'Chave de integração necessária.');
  const key = await prisma.projectApiKey.findUnique({
    where: { keyHash: hashToken(value) },
    include: {
      project: { select: { id: true, code: true, name: true } },
      createdBy: { select: { active: true } }
    }
  });
  if (!key || !key.createdBy.active || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date())) {
    throw new HttpError(401, 'Chave de integração inválida, expirada ou revogada.');
  }
  await prisma.projectApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key;
}
