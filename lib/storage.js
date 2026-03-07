import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_FILE = "events.db";

const ARRAY_COLUMNS = ["participants", "categories", "exDates"];

function eventToRow(event) {
  const row = { ...event };
  for (const col of ARRAY_COLUMNS) {
    if (row[col] !== undefined) {
      row[col] = JSON.stringify(row[col]);
    }
  }
  return row;
}

function rowToEvent(row) {
  if (!row) return undefined;
  const event = { ...row };
  // Remove columns that are NULL (not part of original event)
  for (const key of Object.keys(event)) {
    if (event[key] === null) {
      delete event[key];
    }
  }
  // Parse JSON array columns back to arrays
  for (const col of ARRAY_COLUMNS) {
    if (typeof event[col] === "string") {
      event[col] = JSON.parse(event[col]);
    }
  }
  return event;
}

export function createStorage(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, DB_FILE);
  const db = new DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      start       TEXT NOT NULL,
      "end"       TEXT,
      createdAt   TEXT,
      place       TEXT,
      participants TEXT,
      calendarId  TEXT,
      categories  TEXT,
      tz          TEXT,
      rrule       TEXT,
      exDates     TEXT
    )
  `);

  const stmts = {
    insertEvent: db.prepare(`
      INSERT INTO events (id, title, start, "end", createdAt, place, participants, calendarId, categories, tz, rrule, exDates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    selectAll: db.prepare("SELECT * FROM events"),
    selectById: db.prepare("SELECT * FROM events WHERE id = ?"),
    deleteById: db.prepare("DELETE FROM events WHERE id = ?"),
  };

  return {
    loadAll() {
      return stmts.selectAll.all().map(rowToEvent);
    },

    save(event) {
      const row = eventToRow(event);
      stmts.insertEvent.run(
        row.id,
        row.title,
        row.start,
        row.end ?? null,
        row.createdAt ?? null,
        row.place ?? null,
        row.participants ?? null,
        row.calendarId ?? null,
        row.categories ?? null,
        row.tz ?? null,
        row.rrule ?? null,
        row.exDates ?? null,
      );
    },

    remove(eventId) {
      const result = stmts.deleteById.run(eventId);
      return result.changes > 0;
    },

    update(eventId, updates) {
      const existing = rowToEvent(stmts.selectById.get(eventId));
      if (!existing) return false;

      const merged = { ...existing, ...updates };
      const row = eventToRow(merged);

      const setClauses = [];
      const values = [];
      for (const [key, value] of Object.entries(row)) {
        if (key === "id") continue;
        setClauses.push(`"${key}" = ?`);
        values.push(value ?? null);
      }
      values.push(eventId);

      db.prepare(`UPDATE events SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
      return rowToEvent(stmts.selectById.get(eventId));
    },

    findById(eventId) {
      return rowToEvent(stmts.selectById.get(eventId));
    },
  };
}
