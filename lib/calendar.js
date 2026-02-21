import { createEvent, validateEvent } from "./event.js";
import { createStorage } from "./storage.js";
import { expandOccurrences } from "./recurrence.js";

export function createCalendar({ dataDir }) {
  const storage = createStorage(dataDir);

  function sortByStart(events) {
    return events.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  function overlaps(event, rangeStart, rangeEnd) {
    const evStart = new Date(event.start);
    const evEnd = event.end ? new Date(event.end) : evStart;
    return evStart <= rangeEnd && evEnd >= rangeStart;
  }

  return {
    add(obj) {
      const validation = validateEvent(obj);
      if (!validation.valid) {
        throw new Error(`Invalid event: ${validation.errors.join(", ")}`);
      }
      const event = createEvent(obj);
      storage.save(event);
      return event;
    },

    delete(eventId) {
      return storage.remove(eventId);
    },

    edit(eventId, updates) {
      const existing = storage.findById(eventId);
      if (!existing) {
        throw new Error(`Event not found: ${eventId}`);
      }

      const merged = { ...existing, ...updates };
      const validation = validateEvent(merged);
      if (!validation.valid) {
        throw new Error(`Invalid event: ${validation.errors.join(", ")}`);
      }

      const updated = storage.update(eventId, updates);
      return updated;
    },

    list() {
      return sortByStart(storage.loadAll());
    },

    today() {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const all = storage.loadAll();
      const filtered = all.filter((ev) => overlaps(ev, startOfDay, endOfDay));
      return sortByStart(filtered);
    },

    week() {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const all = storage.loadAll();
      const filtered = all.filter((ev) => overlaps(ev, monday, sunday));
      return sortByStart(filtered);
    },

    listRange(fromISO, toISO) {
      const rangeStart = new Date(fromISO);
      const rangeEnd = new Date(toISO);

      const all = storage.loadAll();
      const filtered = all.filter((ev) => overlaps(ev, rangeStart, rangeEnd));
      return sortByStart(filtered);
    },

    occurrences(eventId, fromISO, toISO) {
      const event = storage.findById(eventId);
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }
      if (!event.rrule || !event.tz) {
        throw new Error("Event is not recurring");
      }

      return expandOccurrences({
        dtStart: event.start,
        tz: event.tz,
        rrule: event.rrule,
        from: fromISO,
        to: toISO,
        mode: "wall",
        exDates: event.exDates || [],
      });
    },

    skip(eventId, dateISO) {
      const event = storage.findById(eventId);
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }
      if (!event.rrule || !event.tz) {
        throw new Error("Event is not recurring");
      }
      const exDates = Array.isArray(event.exDates) ? [...event.exDates] : [];
      if (!exDates.includes(dateISO)) {
        exDates.push(dateISO);
      }
      return storage.update(eventId, { exDates });
    },
  };
}
