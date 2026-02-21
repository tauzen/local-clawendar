import { createEvent, validateEvent } from "./event.js";
import { createStorage } from "./storage.js";
import { expandOccurrences, formatIsoInTimeZone } from "./recurrence.js";

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

  function isoUtc(date) {
    return date.toISOString().replace("Z", "+00:00");
  }

  function expandRecurringIntoEvents(recurringEvent, rangeStartISO, rangeEndISO) {
    const occStarts = expandOccurrences({
      dtStart: recurringEvent.start,
      tz: recurringEvent.tz,
      rrule: recurringEvent.rrule,
      from: rangeStartISO,
      to: rangeEndISO,
      mode: "wall",
      exDates: recurringEvent.exDates || [],
    });

    const baseStart = new Date(recurringEvent.start);
    const baseEnd = recurringEvent.end ? new Date(recurringEvent.end) : null;
    const durationMs = baseEnd ? baseEnd.getTime() - baseStart.getTime() : null;

    return occStarts.map((startISO) => {
      const startUtc = new Date(startISO);
      const ev = {
        id: `${recurringEvent.id}#${startISO}`,
        seriesId: recurringEvent.id,
        title: recurringEvent.title,
        start: startISO,
        place: recurringEvent.place,
        participants: recurringEvent.participants,
      };

      if (durationMs !== null) {
        const endUtc = new Date(startUtc.getTime() + durationMs);
        ev.end = formatIsoInTimeZone(endUtc, recurringEvent.tz);
      }

      return ev;
    });
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

      // Note: we expand recurring series into concrete occurrences for the requested range.
      const rangeStartISO = isoUtc(startOfDay);
      const rangeEndISO = isoUtc(endOfDay);

      const all = storage.loadAll();
      const singles = all.filter((ev) => !ev.rrule && overlaps(ev, startOfDay, endOfDay));
      const series = all.filter((ev) => ev.rrule && ev.tz);
      const occs = series.flatMap((ev) => expandRecurringIntoEvents(ev, rangeStartISO, rangeEndISO));

      const filteredOccs = occs.filter((ev) => overlaps(ev, startOfDay, endOfDay));
      return sortByStart([...singles, ...filteredOccs]);
    },

    week() {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const rangeStartISO = isoUtc(monday);
      const rangeEndISO = isoUtc(sunday);

      const all = storage.loadAll();
      const singles = all.filter((ev) => !ev.rrule && overlaps(ev, monday, sunday));
      const series = all.filter((ev) => ev.rrule && ev.tz);
      const occs = series.flatMap((ev) => expandRecurringIntoEvents(ev, rangeStartISO, rangeEndISO));

      const filteredOccs = occs.filter((ev) => overlaps(ev, monday, sunday));
      return sortByStart([...singles, ...filteredOccs]);
    },

    listRange(fromISO, toISO) {
      const rangeStart = new Date(fromISO);
      const rangeEnd = new Date(toISO);

      const all = storage.loadAll();

      const singles = all.filter((ev) => !ev.rrule && overlaps(ev, rangeStart, rangeEnd));
      const series = all.filter((ev) => ev.rrule && ev.tz);
      const occs = series.flatMap((ev) => expandRecurringIntoEvents(ev, fromISO, toISO));

      const filteredOccs = occs.filter((ev) => overlaps(ev, rangeStart, rangeEnd));
      return sortByStart([...singles, ...filteredOccs]);
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
