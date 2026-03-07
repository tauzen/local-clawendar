import fs from "node:fs";
import path from "node:path";
import { createStorage } from "./storage.js";

const JSON_FILE = "events.json";

/**
 * Migrate events from the legacy events.json file to the SQLite database.
 * Returns { migrated, skipped } counts.
 * Throws if the JSON file does not exist.
 */
export function migrateJsonToSqlite(dataDir) {
  const jsonPath = path.join(dataDir, JSON_FILE);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`No ${JSON_FILE} found in ${dataDir}`);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const events = JSON.parse(raw);

  if (!Array.isArray(events)) {
    throw new Error(`${JSON_FILE} does not contain an array`);
  }

  const storage = createStorage(dataDir);
  let migrated = 0;
  let skipped = 0;

  for (const event of events) {
    if (storage.findById(event.id)) {
      skipped++;
      continue;
    }
    storage.save(event);
    migrated++;
  }

  return { migrated, skipped, total: events.length };
}
