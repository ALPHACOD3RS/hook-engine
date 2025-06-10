export interface WebhookAdapter {
    getSignature(req: any) : string | undefined;
    verifySignature(rawBody: Buffer, signature: string, secret: string) : boolean;
    parsePayload(rawBody: Buffer) : any;
    normalize(event: any) : {
        id: string;
        type: string;
        source: string;
        timestamp: number;
        payload: Record<string, any>;
        // raw: string;
    }
}