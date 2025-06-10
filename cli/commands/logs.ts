import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Command } from "commander";

const program = new Command("logs");

const LOG_FILE = path.resolve(process.cwd(), "logs/events.log");

function formatTimestamp(ts: number) {
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16);
}

program
  .description("View webhook event logs")
  .option("--type <eventType>", "Filter by event type (e.g. invoice.paid)")
  .option("--after <timestamp>", "Only show events after this ISO timestamp")
  .option("--limit <number>", "Limit number of results", parseInt)
  .option("--json", "Output full JSON")
  .option("--replay <id>", "Replay a logged event by ID")
  .option("--target <url>", "Target URL for replay")
  .option("--secret <string>", "Secret for signature (e.g. Stripe webhook secret)")
  .action(async (options) => {
    const fetch = (await import("node-fetch")).default;

    if (!fs.existsSync(LOG_FILE)) {
      console.log("⚠️ No event log found.");
      return;
    }

    const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n");
    let events = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (options.type) {
      events = events.filter(e => e.type === options.type);
    }

    if (options.after) {
      const afterTs = Math.floor(new Date(options.after).getTime() / 1000);
      events = events.filter(e => e.timestamp > afterTs);
    }

    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    // --json mode
    if (options.json) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }

    // --replay mode
    if (options.replay) {
      if (!options.target) {
        console.error("❌ Must provide --target when using --replay");
        process.exit(1);
      }

      const found = events.find(e => e.id === options.replay);
      if (!found) {
        console.error(`❌ Event not found: ${options.replay}`);
        process.exit(1);
      }

      const body = JSON.stringify(found.raw);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (options.secret) {
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = `${timestamp}.${body}`;
        const sig = crypto.createHmac("sha256", options.secret).update(payload).digest("hex");
        headers["Stripe-Signature"] = `t=${timestamp},v1=${sig}`;
      }

      console.log(`▶ Replaying ${found.id} to ${options.target}`);
      const res = await fetch(options.target, {
        method: "POST",
        headers,
        body,
      });

      console.log(`✔️  Status ${res.status} ${res.statusText}`);
      const text = await res.text();
      if (text) console.log(`→ ${text}`);
      return;
    }

    if (events.length === 0) {
      console.log("⚠️ No matching events found.");
      return;
    }

    console.log(`📦 ${events.length} events found in logs/events.log\n`);
    events.forEach((e, i) => {
      console.log(
        `${String(i + 1).padEnd(2)}. ${e.type.padEnd(25)} ${e.id}   ${formatTimestamp(e.timestamp)}`
      );
    });
  });

export default program;
