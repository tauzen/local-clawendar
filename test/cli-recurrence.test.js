import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * CLI recurrence tests (SPEC)
 *
 * This runs by default.
 *
 * Until CLI recurrence commands are implemented it will fail — intentional (TDD).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "bin", "clawendar.js");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawendar-test-"));
}

function run(args, tmpDir) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_PATH, ...args],
      { env: { ...process.env, CLAWENDAR_DATA_DIR: tmpDir } },
      (error, stdout, stderr) => {
        resolve({ exitCode: error ? error.code : 0, stdout, stderr });
      }
    );
  });
}

describe("CLI: recurring events (spec)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a recurring event and lists occurrences in a range", async () => {
    // Proposed UX (adjust flags if you prefer; keep capabilities):
    // - add supports --tz + --rrule
    // - occurrences expands instances for display
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
