import "dotenv/config";
import express, { Request, Response } from "express";
import { receiveWebhook } from "../src/core/receiveWebhook";
import { isDuplicate } from "../src/core/idempotency";
import { retry } from "../src/core/retry";
import { logger } from "../src/utils/logger";
import { markSeen } from "../src/utils/dedupeStore";

const app = express();

app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req: Request, res: Response): Promise<void> => {
  try {
    const event = await receiveWebhook(req, {
      source: "stripe",
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });

    if (isDuplicate(event)) {
      console.log("⚠️ Duplicate event skipped:", event.id);
      res.status(200).send("already handled");
      return;
    }

    logger(event);
    markSeen(event.id);


    // This is where your logic goes (e.g. billing, database update, etc)
    await retry(event, async () => {
        console.log(`🚀 Processing event ${event.type} (${event.id})`);
      
        // Simulate failure ONLY for invoice.paid
        if (event.type === "invoice.paid") {
          throw new Error("🔥 Simulated failure for testing retry");
        }
      
        if (event.type === "invoice.payment_succeeded") {
          const customerId = event.payload.customer;
          console.log(`🎉 Grant premium to customer ${customerId}`);
        }
      });

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(400).send("webhook error");
  }
});

app.listen(3000, () => {
  console.log("🚀 Listening on http://localhost:3000/webhooks/stripe");
});
