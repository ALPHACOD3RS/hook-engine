import { normalizeRequestBody } from "../utils/body";
import { getAdapter } from "../adapters";
import type { WebhookConfig } from "../types/config";
import type { WebhookEvent } from "../types/webhook";

export async function receiveWebhook(req: any, config: WebhookConfig): Promise<WebhookEvent> {
  const rawBody = await normalizeRequestBody(req);
  const adapter = getAdapter(config.source);

  if (!adapter) {
    throw new Error(`Unsupported webhook source: ${config.source}`);
  }

  const signature = adapter.getSignature(req);
  if (!signature) {
    throw new Error(`Missing signature header for source: ${config.source}`);
  }

  const isValid = adapter.verifySignature(rawBody, signature, config.secret);
  if (!isValid) {
    throw new Error("Webhook signature verification failed");
  }

  const parsed = adapter.parsePayload(rawBody);
  const normalized = adapter.normalize(parsed);

  return {
    id: normalized.id,
    type: normalized.type,
    timestamp: normalized.timestamp,
    source: config.source,
    payload: normalized.payload,
    raw: parsed,
  };
}
