import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createCalendar } from "../lib/calendar.js";
import { makeTmpDir } from "./_helpers.js";

describe("multi-calendar + categories (spec tests)", () => {
  let tmpDir;
  let calendar;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    calendar = createCalendar({ dataDir: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("event schema", () => {
    it("stores calendar id when adding an event", () => {
      const event = calendar.add({
        title: "Doctor",
        start: "2026-03-08T10:00:00+01:00",
        calendarId: "personal",
      });

      assert.equal(event.calendarId, "personal");
    });

    it("stores categories array when adding an event", () => {
      const event = calendar.add({
        title: "Lukasz birthday",
        start: "2026-12-24T00:00:00+01:00",
        end: "2026-12-24T23:59:59+01:00",
        calendarId: "birthdays",
        categories: ["family", "birthday"],
      });

      assert.deepEqual(event.categories, ["family", "birthday"]);
    });

    it("rejects empty calendar id", () => {
      assert.throws(() => {
        calendar.add({
          title: "Bad event",
          start: "2026-03-08T10:00:00+01:00",
          calendarId: "",
        });
      });
    });

    it("rejects reserved calendar id 'default'", () => {
      assert.throws(() => {
        calendar.add({
          title: "Bad event",
          start: "2026-03-08T10:00:00+01:00",
          calendarId: "default",
        });
      });
    });

    it("rejects non-array categories", () => {
      assert.throws(() => {
        calendar.add({
          title: "Bad categories",
          start: "2026-03-08T10:00:00+01:00",
          calendarId: "personal",
          categories: "birthday",
        });
      });
    });

    it("rejects categories with empty strings", () => {
      assert.throws(() => {
        calendar.add({
          title: "Bad categories",
          start: "2026-03-08T10:00:00+01:00",
          calendarId: "personal",
          categories: ["birthday", ""],
        });
      });
    });

    it("normalizes duplicate categories case-insensitively", () => {
      const event = calendar.add({
        title: "Tagged event",
        start: "2026-03-08T10:00:00+01:00",
        calendarId: "personal",
        categories: ["Family", "family", "FAMILY"],
      });

      assert.deepEqual(event.categories, ["family"]);
    });

    it("rejects editing event calendarId to reserved 'default'", () => {
      const event = calendar.add({
        title: "Normal event",
        start: "2026-03-08T10:00:00+01:00",
        calendarId: "personal",
      });

      assert.throws(() => {
        calendar.edit(event.id, { calendarId: "default" });
      });
    });
  });

  describe("calendar-level filters", () => {
    it("lists only events from selected calendar", () => {
      calendar.add({
        title: "Personal meeting",
        start: "2026-03-10T10:00:00+01:00",
        calendarId: "personal",
      });
      calendar.add({
        title: "Public holiday",
        start: "2026-03-10T00:00:00+01:00",
        calendarId: "holidays",
      });

      const events = calendar.list({ calendarId: "personal" });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Personal meeting");
    });

    it("today() supports calendar filter", () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");

      calendar.add({
        title: "Birthday today",
        start: `${yyyy}-${mm}-${dd}T00:00:00+00:00`,
        calendarId: "birthdays",
      });
      calendar.add({
        title: "Personal today",
        start: `${yyyy}-${mm}-${dd}T12:00:00+00:00`,
        calendarId: "personal",
      });

      const events = calendar.today({ calendarId: "birthdays" });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Birthday today");
    });

    it("listRange() supports multiple calendar ids", () => {
      calendar.add({
        title: "Birthday 1",
        start: "2026-03-11T00:00:00+01:00",
        calendarId: "birthdays",
      });
      calendar.add({
        title: "Holiday 1",
        start: "2026-03-12T00:00:00+01:00",
        calendarId: "holidays",
      });
      calendar.add({
        title: "Personal 1",
        start: "2026-03-13T10:00:00+01:00",
        calendarId: "personal",
      });

      const events = calendar.listRange(
        "2026-03-01T00:00:00+01:00",
        "2026-03-31T23:59:59+01:00",
        { calendarIds: ["birthdays", "holidays"] }
      );

      assert.equal(events.length, 2);
      assert.deepEqual(events.map((e) => e.title), ["Birthday 1", "Holiday 1"]);
    });

    it("treats calendarId=default as events without calendarId", () => {
      calendar.add({
        title: "Default event",
        start: "2026-03-14T10:00:00+01:00",
      });
      calendar.add({
        title: "Holiday event",
        start: "2026-03-14T00:00:00+01:00",
        calendarId: "holidays",
      });

      const events = calendar.list({ calendarId: "default" });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Default event");
    });

    it("supports default inside calendarIds list", () => {
      calendar.add({
        title: "Default event",
        start: "2026-03-15T10:00:00+01:00",
      });
      calendar.add({
        title: "Holiday event",
        start: "2026-03-15T00:00:00+01:00",
        calendarId: "holidays",
      });
      calendar.add({
        title: "Personal event",
        start: "2026-03-15T12:00:00+01:00",
        calendarId: "personal",
      });

      const events = calendar.list({ calendarIds: ["default", "holidays"] });
      assert.equal(events.length, 2);
      assert.deepEqual(events.map((e) => e.title), ["Holiday event", "Default event"]);
    });
  });

  describe("category filters", () => {
    it("filters events by one category", () => {
      calendar.add({
        title: "Lukasz birthday",
        start: "2026-12-24T00:00:00+01:00",
        calendarId: "birthdays",
        categories: ["birthday", "family"],
      });
      calendar.add({
        title: "Roadmap planning",
        start: "2026-12-24T10:00:00+01:00",
        calendarId: "personal",
        categories: ["work"],
      });

      const events = calendar.list({ categoriesAny: ["family"] });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Lukasz birthday");
    });

    it("supports categoriesAny (OR semantics)", () => {
      calendar.add({
        title: "A",
        start: "2026-03-01T09:00:00+01:00",
        calendarId: "personal",
        categories: ["family"],
      });
      calendar.add({
        title: "B",
        start: "2026-03-01T10:00:00+01:00",
        calendarId: "personal",
        categories: ["travel"],
      });
      calendar.add({
        title: "C",
        start: "2026-03-01T11:00:00+01:00",
        calendarId: "personal",
        categories: ["work"],
      });

      const events = calendar.list({ categoriesAny: ["family", "travel"] });
      assert.equal(events.length, 2);
      assert.deepEqual(events.map((e) => e.title), ["A", "B"]);
    });

    it("supports categoriesAll (AND semantics)", () => {
      calendar.add({
        title: "A",
        start: "2026-03-01T09:00:00+01:00",
        calendarId: "personal",
        categories: ["family", "birthday"],
      });
      calendar.add({
        title: "B",
        start: "2026-03-01T10:00:00+01:00",
        calendarId: "personal",
        categories: ["family"],
      });

      const events = calendar.list({ categoriesAll: ["family", "birthday"] });
      assert.equal(events.length, 1);
      assert.equal(events[0].title, "A");
    });

    it("applies calendar + categories together", () => {
      calendar.add({
        title: "Holiday (country)",
        start: "2026-11-11T00:00:00+01:00",
        calendarId: "holidays",
        categories: ["country"],
      });
      calendar.add({
        title: "Birthday (family)",
        start: "2026-11-11T00:00:00+01:00",
        calendarId: "birthdays",
        categories: ["family"],
      });

      const events = calendar.list({
        calendarId: "birthdays",
        categoriesAny: ["family"],
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].title, "Birthday (family)");
    });
  });

  describe("recurrence behavior", () => {
    it("keeps calendarId/categories when expanding occurrences", () => {
      const series = calendar.add({
        title: "Weekly birthday ping",
        start: "2026-03-02T09:00:00+01:00",
        end: "2026-03-02T10:00:00+01:00",
        tz: "Europe/Warsaw",
        rrule: "FREQ=WEEKLY;BYDAY=MO",
        calendarId: "birthdays",
        categories: ["birthday", "family"],
      });

      const events = calendar.listRange(
        "2026-03-01T00:00:00+01:00",
        "2026-03-31T23:59:59+02:00",
        { calendarId: "birthdays", categoriesAny: ["birthday"] }
      );

      assert.ok(events.length > 0);
      for (const ev of events) {
        assert.equal(ev.seriesId, series.id);
        assert.equal(ev.calendarId, "birthdays");
        assert.deepEqual(ev.categories, ["birthday", "family"]);
      }
    });

    it("filters recurring occurrences by category", () => {
      calendar.add({
        title: "Family recurring",
        start: "2026-03-02T09:00:00+01:00",
        end: "2026-03-02T10:00:00+01:00",
        tz: "Europe/Warsaw",
        rrule: "FREQ=WEEKLY;BYDAY=MO",
        calendarId: "personal",
        categories: ["family"],
      });
      calendar.add({
        title: "Work recurring",
        start: "2026-03-03T09:00:00+01:00",
        end: "2026-03-03T10:00:00+01:00",
        tz: "Europe/Warsaw",
        rrule: "FREQ=WEEKLY;BYDAY=TU",
        calendarId: "personal",
        categories: ["work"],
      });

      const events = calendar.listRange(
        "2026-03-01T00:00:00+01:00",
        "2026-03-31T23:59:59+02:00",
        { categoriesAny: ["family"] }
      );

      assert.ok(events.length > 0);
      assert.ok(events.every((e) => e.title === "Family recurring"));
    });
  });
});
