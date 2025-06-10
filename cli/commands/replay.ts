import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Command } from "commander";

const program = new Command("replay");

program
  .description("Replay a webhook event from a JSON file")
  .argument("<file>", "Path to JSON event payload")
  .requiredOption("--target <url>", "Target URL (e.g. http://localhost:3000/webhooks/stripe)")
  .option("--secret <string>", "Webhook secret used to generate signature")
  .option("--source <string>", "Webhook source (e.g. stripe)", "stripe")
  .action(async (file, options) => {
    const fullPath = path.resolve(process.cwd(), file);

    if (!fs.existsSync(fullPath)) {
      console.error("❌ File not found:", fullPath);
      process.exit(1);
    }

    const fetch = (await import("node-fetch")).default;
    const json = fs.readFileSync(fullPath, "utf8");
    const bodyBuffer = Buffer.from(json, "utf8");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options.source === "stripe" && options.secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = `${timestamp}.${bodyBuffer.toString("utf8")}`;
      const signature = crypto.createHmac("sha256", options.secret)
        .update(payload)
        .digest("hex");

      headers["Stripe-Signature"] = `t=${timestamp},v1=${signature}`;
    }

    console.log(`▶ Replaying ${file} → ${options.target}`);

    try {
      const response = await fetch(options.target, {
        method: "POST",
        headers,
        body: bodyBuffer,
      });

      const status = response.status;
      const text = await response.text();

      console.log(`✔️  Status: ${status} ${response.statusText}`);
      if (text) {
        console.log(`→ Response: ${text}`);
      }
    } catch (err) {
      console.error("❌ Request failed:", err);
    }
  });

export default program;
