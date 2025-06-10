import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

const stripe: WebhookAdapter = {
  getSignature(req) {
    return req.headers["stripe-signature"] as string | undefined;
  },

  verifySignature(rawBody, sigHeader, secret) {
    if (!sigHeader) return false;

    const elements = sigHeader.split(",");
    const sigMap: Record<string, string> = {};

    for (const entry of elements) {
      const [key, value] = entry.split("=");
      sigMap[key] = value;
    }

    const timestamp = sigMap["t"];
    const signature = sigMap["v1"];

    if (!timestamp || !signature) return false;

    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  },

  parsePayload(body) {
    return JSON.parse(body.toString("utf8"));
  },

  normalize(event) {
    return {
      id: event.id,
      type: event.type,
      source: "stripe",
      timestamp: event.created ?? Math.floor(Date.now() / 1000),
      payload: event.data?.object ?? {},
    };
  },
};

export default stripe;
