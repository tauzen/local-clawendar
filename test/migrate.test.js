import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { migrateJsonToSqlite } from "../lib/migrate.js";
import { createStorage } from "../lib/storage.js";
import { makeTmpDir, run } from "./_helpers.js";

describe("migrateJsonToSqlite", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("migrates events from events.json to SQLite", () => {
    const events = [
      { id: "1", title: "A", start: "2026-02-14T10:00:00+01:00", end: "2026-02-14T11:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", title: "B", start: "2026-02-15T10:00:00+01:00", end: "2026-02-15T11:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    fs.writeFileSync(path.join(tmpDir, "events.json"), JSON.stringify(events));

    const result = migrateJsonToSqlite(tmpDir);

    assert.equal(result.migrated, 2);
    assert.equal(result.skipped, 0);
    assert.equal(result.total, 2);

    const storage = createStorage(tmpDir);
    const loaded = storage.loadAll();
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].title, "A");
    assert.equal(loaded[1].title, "B");
  });

  it("skips events that already exist in SQLite", () => {
    const storage = createStorage(tmpDir);
    storage.save({ id: "1", title: "Existing", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" });

    const events = [
      { id: "1", title: "A", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", title: "B", start: "2026-02-15T10:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    fs.writeFileSync(path.join(tmpDir, "events.json"), JSON.stringify(events));

    const result = migrateJsonToSqlite(tmpDir);
    assert.equal(result.migrated, 1);
    assert.equal(result.skipped, 1);

    // Original event should be untouched
    assert.equal(storage.findById("1").title, "Existing");
    assert.equal(storage.findById("2").title, "B");
  });

  it("preserves array fields during migration", () => {
    const events = [
      {
        id: "1",
        title: "Full",
        start: "2026-02-14T10:00:00+01:00",
        createdAt: "2026-01-01T00:00:00.000Z",
        participants: ["Alice", "Bob"],
        categories: ["work", "meeting"],
        exDates: ["2026-03-01T10:00:00+01:00"],
      },
    ];
    fs.writeFileSync(path.join(tmpDir, "events.json"), JSON.stringify(events));

    migrateJsonToSqlite(tmpDir);

    const storage = createStorage(tmpDir);
    const loaded = storage.findById("1");
    assert.deepEqual(loaded.participants, ["Alice", "Bob"]);
    assert.deepEqual(loaded.categories, ["work", "meeting"]);
    assert.deepEqual(loaded.exDates, ["2026-03-01T10:00:00+01:00"]);
  });

  it("throws when events.json does not exist", () => {
    assert.throws(() => migrateJsonToSqlite(tmpDir), /No events\.json found/);
  });

  it("throws when events.json does not contain an array", () => {
    fs.writeFileSync(path.join(tmpDir, "events.json"), '{"not": "an array"}');
    assert.throws(() => migrateJsonToSqlite(tmpDir), /does not contain an array/);
  });

  it("handles an empty events.json", () => {
    fs.writeFileSync(path.join(tmpDir, "events.json"), "[]");
    const result = migrateJsonToSqlite(tmpDir);
    assert.equal(result.migrated, 0);
    assert.equal(result.total, 0);
  });
});

describe("CLI: migrate command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("migrates events via CLI and reports counts", async () => {
    const events = [
      { id: "1", title: "A", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", title: "B", start: "2026-02-15T10:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    fs.writeFileSync(path.join(tmpDir, "events.json"), JSON.stringify(events));

    const { exitCode, stdout } = await run(["migrate"], tmpDir);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("2 migrated"));
    assert.ok(stdout.includes("0 skipped"));
  });

  it("fails when no events.json exists", async () => {
    const { exitCode, stderr } = await run(["migrate"], tmpDir);
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes("No events.json found"));
  });

  it("migrated events are visible via list", async () => {
    const events = [
      { id: "ev-1", title: "Migrated Event", start: "2026-06-01T10:00:00+01:00", end: "2026-06-01T11:00:00+01:00", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    fs.writeFileSync(path.join(tmpDir, "events.json"), JSON.stringify(events));

    await run(["migrate"], tmpDir);

    const { exitCode, stdout } = await run(
      ["list", "--from", "2026-06-01T00:00:00+01:00", "--to", "2026-06-02T00:00:00+01:00"],
      tmpDir
    );
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Migrated Event"));
  });
});
