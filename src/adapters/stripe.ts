import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

const stripe: WebhookAdapter = {
  getSignature(req) {
    return req.headers["stripe-signature"] as string | undefined;
  },

  verifySignature(rawBody, sigHeader, secret) {
    if (!sigHeader) return false;

    try {
      const timestamp = sigHeader.split(',')[0].split('=')[1];
      const signature = sigHeader.split(',')[1].split('=')[1];
      
      if (!timestamp || !signature) return false;

      const signedPayload = `${timestamp}.${rawBody}`;
      const expected = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  },

  parsePayload(body) {
    return JSON.parse(body.toString("utf8"));
  },

  normalize(event, options) {
    return {
      id: event.id,
      type: event.type,
      source: "stripe",
      timestamp: event.created ?? Math.floor(Date.now() / 1000),
      payload: event.data?.object ?? {},
      raw: options?.includeRaw ? JSON.stringify(event) : '',
    };
  },
};

export default stripe;
