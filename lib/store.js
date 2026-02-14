import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const STORE_PATH = join(homedir(), '.clawendar.json');

function load() {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function save(data) {
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Key for a date: "YYYY-MM-DD"
 */
function dateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Add an event on a given date.
 */
export function addEvent(year, month, day, text) {
  const data = load();
  const key = dateKey(year, month, day);
  if (!data[key]) data[key] = [];
  data[key].push(text);
  save(data);
}

/**
 * Remove an event by index on a given date.
 */
export function removeEvent(year, month, day, index) {
  const data = load();
  const key = dateKey(year, month, day);
  if (!data[key] || index < 0 || index >= data[key].length) return false;
  data[key].splice(index, 1);
  if (data[key].length === 0) delete data[key];
  save(data);
  return true;
}

/**
 * Get events for a specific date. Returns an array of strings.
 */
export function getEvents(year, month, day) {
  const data = load();
  return data[dateKey(year, month, day)] || [];
}

/**
 * Get a Set of day numbers that have events in the given month.
 */
export function getEventDaysForMonth(year, month) {
  const data = load();
  const days = new Set();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  for (const key of Object.keys(data)) {
    if (key.startsWith(prefix) && data[key].length > 0) {
      days.add(parseInt(key.slice(8), 10));
    }
  }
  return days;
}

/**
 * Get all events for a given month. Returns Map<day, string[]>.
 */
export function getEventsForMonth(year, month) {
  const data = load();
  const result = new Map();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  for (const key of Object.keys(data)) {
    if (key.startsWith(prefix) && data[key].length > 0) {
      const day = parseInt(key.slice(8), 10);
      result.set(day, data[key]);
    }
  }
  return result;
}
