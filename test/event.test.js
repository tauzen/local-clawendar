import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEvent, validateEvent } from "../lib/event.js";

describe("createEvent", () => {
  it("creates an event with required fields only", () => {
    const event = createEvent({
      title: "Lunch",
      start: "2026-02-14T12:00:00+01:00",
    });

    assert.ok(event.id, "should generate an id");
    assert.equal(event.title, "Lunch");
    assert.equal(event.start, "2026-02-14T12:00:00+01:00");
    assert.ok(event.createdAt, "should set createdAt");
  });

  it("creates an event with all fields", () => {
    const event = createEvent({
      title: "Team standup",
      start: "2026-02-14T10:00:00+01:00",
      end: "2026-02-14T10:30:00+01:00",
      place: "Room 101",
      participants: ["Alice", "Bob"],
    });

    assert.equal(event.title, "Team standup");
    assert.equal(event.start, "2026-02-14T10:00:00+01:00");
    assert.equal(event.end, "2026-02-14T10:30:00+01:00");
    assert.equal(event.place, "Room 101");
    assert.deepEqual(event.participants, ["Alice", "Bob"]);
  });

  it("generates a unique id for each event", () => {
    const a = createEvent({ title: "A", start: "2026-02-14T10:00:00+01:00" });
    const b = createEvent({ title: "B", start: "2026-02-14T11:00:00+01:00" });
    assert.notEqual(a.id, b.id);
  });

  it("defaults end to one hour after start when not provided", () => {
    const event = createEvent({
      title: "Quick chat",
      start: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(event.end, "2026-02-14T11:00:00+01:00");
  });

  it("leaves place undefined when not provided", () => {
    const event = createEvent({
      title: "Call",
      start: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(event.place, undefined);
  });

  it("leaves participants undefined when not provided", () => {
    const event = createEvent({
      title: "Call",
      start: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(event.participants, undefined);
  });

  it("stores start time with timezone offset preserved", () => {
    const event = createEvent({
      title: "Tokyo meeting",
      start: "2026-02-14T10:00:00+09:00",
    });

    assert.equal(event.start, "2026-02-14T10:00:00+09:00");
  });
});

describe("validateEvent", () => {
  it("accepts a valid event with all fields", () => {
    const result = validateEvent({
      title: "Meeting",
      start: "2026-02-14T10:00:00+01:00",
      end: "2026-02-14T11:00:00+01:00",
      place: "Office",
      participants: ["Alice"],
    });

    assert.equal(result.valid, true);
  });

  it("accepts a valid event with required fields only", () => {
    const result = validateEvent({
      title: "Meeting",
      start: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(result.valid, true);
  });

  it("rejects an event without a title", () => {
    const result = validateEvent({
      start: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("title")));
  });

  it("rejects an event with an empty title", () => {
    const result = validateEvent({
      title: "",
      start: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(result.valid, false);
  });

  it("rejects an event without a start time", () => {
    const result = validateEvent({
      title: "Meeting",
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("start")));
  });

  it("rejects an event where start is not a valid ISO 8601 datetime", () => {
    const result = validateEvent({
      title: "Meeting",
      start: "not-a-date",
    });

    assert.equal(result.valid, false);
  });

  it("rejects an event where start has no timezone offset", () => {
    const result = validateEvent({
      title: "Meeting",
      start: "2026-02-14T10:00:00",
    });

    assert.equal(result.valid, false);
  });

  it("rejects an event where end is before start", () => {
    const result = validateEvent({
      title: "Meeting",
      start: "2026-02-14T11:00:00+01:00",
      end: "2026-02-14T10:00:00+01:00",
    });

    assert.equal(result.valid, false);
  });

  it("rejects an event where participants is not an array", () => {
    const result = validateEvent({
      title: "Meeting",
      start: "2026-02-14T10:00:00+01:00",
      participants: "Alice",
    });

    assert.equal(result.valid, false);
  });
});
