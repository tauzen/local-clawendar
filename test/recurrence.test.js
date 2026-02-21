import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("recurrence (spec)", () => {
  it("expands a monthly 2nd Tuesday rule and keeps wall-clock time stable across DST", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-10T10:00:00+01:00",
      tz: "Europe/Warsaw",
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYDAY=TU;BYSETPOS=2",
      from: "2026-03-01T00:00:00+01:00",
      to: "2026-05-01T00:00:00+02:00",
      mode: "wall",
    });

    // Poland DST in 2026 starts on Mar 29; April occurrences should use +02:00.
    assert.deepEqual(out, [
      "2026-03-10T10:00:00+01:00",
      "2026-04-14T10:00:00+02:00",
    ]);
  });

  it("expands a weekly rule and keeps local time stable across DST", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-23T09:00:00+01:00", // Monday before DST change
      tz: "Europe/Warsaw",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      from: "2026-03-20T00:00:00+01:00",
      to: "2026-04-10T00:00:00+02:00",
      mode: "wall",
    });

    assert.deepEqual(out, [
      "2026-03-23T09:00:00+01:00",
      "2026-03-30T09:00:00+02:00", // after DST shift, still 09:00 local
      "2026-04-06T09:00:00+02:00",
    ]);
  });

  it("supports EXDATE-like exceptions (skip a single instance)", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    const out = expandOccurrences({
      dtStart: "2026-03-23T09:00:00+01:00",
      tz: "Europe/Warsaw",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      from: "2026-03-20T00:00:00+01:00",
      to: "2026-04-10T00:00:00+02:00",
      mode: "wall",
      exDates: ["2026-03-30T09:00:00+02:00"],
    });

    assert.deepEqual(out, [
      "2026-03-23T09:00:00+01:00",
      "2026-04-06T09:00:00+02:00",
    ]);
  });

  it("rejects unsupported / ambiguous rules with a clear error", async () => {
    const { expandOccurrences } = await import("../lib/recurrence.js");

    assert.throws(() => {
      expandOccurrences({
        dtStart: "2026-03-10T10:00:00+01:00",
        tz: "Europe/Warsaw",
        rrule: "FREQ=YEARLY;BYEASTER=1", // nonsense
        from: "2026-01-01T00:00:00+01:00",
        to: "2027-01-01T00:00:00+01:00",
        mode: "wall",
      });
    }, /unsupported|invalid/i);
  });
});
