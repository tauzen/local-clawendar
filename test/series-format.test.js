import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Series / recurrence display format (SPEC)
 *
 * Purpose: make it obvious whether an event is a one-off or part of a series.
 *
 * Proposed convention:
 * - If an event has `rrule`, append " {series}" to its formatted line.
 * - Occurrence lines printed by `occurrences` should append " {occurrence}".
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

describe("CLI: series marker (spec)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not mark a one-off event as series", async () => {
    const addRes = await run(
      ["add", "One-off", "--start", "2026-03-10T10:00:00+01:00"],
      tmpDir
    );

    assert.equal(addRes.exitCode, 0, addRes.stderr);
    assert.ok(addRes.stdout.includes("One-off"));
    assert.ok(!addRes.stdout.includes("{series}"));
  });

  it("marks a recurring event as {series}", async () => {
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
    assert.ok(addRes.stdout.includes("Team sync"));
    assert.ok(addRes.stdout.includes("{series}"));
  });

  it("marks expanded instance lines as {occurrence}", async () => {
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
    assert.ok(occ.stdout.includes("{occurrence}"));
  });
});
