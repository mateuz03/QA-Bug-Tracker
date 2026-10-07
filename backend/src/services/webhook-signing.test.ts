import { describe, expect, it } from 'vitest';
import { HttpError } from '../utils/http-error.js';
import { createWebhookSignature, verifyWebhookSignature } from './webhook-signing.js';

describe('assinatura de webhook', () => {
  const secret = 'qwh_secret_for_tests';
  const timestamp = '1760000000';
  const rawBody = Buffer.from('{"event":"execution.completed"}');

  it('aceita uma assinatura HMAC válida dentro da janela de tempo', () => {
    expect(() => verifyWebhookSignature({
      secret,
      timestamp,
      signature: createWebhookSignature(secret, timestamp, rawBody),
      rawBody,
      now: 1_760_000_100_000
    })).not.toThrow();
  });

  it('rejeita corpo alterado mesmo com assinatura válida do conteúdo original', () => {
    expect(() => verifyWebhookSignature({
      secret,
      timestamp,
      signature: createWebhookSignature(secret, timestamp, rawBody),
      rawBody: Buffer.from('{"event":"tampered"}'),
      now: 1_760_000_100_000
    })).toThrow(HttpError);
  });

  it('rejeita entregas fora da janela de cinco minutos', () => {
    expect(() => verifyWebhookSignature({
      secret,
      timestamp,
      signature: createWebhookSignature(secret, timestamp, rawBody),
      rawBody,
      now: 1_760_000_301_000
    })).toThrow('Webhook expirado');
  });
});
