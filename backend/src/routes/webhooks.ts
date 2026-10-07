import { Router } from 'express';
import { z } from 'zod';
import { processWebhookExecutionResult, recordWebhookError } from '../services/webhook-events.js';
import { authenticateProjectWebhook, payloadHash, verifyWebhookSignature } from '../services/webhook-signing.js';

export const webhooksRouter = Router();

const resultSchema = z.object({
  event: z.literal('execution.completed'),
  executionCode: z.string().trim().regex(/^EXEC-\d+$/, 'Informe um código de execução válido.'),
  status: z.enum(['PASSED', 'FAILED', 'BLOCKED', 'CANCELLED']),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  errorMessage: z.string().trim().max(5000).optional()
});

webhooksRouter.post('/projects/:projectId/pipeline', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.projectId);
  const deliveryId = z.string().trim().regex(/^[A-Za-z0-9_-]{8,120}$/, 'Identificador de entrega inválido.')
    .parse(req.header('x-qa-delivery'));
  const webhook = await authenticateProjectWebhook(projectId);
  verifyWebhookSignature({
    secret: webhook.secret,
    timestamp: req.header('x-qa-timestamp') ?? undefined,
    signature: req.header('x-qa-signature-256') ?? undefined,
    rawBody: req.rawBody
  });

  try {
    const result = resultSchema.parse(req.body);
    const processed = await processWebhookExecutionResult({
      projectId,
      webhookId: webhook.id,
      actorId: webhook.createdById,
      deliveryId,
      payloadHash: payloadHash(req.rawBody!),
      result
    });
    res.status(processed.duplicate ? 200 : 202).json({
      accepted: true,
      duplicate: processed.duplicate,
      executionCode: processed.code
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar o webhook.';
    await recordWebhookError(webhook.id, message);
    throw error;
  }
});
