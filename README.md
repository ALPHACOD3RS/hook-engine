


# 🔌 hook-engine

**Production-grade webhook engine** with:

- ✅ Signature verification (Stripe-style)
- ✅ Retry + exponential backoff
- ✅ Deduping (SQLite)
- ✅ Local replay CLI
- ✅ JSON event logs
- ✅ Safe for serverless & edge runtimes

---

## 🚀 Why hook-engine?

Stripe (and others) send webhooks — but most apps:

- 💥 Fail silently in serverless
- 🔁 Have no retry engine
- ⚠️ Lack idempotency logic
- 🔍 Can’t replay/test webhooks locally
- 😵 Lose trace of webhook history

`hook-engine` solves all that with:

> 🛠️ Drop-in devtool-grade library and CLI for real-world webhook infra.

---

## 📦 Install

```bash
pnpm add hook-engine
````

> Or globally for CLI usage:

```bash
pnpm add -g hook-engine
```

---

## 📂 Project Structure (Example)

```bash
📁 your-app/
│
├─ 📦 db/
│   └─ seen.sqlite          # Event ID deduping
│
├─ 📁 lib/
│   ├─ config.ts            # Webhook secret & source
│   ├─ handler.ts           # Your business logic
│   └─ dedupe.ts            # Event deduplication store
│
├─ 📁 pages/
│   └─ api/
│       └─ webhooks/
│           └─ stripe.ts    # Webhook entrypoint
```

---

## 🔧 Usage (Next.js or Express)

```ts
// pages/api/webhooks/stripe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { receiveWebhook, retry } from "hook-engine";
import { config } from "../../../lib/config";
import { processEvent } from "../../../lib/handler";
import { isDuplicate, markSeen } from "../../../lib/dedupe";

export const configRuntime = {
  api: {
    bodyParser: false, // Required for raw body access
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const event = await receiveWebhook(req, config);

    if (isDuplicate(event.id)) {
      console.warn(`⚠️ Duplicate skipped: ${event.id}`);
      return res.status(200).send("duplicate");
    }

    markSeen(event.id);
    await retry(event, processEvent);

    res.status(200).send("ok");
  } catch (err: any) {
    console.error("❌ Webhook error:", err.message);
    res.status(400).send("webhook error");
  }
}
```

---

## 🧠 Your Business Logic

```ts
// lib/handler.ts
export async function processEvent(event: any) {
  console.log(`🎯 Received ${event.type} for ${event.id}`);

  if (event.type === "invoice.paid") {
    const customer = event.payload.customer;
    console.log(`🎉 Grant premium access to ${customer}`);
    // do something: DB, email, billing...
  }

  if (event.type === "invoice.failed") {
    throw new Error("🔥 Simulated failure for retry");
  }
}
```

---

## 🧱 Deduping Store (SQLite)

```ts
// lib/dedupe.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(process.cwd(), "db/seen.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`CREATE TABLE IF NOT EXISTS seen_events (
  id TEXT PRIMARY KEY,
  seen_at INTEGER
);`);

export function isDuplicate(id: string): boolean {
  return !!db.prepare("SELECT 1 FROM seen_events WHERE id = ?").get(id);
}

export function markSeen(id: string) {
  db.prepare("INSERT OR IGNORE INTO seen_events (id, seen_at) VALUES (?, ?)").run(id, Date.now());
}
```

---

## 🔐 Config Example

```ts
// lib/config.ts
import { WebhookConfig } from "hook-engine";

export const config: WebhookConfig = {
  source: "stripe",
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
};
```

---

## 💻 CLI Commands

```bash
# Replay from file
webhook-gateway replay ./mock/invoice-paid.json \
  --target http://localhost:3000/api/webhooks/stripe \
  --secret $STRIPE_WEBHOOK_SECRET

# View logged events
webhook-gateway logs

# JSON mode
webhook-gateway logs --json

# Replay by ID
webhook-gateway logs --replay evt_123456 \
  --target http://localhost:3000/api/webhooks/stripe \
  --secret $STRIPE_WEBHOOK_SECRET
```

> All events are logged into `.webhook-engine/events.log` in newline-delimited JSON.

---

## 💡 Dev Workflow

1. Start your server:

   ```bash
   pnpm dev
   ```

2. In another terminal:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. Trigger an event from Stripe Dashboard or CLI

4. Replay failed events like a boss:

   ```bash
   webhook-gateway logs --replay evt_123 --target http://localhost:3000/api/webhooks/stripe
   ```

---

## 🧪 Supported Providers

* ✅ Stripe (first-class)
* 🟡 GitHub (soon)
* 🟡 Clerk/Auth0 (soon)
* 🟢 Any JSON webhook provider (via adapters)

---

## 🛡️ Features

| Feature                | Status     |
| ---------------------- | ---------- |
| Signature verification | ✅          |
| Retry engine           | ✅          |
| Deduplication store    | ✅          |
| Local replay CLI       | ✅          |
| JSONL event logs       | ✅          |
| SQLite support         | ✅          |
| Serverless safe        | ✅          |
| Extendable adapters    | 🛠️ coming |

---

## 🧪 Example Repos

Coming soon...

---

## 📜 License

MIT — by [Naol Ketema](https://github.com/alphacod3rs)

---

**Star this repo** if you love solid webhook tooling 🌟
**Tweet it** if it saved your weekend 🔁



