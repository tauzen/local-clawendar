import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeTmpDir, run } from "./_helpers.js";

describe("CLI: recurring events (spec)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a recurring event and lists occurrences in a range", async () => {
    const addRes = await run(
      [
        "add",
        "Team sync",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--tz",
        "Europe/Warsaw",
        "--rrule",
        "FREQ=MONTHLY;INTERVAL=1;BYDAY=TU;BYSETPOS=2",
      ],
      tmpDir
    );

    assert.equal(addRes.exitCode, 0, addRes.stderr);
    const idMatch = addRes.stdout.match(/[0-9a-f-]{36}/);
    assert.ok(idMatch, "should print the event id");

    const occ = await run(
      [
        "occurrences",
        idMatch[0],
        "--from",
        "2026-03-01T00:00:00+01:00",
        "--to",
        "2026-05-01T00:00:00+02:00",
      ],
      tmpDir
    );

    assert.equal(occ.exitCode, 0, occ.stderr);
    // Expect both March and April instances, with correct offset flip.
    assert.ok(occ.stdout.includes("2026-03-10T10:00:00+01:00"));
    assert.ok(occ.stdout.includes("2026-04-14T10:00:00+02:00"));
  });

  it("rejects unsupported yearly recurrence at add-time (regression test)", async () => {
    const addRes = await run(
      [
        "add",
        "Birthday",
        "--start",
        "2026-05-15T00:00:00+02:00",
        "--end",
        "2026-05-15T23:59:59+02:00",
        "--tz",
        "Europe/Warsaw",
        "--rrule",
        "FREQ=YEARLY;INTERVAL=1",
      ],
      tmpDir
    );

    // Current bug: CLI accepts this and stores invalid recurrence that later breaks `list`.
    // Desired behavior: reject at add-time with a clear error.
    assert.notEqual(addRes.exitCode, 0, "add should fail for unsupported YEARLY recurrence");
    assert.match(`${addRes.stderr}\n${addRes.stdout}`, /unsupported|invalid\s+FREQ/i);
  });

  it("can skip a single occurrence (exception) and it disappears from expansion", async () => {
    const addRes = await run(
      [
        "add",
        "Standup",
        "--start",
        "2026-03-23T09:00:00+01:00",
        "--tz",
        "Europe/Warsaw",
        "--rrule",
        "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      ],
      tmpDir
    );

    assert.equal(addRes.exitCode, 0, addRes.stderr);
    const idMatch = addRes.stdout.match(/[0-9a-f-]{36}/);
    assert.ok(idMatch);

    const skipRes = await run(
      ["skip", idMatch[0], "--date", "2026-03-30T09:00:00+02:00"],
      tmpDir
    );

    assert.equal(skipRes.exitCode, 0, skipRes.stderr);

    const occ = await run(
      [
        "occurrences",
        idMatch[0],
        "--from",
        "2026-03-20T00:00:00+01:00",
        "--to",
        "2026-04-10T00:00:00+02:00",
      ],
      tmpDir
    );

    assert.equal(occ.exitCode, 0, occ.stderr);
    assert.ok(occ.stdout.includes("2026-03-23T09:00:00+01:00"));
    assert.ok(!occ.stdout.includes("2026-03-30T09:00:00+02:00"));
    assert.ok(occ.stdout.includes("2026-04-06T09:00:00+02:00"));
  });
});
