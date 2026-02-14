import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "bin", "clawendar.js");

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawendar-test-"));
}

function run(args, tmpDir) {
  return new Promise((resolve, reject) => {
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

describe("CLI: add command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds an event with title and start", async () => {
    const { exitCode, stdout } = await run(
      ["add", "Meeting", "--start", "2026-02-14T10:00:00+01:00"],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Meeting"));
  });

  it("adds an event with all optional fields", async () => {
    const { exitCode, stdout } = await run(
      [
        "add",
        "Lunch",
        "--start", "2026-02-14T12:00:00+01:00",
        "--end", "2026-02-14T13:00:00+01:00",
        "--place", "Cafe",
        "--participants", "Alice,Bob",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Lunch"));
  });

  it("fails when title is missing", async () => {
    const { exitCode, stderr } = await run(
      ["add", "--start", "2026-02-14T10:00:00+01:00"],
      tmpDir
    );

    assert.notEqual(exitCode, 0);
    assert.ok(stderr.length > 0);
  });

  it("fails when start is missing", async () => {
    const { exitCode, stderr } = await run(["add", "Meeting"], tmpDir);

    assert.notEqual(exitCode, 0);
    assert.ok(stderr.length > 0);
  });
});

describe("CLI: today command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists events for today", async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const start = `${yyyy}-${mm}-${dd}T10:00:00+00:00`;

    await run(["add", "Today event", "--start", start], tmpDir);
    const { exitCode, stdout } = await run(["today"], tmpDir);

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Today event"));
  });

  it("shows a message when no events today", async () => {
    const { exitCode, stdout } = await run(["today"], tmpDir);

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("No events"));
  });
});

describe("CLI: week command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists events for the current week", async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const start = `${yyyy}-${mm}-${dd}T10:00:00+00:00`;

    await run(["add", "Week event", "--start", start], tmpDir);
    const { exitCode, stdout } = await run(["week"], tmpDir);

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Week event"));
  });
});

describe("CLI: list command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists events in a date range", async () => {
    await run(
      ["add", "March event", "--start", "2026-03-15T10:00:00+01:00"],
      tmpDir
    );

    const { exitCode, stdout } = await run(
      ["list", "--from", "2026-03-01T00:00:00+01:00", "--to", "2026-03-31T23:59:59+01:00"],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("March event"));
  });

  it("fails when --from or --to is missing", async () => {
    const { exitCode, stderr } = await run(["list", "--from", "2026-03-01T00:00:00+01:00"], tmpDir);

    assert.notEqual(exitCode, 0);
    assert.ok(stderr.length > 0);
  });

});

describe("CLI: delete command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("deletes an existing event", async () => {
    const { stdout: addOut } = await run(
      ["add", "To delete", "--start", "2026-02-14T10:00:00+01:00"],
      tmpDir
    );

    // Extract the id from add output (expects a line containing the id)
    const idMatch = addOut.match(/[0-9a-f-]{36}/);
    assert.ok(idMatch, "should print the event id");

    const { exitCode } = await run(["delete", idMatch[0]], tmpDir);
    assert.equal(exitCode, 0);
  });

  it("fails when deleting a non-existent event", async () => {
    const { exitCode, stderr } = await run(
      ["delete", "00000000-0000-0000-0000-000000000000"],
      tmpDir
    );

    assert.notEqual(exitCode, 0);
    assert.ok(stderr.length > 0);
  });
});

describe("CLI: edit command", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("edits the title of an existing event", async () => {
    const { stdout: addOut } = await run(
      ["add", "Old title", "--start", "2026-02-14T10:00:00+01:00"],
      tmpDir
    );

    const idMatch = addOut.match(/[0-9a-f-]{36}/);
    assert.ok(idMatch);

    const { exitCode, stdout } = await run(
      ["edit", idMatch[0], "--title", "New title"],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("New title"));
  });

  it("edits the place of an existing event", async () => {
    const { stdout: addOut } = await run(
      ["add", "Meeting", "--start", "2026-02-14T10:00:00+01:00"],
      tmpDir
    );

    const idMatch = addOut.match(/[0-9a-f-]{36}/);
    assert.ok(idMatch);

    const { exitCode, stdout } = await run(
      ["edit", idMatch[0], "--place", "Room 42"],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Room 42"));
  });

  it("fails when editing a non-existent event", async () => {
    const { exitCode, stderr } = await run(
      ["edit", "00000000-0000-0000-0000-000000000000", "--title", "Nope"],
      tmpDir
    );

    assert.notEqual(exitCode, 0);
    assert.ok(stderr.length > 0);
  });

});

describe("CLI: unknown command", () => {
  it("prints usage help for unknown commands", async () => {
    const tmpDir = makeTmpDir();
    const { exitCode, stderr } = await run(["unknown"], tmpDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    assert.notEqual(exitCode, 0);
    assert.ok(stderr.length > 0);
  });
});

describe("CLI: no arguments", () => {
  it("prints usage help when invoked with no arguments", async () => {
    const tmpDir = makeTmpDir();
    const { exitCode, stdout, stderr } = await run([], tmpDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Should print help/usage info
    const output = stdout + stderr;
    assert.ok(output.length > 0);
  });
});

describe("CLI: event display format", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("displays place when present", async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const start = `${yyyy}-${mm}-${dd}T10:00:00+00:00`;

    await run(
      ["add", "Office meeting", "--start", start, "--place", "Room 5"],
      tmpDir
    );

    const { stdout } = await run(["today"], tmpDir);
    assert.ok(stdout.includes("Room 5"));
  });

  it("displays participants when present", async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const start = `${yyyy}-${mm}-${dd}T10:00:00+00:00`;

    await run(
      ["add", "Standup", "--start", start, "--participants", "Alice,Bob"],
      tmpDir
    );

    const { stdout } = await run(["today"], tmpDir);
    assert.ok(stdout.includes("Alice"));
    assert.ok(stdout.includes("Bob"));
  });
});
