import type { WebhookEvent } from "../types/webhook";

const seenEvents = new Set<string>();

export function isDuplicate(event: WebhookEvent) : boolean {
    const key = `${event.source}:${event.id}`;
    if (seenEvents.has(key)) {
        return true;
    }
    seenEvents.add(key);
    return false;
}