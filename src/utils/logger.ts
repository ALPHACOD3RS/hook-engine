import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "events.log");

export function logger(event: {
  id: string;
  type: string;
  timestamp: number;
  raw: unknown;
}) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR);
    }

    const entry = JSON.stringify(event);
    fs.appendFileSync(LOG_FILE, entry + "\n", "utf8");
  } catch (err) {
    console.error("❌ Failed to write event log:", err);
  }
}
