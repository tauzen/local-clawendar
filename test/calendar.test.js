import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createCalendar } from "../lib/calendar.js";
import { makeTmpDir } from "./_helpers.js";

describe("createCalendar", () => {
  let tmpDir;
  let calendar;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    calendar = createCalendar({ dataDir: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("add", () => {
    it("adds an event and returns it with an id", () => {
      const event = calendar.add({
        title: "Meeting",
        start: "2026-02-14T10:00:00+01:00",
      });

      assert.ok(event.id);
      assert.equal(event.title, "Meeting");
    });

    it("throws when required fields are missing", () => {
      assert.throws(() => calendar.add({ title: "No start" }));
    });

    it("adds an event with place and participants", () => {
      const event = calendar.add({
        title: "Lunch",
        start: "2026-02-14T12:00:00+01:00",
        place: "Cafe",
        participants: ["Alice", "Bob"],
      });

      assert.equal(event.place, "Cafe");
      assert.deepEqual(event.participants, ["Alice", "Bob"]);
    });
  });

  describe("delete", () => {
    it("removes an existing event", () => {
      const event = calendar.add({
        title: "To delete",
        start: "2026-02-14T10:00:00+01:00",
      });

      const result = calendar.delete(event.id);
      assert.equal(result, true);

      const all = calendar.list();
      assert.equal(all.length, 0);
    });

    it("returns false for a non-existent event", () => {
      const result = calendar.delete("non-existent");
      assert.equal(result, false);
    });
  });

  describe("edit", () => {
    it("updates the title of an existing event", () => {
      const event = calendar.add({
        title: "Old title",
        start: "2026-02-14T10:00:00+01:00",
      });

      const updated = calendar.edit(event.id, { title: "New title" });
      assert.equal(updated.title, "New title");
    });

    it("updates the place", () => {
      const event = calendar.add({
        title: "Meeting",
        start: "2026-02-14T10:00:00+01:00",
      });

      const updated = calendar.edit(event.id, { place: "Room 42" });
      assert.equal(updated.place, "Room 42");
    });

    it("updates participants", () => {
      const event = calendar.add({
        title: "Meeting",
        start: "2026-02-14T10:00:00+01:00",
        participants: ["Alice"],
      });

      const updated = calendar.edit(event.id, {
        participants: ["Alice", "Bob"],
      });
      assert.deepEqual(updated.participants, ["Alice", "Bob"]);
    });

    it("throws for a non-existent event", () => {
      assert.throws(() => calendar.edit("non-existent", { title: "X" }));
    });

    it("should reject invalid edits where end is before start", () => {
      const event = calendar.add({
        title: "Meeting",
        start: "2026-02-14T10:00:00+01:00",
        end: "2026-02-14T11:00:00+01:00",
      });

      assert.throws(() => {
        calendar.edit(event.id, { end: "2026-02-14T09:00:00+01:00" });
      });
    });

  });

  describe("list", () => {
    it("returns all events when no filters given", () => {
      calendar.add({ title: "A", start: "2026-02-14T10:00:00+01:00" });
      calendar.add({ title: "B", start: "2026-02-15T10:00:00+01:00" });

      const events = calendar.list();
      assert.equal(events.length, 2);
    });

    it("returns events sorted by start time", () => {
      calendar.add({ title: "Later", start: "2026-02-14T14:00:00+01:00" });
      calendar.add({ title: "Earlier", start: "2026-02-14T09:00:00+01:00" });

      const events = calendar.list();
      assert.equal(events[0].title, "Earlier");
      assert.equal(events[1].title, "Later");
    });
  });

  describe("today", () => {
    it("returns only events occurring today", () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}T10:00:00+00:00`;
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T10:00:00+00:00`;

      calendar.add({ title: "Today event", start: todayStr });
      calendar.add({ title: "Tomorrow event", start: tomorrowStr });

      const events = calendar.today();
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Today event");
    });

    it("returns an empty array when no events today", () => {
      calendar.add({
        title: "Far future",
        start: "2099-12-31T10:00:00+01:00",
      });

      const events = calendar.today();
      assert.equal(events.length, 0);
    });

    it("includes events that span across today", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      calendar.add({
        title: "Multi-day event",
        start: `${fmtDate(yesterday)}T08:00:00+00:00`,
        end: `${fmtDate(tomorrow)}T18:00:00+00:00`,
      });

      const events = calendar.today();
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Multi-day event");
    });
  });

  describe("week", () => {
    it("returns events for the current week (Mon-Sun)", () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayStr = `${yyyy}-${mm}-${dd}T10:00:00+00:00`;

      calendar.add({ title: "This week", start: todayStr });
      calendar.add({
        title: "Far away",
        start: "2099-06-15T10:00:00+01:00",
      });

      const events = calendar.week();
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "This week");
    });

    it("returns an empty array when no events this week", () => {
      calendar.add({
        title: "Far future",
        start: "2099-12-31T10:00:00+01:00",
      });

      const events = calendar.week();
      assert.equal(events.length, 0);
    });
  });

  describe("listRange", () => {
    it("returns events within a date range", () => {
      calendar.add({ title: "In range", start: "2026-03-15T10:00:00+01:00" });
      calendar.add({
        title: "Out of range",
        start: "2026-05-01T10:00:00+01:00",
      });

      const events = calendar.listRange(
        "2026-03-01T00:00:00+01:00",
        "2026-03-31T23:59:59+01:00"
      );
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "In range");
    });

    it("expands recurring series into occurrences within the range", () => {
      const series = calendar.add({
        title: "Gymnastics",
        start: "2026-02-27T18:00:00+01:00",
        end: "2026-02-27T19:45:00+01:00",
        place: "Hoża 88",
        tz: "Europe/Warsaw",
        rrule: "FREQ=WEEKLY;BYDAY=FR",
      });

      const events = calendar.listRange(
        "2026-03-02T00:00:00+01:00",
        "2026-03-08T23:59:59+01:00"
      );

      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Gymnastics");
      assert.equal(events[0].seriesId, series.id);
      assert.equal(events[0].start, "2026-03-06T18:00:00+01:00");
      assert.equal(events[0].end, "2026-03-06T19:45:00+01:00");
    });

    it("honors skip/exDates when expanding recurring series", () => {
      const series = calendar.add({
        title: "Gymnastics",
        start: "2026-02-27T18:00:00+01:00",
        end: "2026-02-27T19:45:00+01:00",
        tz: "Europe/Warsaw",
        rrule: "FREQ=WEEKLY;BYDAY=FR",
      });

      calendar.skip(series.id, "2026-03-06T18:00:00+01:00");

      const events = calendar.listRange(
        "2026-03-02T00:00:00+01:00",
        "2026-03-08T23:59:59+01:00"
      );

      assert.equal(events.length, 0);
    });

    it("returns an empty array when no events in range", () => {
      calendar.add({ title: "Event", start: "2026-06-01T10:00:00+01:00" });

      const events = calendar.listRange(
        "2026-01-01T00:00:00+01:00",
        "2026-01-31T23:59:59+01:00"
      );
      assert.equal(events.length, 0);
    });

    it("includes events that overlap the range boundaries", () => {
      calendar.add({
        title: "Boundary event",
        start: "2026-02-28T22:00:00+01:00",
        end: "2026-03-01T02:00:00+01:00",
      });

      const events = calendar.listRange(
        "2026-03-01T00:00:00+01:00",
        "2026-03-31T23:59:59+01:00"
      );
      assert.equal(events.length, 1);
    });

    it("includes events exactly on range boundaries", () => {
      calendar.add({
        title: "Starts on boundary",
        start: "2026-03-01T00:00:00+01:00",
      });

      const events = calendar.listRange(
        "2026-03-01T00:00:00+01:00",
        "2026-03-01T00:00:00+01:00"
      );
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Starts on boundary");
    });

  });
});
