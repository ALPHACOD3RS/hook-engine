import stripe from './stripe';
import type { WebhookAdapter } from '../types/adapter';

export const adapters: Record<string, WebhookAdapter> = {
    stripe,
}

export function getAdapter(source: string) : WebhookAdapter | undefined {
    return adapters[source];
}