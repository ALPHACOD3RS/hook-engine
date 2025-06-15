import stripe from './stripe';
import github from './github';
import discord from './discord';
import shopify from './shopify';
import paypal from './paypal';
import twilio from './twilio';
import sendgrid from './sendgrid';
import generic, { createGenericAdapter } from './generic';
import type { WebhookAdapter } from '../types/adapter';

export const adapters: Record<string, WebhookAdapter> = {
    stripe,
    github,
    discord,
    shopify,
    paypal,
    twilio,
    sendgrid,
    generic,
}

export function getAdapter(source: string): WebhookAdapter | undefined {
    return adapters[source];
}

// Export the generic adapter factory for custom configurations
export { createGenericAdapter };

// Export all adapters for direct import if needed
export {
    stripe,
    github,
    discord,
    shopify,
    paypal,
    twilio,
    sendgrid,
    generic,
};