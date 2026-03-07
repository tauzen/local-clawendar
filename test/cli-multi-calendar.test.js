import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeTmpDir, run } from "./_helpers.js";

describe("CLI: multi-calendar + categories (spec tests)", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("add supports --calendar", async () => {
    const { exitCode, stdout } = await run(
      [
        "add",
        "Lukasz birthday",
        "--start",
        "2026-12-24T00:00:00+01:00",
        "--calendar",
        "birthdays",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("birthdays"));
  });

  it("add supports --category multiple times", async () => {
    const { exitCode, stdout } = await run(
      [
        "add",
        "Family event",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--calendar",
        "personal",
        "--category",
        "family",
        "--category",
        "important",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("family"));
    assert.ok(stdout.includes("important"));
  });

  it("add fails for blank --calendar", async () => {
    const { exitCode, stderr } = await run(
      [
        "add",
        "Bad event",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--calendar",
        "",
      ],
      tmpDir
    );

    assert.notEqual(exitCode, 0);
    assert.match(stderr, /calendar/i);
  });

  it("list supports --calendar filter", async () => {
    await run(
      [
        "add",
        "Personal",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--calendar",
        "personal",
      ],
      tmpDir
    );
    await run(
      [
        "add",
        "Holiday",
        "--start",
        "2026-03-10T00:00:00+01:00",
        "--calendar",
        "holidays",
      ],
      tmpDir
    );

    const { exitCode, stdout } = await run(
      [
        "list",
        "--from",
        "2026-03-01T00:00:00+01:00",
        "--to",
        "2026-03-31T23:59:59+01:00",
        "--calendar",
        "holidays",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Holiday"));
    assert.ok(!stdout.includes("Personal"));
  });

  it("list supports --category-any filter", async () => {
    await run(
      [
        "add",
        "Family item",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--calendar",
        "personal",
        "--category",
        "family",
      ],
      tmpDir
    );
    await run(
      [
        "add",
        "Work item",
        "--start",
        "2026-03-10T11:00:00+01:00",
        "--calendar",
        "personal",
        "--category",
        "work",
      ],
      tmpDir
    );

    const { exitCode, stdout } = await run(
      [
        "list",
        "--from",
        "2026-03-01T00:00:00+01:00",
        "--to",
        "2026-03-31T23:59:59+01:00",
        "--category-any",
        "family",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Family item"));
    assert.ok(!stdout.includes("Work item"));
  });

  it("list supports --category-all filter", async () => {
    await run(
      [
        "add",
        "Family birthday",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--calendar",
        "birthdays",
        "--category",
        "family",
        "--category",
        "birthday",
      ],
      tmpDir
    );
    await run(
      [
        "add",
        "Family only",
        "--start",
        "2026-03-10T11:00:00+01:00",
        "--calendar",
        "personal",
        "--category",
        "family",
      ],
      tmpDir
    );

    const { exitCode, stdout } = await run(
      [
        "list",
        "--from",
        "2026-03-01T00:00:00+01:00",
        "--to",
        "2026-03-31T23:59:59+01:00",
        "--category-all",
        "family,birthday",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Family birthday"));
    assert.ok(!stdout.includes("Family only"));
  });

  it("today supports --calendar", async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");

    await run(
      [
        "add",
        "Birthday today",
        "--start",
        `${yyyy}-${mm}-${dd}T00:00:00+00:00`,
        "--calendar",
        "birthdays",
      ],
      tmpDir
    );

    await run(
      [
        "add",
        "Personal today",
        "--start",
        `${yyyy}-${mm}-${dd}T12:00:00+00:00`,
        "--calendar",
        "personal",
      ],
      tmpDir
    );

    const { exitCode, stdout } = await run(["today", "--calendar", "birthdays"], tmpDir);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Birthday today"));
    assert.ok(!stdout.includes("Personal today"));
  });

  it("list supports --calendar default for unassigned events", async () => {
    await run(
      [
        "add",
        "Default event",
        "--start",
        "2026-04-10T10:00:00+02:00",
      ],
      tmpDir
    );

    await run(
      [
        "add",
        "Holiday event",
        "--start",
        "2026-04-10T00:00:00+02:00",
        "--calendar",
        "holidays",
      ],
      tmpDir
    );

    const { exitCode, stdout } = await run(
      [
        "list",
        "--from",
        "2026-04-01T00:00:00+02:00",
        "--to",
        "2026-04-30T23:59:59+02:00",
        "--calendar",
        "default",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("Default event"));
    assert.ok(!stdout.includes("Holiday event"));
  });

  it("edit supports changing calendar and categories", async () => {
    const { stdout: addOut } = await run(
      [
        "add",
        "Move me",
        "--start",
        "2026-03-10T10:00:00+01:00",
        "--calendar",
        "personal",
      ],
      tmpDir
    );

    const idMatch = addOut.match(/[0-9a-f-]{36}/);
    assert.ok(idMatch, "should include id in output");

    const { exitCode, stdout } = await run(
      [
        "edit",
        idMatch[0],
        "--calendar",
        "birthdays",
        "--category",
        "family",
      ],
      tmpDir
    );

    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("birthdays"));
    assert.ok(stdout.includes("family"));
  });
});
