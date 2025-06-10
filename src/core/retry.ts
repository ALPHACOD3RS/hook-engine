import type { WebhookEvent } from "../types/webhook";

export async function retry(
  event: WebhookEvent,
  fn: () => Promise<void>,
  maxAttempts = 3
): Promise<void> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      await fn();
      return;
    } catch (err) {
      attempt++;
      console.warn(`🔁 Retry ${attempt}/${maxAttempts} for ${event.id}`);

      if (attempt >= maxAttempts) {
        console.error(`❌ Final failure for ${event.id}:`, err);
        throw err;
      }

      const delay = Math.pow(2, attempt) * 100; // Exponential backoff
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}
