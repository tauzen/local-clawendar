import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createStorage } from "../lib/storage.js";
import { makeTmpDir } from "./_helpers.js";

describe("createStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    storage = createStorage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("initializes with an empty event list", () => {
    const events = storage.loadAll();
    assert.deepEqual(events, []);
  });

  it("creates the data directory if it does not exist", () => {
    const nested = path.join(tmpDir, "sub", "dir");
    const s = createStorage(nested);
    s.loadAll();
    assert.ok(fs.existsSync(nested));
  });

  it("saves and loads a single event", () => {
    const event = {
      id: "test-1",
      title: "Meeting",
      start: "2026-02-14T10:00:00+01:00",
      end: "2026-02-14T11:00:00+01:00",
      createdAt: "2026-02-14T09:00:00+01:00",
    };

    storage.save(event);
    const events = storage.loadAll();

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], event);
  });

  it("saves multiple events", () => {
    storage.save({ id: "1", title: "A", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });
    storage.save({ id: "2", title: "B", start: "2026-02-14T11:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });

    const events = storage.loadAll();
    assert.equal(events.length, 2);
  });

  it("deletes an event by id", () => {
    storage.save({ id: "1", title: "A", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });
    storage.save({ id: "2", title: "B", start: "2026-02-14T11:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });

    const deleted = storage.remove("1");
    assert.equal(deleted, true);

    const events = storage.loadAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].id, "2");
  });

  it("returns false when deleting a non-existent event", () => {
    const deleted = storage.remove("non-existent");
    assert.equal(deleted, false);
  });

  it("updates an existing event", () => {
    storage.save({ id: "1", title: "Old", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });
    storage.update("1", { title: "New" });

    const events = storage.loadAll();
    assert.equal(events[0].title, "New");
    assert.equal(events[0].id, "1");
  });

  it("returns false when updating a non-existent event", () => {
    const updated = storage.update("non-existent", { title: "X" });
    assert.equal(updated, false);
  });

  it("finds an event by id", () => {
    storage.save({ id: "1", title: "A", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });
    const event = storage.findById("1");
    assert.equal(event.title, "A");
  });

  it("returns undefined for a non-existent id", () => {
    const event = storage.findById("missing");
    assert.equal(event, undefined);
  });

  it("persists data across storage instances", () => {
    storage.save({ id: "1", title: "Persisted", start: "2026-02-14T10:00:00+01:00", createdAt: "2026-02-14T09:00:00+01:00" });

    const storage2 = createStorage(tmpDir);
    const events = storage2.loadAll();
    assert.equal(events.length, 1);
    assert.equal(events[0].title, "Persisted");
  });
});
