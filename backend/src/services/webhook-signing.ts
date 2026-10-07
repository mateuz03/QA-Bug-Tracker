import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { decryptSecret } from './secret-crypto.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

const signaturePrefix = 'sha256=';
const maxTimestampAgeMs = 5 * 60 * 1000;

export function createWebhookSecret() {
  return `qwh_${randomBytes(32).toString('base64url')}`;
}

export function createWebhookSignature(secret: string, timestamp: string, rawBody: Buffer) {
  const digest = createHmac('sha256', secret)
    .update(timestamp)
    .update('.')
    .update(rawBody)
    .digest('hex');
  return `${signaturePrefix}${digest}`;
}

export function payloadHash(rawBody: Buffer) {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp?: string;
  signature?: string;
  rawBody?: Buffer;
  now?: number;
}) {
  const timestamp = input.timestamp?.trim();
  if (!timestamp || !/^\d{10,13}$/.test(timestamp)) throw new HttpError(401, 'Timestamp do webhook inválido.');
  const timestampMs = Number(timestamp.length === 10 ? `${timestamp}000` : timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs((input.now ?? Date.now()) - timestampMs) > maxTimestampAgeMs) {
    throw new HttpError(401, 'Webhook expirado ou com horário inválido.');
  }
  if (!input.rawBody || !input.signature?.startsWith(signaturePrefix)) {
    throw new HttpError(401, 'Assinatura do webhook inválida.');
  }
  const expected = Buffer.from(createWebhookSignature(input.secret, timestamp, input.rawBody));
  const received = Buffer.from(input.signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new HttpError(401, 'Assinatura do webhook inválida.');
  }
}

export async function authenticateProjectWebhook(projectId: number) {
  const webhook = await prisma.projectWebhook.findUnique({ where: { projectId } });
  if (!webhook?.enabled) throw new HttpError(401, 'Webhook inválido ou desativado.');
  return {
    ...webhook,
    secret: decryptSecret({
      encrypted: webhook.secretEncrypted,
      iv: webhook.secretIv,
      tag: webhook.secretTag
    })
  };
}
