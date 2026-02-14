#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { renderMonth, renderYear } from '../lib/render.js';
import { addEvent, removeEvent, getEvents, getEventDaysForMonth, getEventsForMonth } from '../lib/store.js';

const USAGE = `clawendar — a minimal calendar CLI

Usage:
  clawendar                          Show current month
  clawendar <month> <year>           Show a specific month (month: 1-12)
  clawendar --year [YYYY]            Show full year
  clawendar add <YYYY-MM-DD> <text>  Add an event
  clawendar list <YYYY-MM-DD>        List events for a date
  clawendar remove <YYYY-MM-DD> <n>  Remove event #n (0-indexed) from a date
  clawendar --help                   Show this help

Options:
  -y, --year     Show full year view
  -h, --help     Show help

Examples:
  clawendar                          # current month
  clawendar 2 2026                   # February 2026
  clawendar --year                   # current year
  clawendar --year 2025              # full year 2025
  clawendar add 2026-02-14 "Date night"
  clawendar list 2026-02-14
  clawendar remove 2026-02-14 0
`;

function parseDate(str) {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-indexed
  const day = parseInt(m[3], 10);
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

function main() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      year: { type: 'boolean', short: 'y', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const [cmd, ...rest] = positionals;

  // --- Sub-commands: add, list, remove ---
  if (cmd === 'add') {
    const [dateStr, ...textParts] = rest;
    const text = textParts.join(' ');
    if (!dateStr || !text) {
      console.error('Usage: clawendar add <YYYY-MM-DD> <text>');
      process.exit(1);
    }
    const d = parseDate(dateStr);
    if (!d) {
      console.error(`Invalid date: ${dateStr}. Use YYYY-MM-DD format.`);
      process.exit(1);
    }
    addEvent(d.year, d.month, d.day, text);
    console.log(`Added event on ${dateStr}: ${text}`);
    return;
  }

  if (cmd === 'list') {
    const [dateStr] = rest;
    if (!dateStr) {
      console.error('Usage: clawendar list <YYYY-MM-DD>');
      process.exit(1);
    }
    const d = parseDate(dateStr);
    if (!d) {
      console.error(`Invalid date: ${dateStr}. Use YYYY-MM-DD format.`);
      process.exit(1);
    }
    const events = getEvents(d.year, d.month, d.day);
    if (events.length === 0) {
      console.log(`No events on ${dateStr}.`);
    } else {
      console.log(`Events on ${dateStr}:`);
      events.forEach((e, i) => console.log(`  ${i}. ${e}`));
    }
    return;
  }

  if (cmd === 'remove') {
    const [dateStr, indexStr] = rest;
    if (!dateStr || indexStr === undefined) {
      console.error('Usage: clawendar remove <YYYY-MM-DD> <index>');
      process.exit(1);
    }
    const d = parseDate(dateStr);
    if (!d) {
      console.error(`Invalid date: ${dateStr}. Use YYYY-MM-DD format.`);
      process.exit(1);
    }
    const index = parseInt(indexStr, 10);
    if (Number.isNaN(index)) {
      console.error(`Invalid index: ${indexStr}`);
      process.exit(1);
    }
    if (removeEvent(d.year, d.month, d.day, index)) {
      console.log(`Removed event #${index} from ${dateStr}.`);
    } else {
      console.error(`No event at index ${index} on ${dateStr}.`);
      process.exit(1);
    }
    return;
  }

  // --- Calendar display ---
  if (values.year) {
    const y = cmd ? parseInt(cmd, 10) : new Date().getFullYear();
    if (Number.isNaN(y)) {
      console.error(`Invalid year: ${cmd}`);
      process.exit(1);
    }
    const eventsByMonth = {};
    for (let m = 0; m < 12; m++) {
      const days = getEventDaysForMonth(y, m);
      if (days.size > 0) eventsByMonth[m] = days;
    }
    console.log(renderYear(y, eventsByMonth));
    return;
  }

  // Show a specific month, or current month
  let year, month;
  if (cmd && rest.length >= 1) {
    month = parseInt(cmd, 10) - 1;
    year = parseInt(rest[0], 10);
    if (Number.isNaN(month) || Number.isNaN(year) || month < 0 || month > 11) {
      console.error('Usage: clawendar <month 1-12> <year>');
      process.exit(1);
    }
  } else if (cmd) {
    // Single argument — could be a year if 4 digits, otherwise invalid
    const n = parseInt(cmd, 10);
    if (cmd.length === 4 && !Number.isNaN(n)) {
      // Treat as year, show full year
      const eventsByMonth = {};
      for (let m = 0; m < 12; m++) {
        const days = getEventDaysForMonth(n, m);
        if (days.size > 0) eventsByMonth[m] = days;
      }
      console.log(renderYear(n, eventsByMonth));
      return;
    }
    console.error(`Unknown command: ${cmd}\nRun clawendar --help for usage.`);
    process.exit(1);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const eventDays = getEventDaysForMonth(year, month);
  console.log(renderMonth(year, month, eventDays));

  // Print events summary below calendar
  const eventsMap = getEventsForMonth(year, month);
  if (eventsMap.size > 0) {
    console.log('');
    const sortedDays = [...eventsMap.keys()].sort((a, b) => a - b);
    for (const day of sortedDays) {
      const dd = String(day).padStart(2, '0');
      const mm = String(month + 1).padStart(2, '0');
      console.log(`  ${year}-${mm}-${dd}:`);
      for (const ev of eventsMap.get(day)) {
        console.log(`    - ${ev}`);
      }
    }
  }
}

main();
