import { randomUUID } from "node:crypto";

// Regex: ISO 8601 datetime with mandatory timezone offset (e.g. +01:00 or -05:00 or +00:00)
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

export function isStrictISODateTimeWithOffset(isoString) {
  if (typeof isoString !== "string" || !ISO_WITH_OFFSET.test(isoString)) {
    return false;
  }

  const year = parseInt(isoString.slice(0, 4), 10);
  const month = parseInt(isoString.slice(5, 7), 10);
  const day = parseInt(isoString.slice(8, 10), 10);
  const hour = parseInt(isoString.slice(11, 13), 10);
  const minute = parseInt(isoString.slice(14, 16), 10);
  const second = parseInt(isoString.slice(17, 19), 10);

  const offsetSign = isoString.slice(-6, -5);
  const offsetH = parseInt(isoString.slice(-5, -3), 10);
  const offsetM = parseInt(isoString.slice(-2), 10);

  if (offsetH > 23 || offsetM > 59) {
    return false;
  }

  const parsed = new Date(isoString);
  if (isNaN(parsed.getTime())) {
    return false;
  }

  const totalOffsetMin = (offsetSign === "+" ? 1 : -1) * (offsetH * 60 + offsetM);
  const localMs = parsed.getTime() + totalOffsetMin * 60 * 1000;
  const local = new Date(localMs);

  return (
    local.getUTCFullYear() === year
    && local.getUTCMonth() + 1 === month
    && local.getUTCDate() === day
    && local.getUTCHours() === hour
    && local.getUTCMinutes() === minute
    && local.getUTCSeconds() === second
  );
}

/**
 * Parse an ISO 8601 datetime string with timezone offset and add hours.
 * Returns a new ISO 8601 string with the same offset.
 */
function addHours(isoString, hours) {
  const offsetSign = isoString.slice(-6, -5);
  const offsetH = parseInt(isoString.slice(-5, -3), 10);
  const offsetM = parseInt(isoString.slice(-2), 10);
  const offset = `${offsetSign}${String(offsetH).padStart(2, "0")}:${String(offsetM).padStart(2, "0")}`;

  const date = new Date(isoString);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);

  // Compute the local time components in the original offset
  const totalOffsetMin = (offsetSign === "+" ? 1 : -1) * (offsetH * 60 + offsetM);
  const utcMs = date.getTime();
  const localMs = utcMs + totalOffsetMin * 60 * 1000;
  const local = new Date(localMs);

  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const min = String(local.getUTCMinutes()).padStart(2, "0");
  const ss = String(local.getUTCSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offset}`;
}

export function createEvent(obj) {
  const event = {
    id: randomUUID(),
    title: obj.title,
    start: obj.start,
    end: obj.end !== undefined ? obj.end : addHours(obj.start, 1),
    createdAt: new Date().toISOString(),
  };

  if (obj.place !== undefined) {
    event.place = obj.place;
  }
  if (obj.participants !== undefined) {
    event.participants = obj.participants;
  }
  if (obj.tz !== undefined) {
    event.tz = obj.tz;
  }
  if (obj.rrule !== undefined) {
    event.rrule = obj.rrule;
  }
  if (obj.exDates !== undefined) {
    event.exDates = obj.exDates;
  }

  return event;
}

export function validateEvent(obj) {
  const errors = [];

  if (!obj.title || typeof obj.title !== "string" || obj.title.trim() === "") {
    errors.push("title is required and must be a non-empty string");
  }

  if (!obj.start) {
    errors.push("start is required");
  } else if (!isStrictISODateTimeWithOffset(obj.start)) {
    errors.push("start is not a valid date");
  }

  if (obj.end !== undefined) {
    if (!isStrictISODateTimeWithOffset(obj.end)) {
      errors.push("end must be a valid ISO 8601 datetime with timezone offset");
    } else if (obj.start && isStrictISODateTimeWithOffset(obj.start)) {
      if (new Date(obj.end) <= new Date(obj.start)) {
        errors.push("end must be after start");
      }
    }
  }

  if (obj.participants !== undefined && !Array.isArray(obj.participants)) {
    errors.push("participants must be an array");
  }

  if (obj.tz !== undefined && (typeof obj.tz !== "string" || obj.tz.trim() === "")) {
    errors.push("tz must be a non-empty string");
  }

  if (obj.rrule !== undefined) {
    if (typeof obj.rrule !== "string" || obj.rrule.trim() === "") {
      errors.push("rrule must be a non-empty string");
    }
    if (!obj.tz) {
      errors.push("tz is required for recurring events");
    }
  }

  if (obj.exDates !== undefined && !Array.isArray(obj.exDates)) {
    errors.push("exDates must be an array");
  }

  return { valid: errors.length === 0, errors };
}
