import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(process.cwd(), "db/dedupe.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS seen_events (
    id TEXT PRIMARY KEY,
    seen_at INTEGER
  );
`);

export function isDuplicate(id: string): boolean {
  const row = db.prepare("SELECT 1 FROM seen_events WHERE id = ?").get(id);
  return !!row;
}

export function markSeen(id: string) {
  db.prepare("INSERT OR IGNORE INTO seen_events (id, seen_at) VALUES (?, ?)").run(id, Date.now());
}
