export interface WebhookEvent  {
    id: string;
    type: string;
    source: string;
    timestamp: number;
    payload: Record<string, any>;
    raw: string;
}
