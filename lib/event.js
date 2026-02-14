import { randomUUID } from "node:crypto";

// Regex: ISO 8601 datetime with mandatory timezone offset (e.g. +01:00 or -05:00 or +00:00)
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

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

  return event;
}

export function validateEvent(obj) {
  const errors = [];

  if (!obj.title || typeof obj.title !== "string" || obj.title.trim() === "") {
    errors.push("title is required and must be a non-empty string");
  }

  if (!obj.start) {
    errors.push("start is required");
  } else if (typeof obj.start !== "string" || !ISO_WITH_OFFSET.test(obj.start)) {
    errors.push("start must be a valid ISO 8601 datetime with timezone offset");
  } else if (isNaN(new Date(obj.start).getTime())) {
    errors.push("start is not a valid date");
  }

  if (obj.end !== undefined) {
    if (typeof obj.end !== "string" || !ISO_WITH_OFFSET.test(obj.end)) {
      errors.push("end must be a valid ISO 8601 datetime with timezone offset");
    } else if (obj.start && ISO_WITH_OFFSET.test(obj.start)) {
      if (new Date(obj.end) <= new Date(obj.start)) {
        errors.push("end must be after start");
      }
    }
  }

  if (obj.participants !== undefined && !Array.isArray(obj.participants)) {
    errors.push("participants must be an array");
  }

  return { valid: errors.length === 0, errors };
}
