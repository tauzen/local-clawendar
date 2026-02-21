import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("recurrence edge cases (spec)", () => {
  it("handles DST spring-forward gaps by preserving wall-clock intent (policy must be explicit)", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-22T02:30:00+01:00", // Sunday before DST shift
      tz: "Europe/Warsaw",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=SU",
      from: "2026-03-20T00:00:00+01:00",
      to: "2026-04-10T00:00:00+02:00",
      mode: "wall",
      // optional: gapPolicy: "shift-forward" | "skip" | "error"
    });

    assert.deepEqual(out, [
      "2026-03-22T02:30:00+01:00",
      "2026-03-29T03:30:00+02:00", // 02:30 doesn't exist; shift-forward
      "2026-04-05T02:30:00+02:00",
    ]);
  });

  it("handles DST fall-back folds (ambiguous local times) deterministically", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-10-18T02:30:00+02:00",
      tz: "Europe/Warsaw",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=SU",
      from: "2026-10-15T00:00:00+02:00",
      to: "2026-11-10T00:00:00+01:00",
      mode: "wall",
    });

    // In 2026, DST end is typically late October; the fold day should appear with +01:00.
    // We expect local time stays 02:30, offset flips.
    assert.ok(out.some((s) => /T02:30:00\+01:00$/.test(s)));
  });

  it("supports last weekday of month using BYSETPOS=-1", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-27T10:00:00+01:00", // last Friday of March 2026
      tz: "Europe/Warsaw",
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYDAY=FR;BYSETPOS=-1",
      from: "2026-03-01T00:00:00+01:00",
      to: "2026-05-01T00:00:00+02:00",
      mode: "wall",
    });

    assert.deepEqual(out, [
      "2026-03-27T10:00:00+01:00",
      // April last Friday is 2026-04-24, after DST so +02:00
      "2026-04-24T10:00:00+02:00",
    ]);
  });

  it("supports multiple BYDAY values with nth selection", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-05T10:00:00+01:00", // Thu (likely the 2nd TU/TH in March)
      tz: "Europe/Warsaw",
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYDAY=TU,TH;BYSETPOS=2",
      from: "2026-03-01T00:00:00+01:00",
      to: "2026-04-01T00:00:00+01:00",
      mode: "wall",
    });

    assert.deepEqual(out, ["2026-03-05T10:00:00+01:00"]);
  });

  it("supports INTERVAL > 1", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-02T09:00:00+01:00",
      tz: "Europe/Warsaw",
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
      from: "2026-03-01T00:00:00+01:00",
      to: "2026-04-15T00:00:00+02:00",
      mode: "wall",
    });

    assert.deepEqual(out, [
      "2026-03-02T09:00:00+01:00",
      "2026-03-16T09:00:00+01:00",
      "2026-03-30T09:00:00+02:00",
      "2026-04-13T09:00:00+02:00",
    ]);
  });

  it("supports COUNT as an upper bound", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-02T09:00:00+01:00",
      tz: "Europe/Warsaw",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=3",
      from: "2026-03-01T00:00:00+01:00",
      to: "2026-05-01T00:00:00+02:00",
      mode: "wall",
    });

    assert.deepEqual(out, [
      "2026-03-02T09:00:00+01:00",
      "2026-03-09T09:00:00+01:00",
      "2026-03-16T09:00:00+01:00",
    ]);
  });

  it("errors when an exDate does not parse or is not strict ISO with offset", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    assert.throws(() => {
      expandOccurrences({
        dtStart: "2026-03-23T09:00:00+01:00",
        tz: "Europe/Warsaw",
        rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
        from: "2026-03-20T00:00:00+01:00",
        to: "2026-04-10T00:00:00+02:00",
        mode: "wall",
        exDates: ["2026-03-30 09:00"],
      });
    }, /exDates|offset|iso|invalid/i);
  });
});
