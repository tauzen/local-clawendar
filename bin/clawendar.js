#!/usr/bin/env node

import { createCalendar } from "../lib/calendar.js";
import { isStrictISODateTimeWithOffset } from "../lib/event.js";
import { migrateJsonToSqlite } from "../lib/migrate.js";
import path from "node:path";
import os from "node:os";

const dataDir = process.env.CLAWENDAR_DATA_DIR || path.join(os.homedir(), ".clawendar");
const calendar = createCalendar({ dataDir });

const args = process.argv.slice(2);
const command = args[0];

const COMMAND_SPECS = {
  add: {
    requiresTitle: true,
    requiredFlags: ["start"],
    allowedFlags: ["start", "end", "place", "participants", "tz", "rrule", "calendar", "category"],
  },
  today: {
    allowedFlags: ["calendar", "calendars", "category-any", "category-all"],
  },
  week: {
    allowedFlags: ["calendar", "calendars", "category-any", "category-all"],
  },
  list: {
    requiredFlags: ["from", "to"],
    allowedFlags: ["from", "to", "calendar", "calendars", "category-any", "category-all"],
  },
  occurrences: {
    requiresEventId: true,
    requiredFlags: ["from", "to"],
    allowedFlags: ["from", "to"],
  },
  skip: {
    requiresEventId: true,
    requiredFlags: ["date"],
    allowedFlags: ["date"],
  },
  delete: {
    requiresEventId: true,
    allowedFlags: [],
  },
  edit: {
    requiresEventId: true,
    allowedFlags: ["title", "place", "start", "end", "participants", "calendar", "category"],
  },
};

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    if (!key) {
      throw new Error("Invalid empty flag");
    }

    if (i + 1 >= args.length || args[i + 1].startsWith("--")) {
      throw new Error(`Flag --${key} is missing a value`);
    }

    const val = args[i + 1];
    if (flags[key] === undefined) {
      flags[key] = val;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(val);
    } else {
      flags[key] = [flags[key], val];
    }
    i++;
  }
  return flags;
}

function parseCsv(value) {
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getManyFlag(flags, key) {
  if (flags[key] === undefined) return [];
  return Array.isArray(flags[key]) ? flags[key] : [flags[key]];
}

function parseCategories(flags) {
  const repeated = getManyFlag(flags, "category").flatMap((v) => parseCsv(v));
  const any = flags["category-any"] ? parseCsv(flags["category-any"]) : [];
  const all = flags["category-all"] ? parseCsv(flags["category-all"]) : [];

  const clean = (arr) => arr.map((s) => s.trim()).filter(Boolean);

  return {
    categoryValues: clean(repeated),
    categoryAny: clean(any),
    categoryAll: clean(all),
  };
}

function buildFilterFlags(flags) {
  const filters = {};
  if (flags.calendar !== undefined) {
    filters.calendarId = flags.calendar;
  }
  if (flags.calendars !== undefined) {
    filters.calendarIds = parseCsv(flags.calendars);
  }

  const categories = parseCategories(flags);
  if (categories.categoryAny.length > 0) {
    filters.categoriesAny = categories.categoryAny;
  }
  if (categories.categoryAll.length > 0) {
    filters.categoriesAll = categories.categoryAll;
  }

  return filters;
}

function formatEvent(event) {
  let line = `${event.id}  ${event.start}  ${event.title}`;
  if (event.place) {
    line += `  [${event.place}]`;
  }
  if (event.participants && event.participants.length > 0) {
    line += `  (${event.participants.join(", ")})`;
  }
  if (event.calendarId) {
    line += `  <${event.calendarId}>`;
  }
  if (event.categories && event.categories.length > 0) {
    line += `  #${event.categories.join(",#")}`;
  }
  if (event.rrule) {
    line += "  {series}";
  } else if (event.seriesId) {
    line += "  {occurrence}";
  }
  return line;
}

function printEvents(events) {
  if (events.length === 0) {
    console.log("No events.");
    return;
  }
  for (const ev of events) {
    console.log(formatEvent(ev));
  }
}

function printUsage() {
  process.stderr.write(
    `Usage: clawendar <command> [options]

Commands:
  add <title> --start <datetime> [--end <datetime>] [--place <place>] [--participants <a,b>] [--tz <iana>] [--rrule <rrule>] [--calendar <id>] [--category <name> ...]
  today [--calendar <id>] [--calendars <a,b>] [--category-any <a,b>] [--category-all <a,b>]   List today's events
  week [--calendar <id>] [--calendars <a,b>] [--category-any <a,b>] [--category-all <a,b>]    List this week's events
  list --from <datetime> --to <datetime> [--calendar <id>] [--calendars <a,b>] [--category-any <a,b>] [--category-all <a,b>]  List events in range
  occurrences <id> --from <datetime> --to <datetime>  Expand recurring event
  skip <id> --date <datetime>    Skip one recurring instance
  delete <id>                    Delete an event
  edit <id> [--title <t>] [--start <datetime>] [--end <datetime>] [--place <p>] [--participants <a,b>] [--calendar <id>] [--category <name> ...]  Edit an event
  migrate                        Migrate events from events.json to SQLite
`
  );
}

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function getAddTitle(commandArgs) {
  for (let i = 1; i < commandArgs.length; i++) {
    if (commandArgs[i].startsWith("--")) {
      i++;
      continue;
    }
    return commandArgs[i];
  }
  return null;
}

function validateCommandInput(command, commandArgs, flags) {
  const spec = COMMAND_SPECS[command];
  if (!spec) {
    return;
  }

  if (spec.requiresEventId && !commandArgs[1]) {
    fail("event id is required");
  }

  if (spec.requiresTitle && !getAddTitle(commandArgs)) {
    fail("title is required");
  }

  if (spec.requiredFlags) {
    for (const requiredFlag of spec.requiredFlags) {
      if (!flags[requiredFlag]) {
        fail(`--${requiredFlag} is required`);
      }
    }
  }

  if (spec.allowedFlags) {
    const allowed = new Set(spec.allowedFlags);
    for (const key of Object.keys(flags)) {
      if (!allowed.has(key)) {
        fail(`Unknown flag --${key} for command ${command}`);
      }
    }
  }
}

function handleAdd(commandArgs, flags) {
  const title = getAddTitle(commandArgs);
  const eventData = {
    title,
    start: flags.start,
  };
  if (flags.end) eventData.end = flags.end;
  if (flags.place) eventData.place = flags.place;
  if (flags.participants) eventData.participants = parseCsv(flags.participants);
  if (flags.tz) eventData.tz = flags.tz;
  if (flags.rrule) eventData.rrule = flags.rrule;
  if (flags.calendar !== undefined) eventData.calendarId = flags.calendar;

  const categories = parseCategories(flags);
  if (categories.categoryValues.length > 0) {
    eventData.categories = categories.categoryValues;
  }

  const event = calendar.add(eventData);
  console.log(formatEvent(event));
}

function handleToday(commandArgs, flags) {
  const events = calendar.today(buildFilterFlags(flags));
  printEvents(events);
}

function handleWeek(commandArgs, flags) {
  const events = calendar.week(buildFilterFlags(flags));
  printEvents(events);
}

function handleList(commandArgs, flags) {
  const events = calendar.listRange(flags.from, flags.to, buildFilterFlags(flags));
  printEvents(events);
}

function handleOccurrences(commandArgs, flags) {
  const id = commandArgs[1];
  const dates = calendar.occurrences(id, flags.from, flags.to);
  if (dates.length === 0) {
    console.log("No events.");
    return;
  }

  for (const iso of dates) {
    console.log(`${id}  ${iso}  {occurrence}`);
  }
}

function handleSkip(commandArgs, flags) {
  const id = commandArgs[1];
  if (!isStrictISODateTimeWithOffset(flags.date)) {
    fail("--date must be strict ISO datetime with offset");
  }

  calendar.skip(id, flags.date);
  console.log(`Skipped occurrence ${flags.date} for event ${id}`);
}

function handleDelete(commandArgs) {
  const id = commandArgs[1];
  const result = calendar.delete(id);
  if (!result) {
    fail(`event not found: ${id}`);
  }
  console.log(`Deleted event ${id}`);
}

function handleEdit(commandArgs, flags) {
  const id = commandArgs[1];

  const updates = {};
  if (flags.title) updates.title = flags.title;
  if (flags.place) updates.place = flags.place;
  if (flags.start) updates.start = flags.start;
  if (flags.end) updates.end = flags.end;
  if (flags.participants) updates.participants = parseCsv(flags.participants);
  if (flags.calendar !== undefined) updates.calendarId = flags.calendar;

  const categories = parseCategories(flags);
  if (categories.categoryValues.length > 0) {
    updates.categories = categories.categoryValues;
  }

  const updated = calendar.edit(id, updates);
  console.log(formatEvent(updated));
}

const handlers = {
  add: handleAdd,
  today: handleToday,
  week: handleWeek,
  list: handleList,
  occurrences: handleOccurrences,
  skip: handleSkip,
  delete: handleDelete,
  edit: handleEdit,
};

if (!command || args.includes("--help") || args.includes("-h") || command === "help") {
  printUsage();
  process.exit(0);
}

try {
  const handler = handlers[command];
  if (!handler) {
    printUsage();
    process.exit(1);
  }

  const commandArgs = args;
  const flagArgsStart = command === "add" ? 1 : (COMMAND_SPECS[command]?.requiresEventId ? 2 : 1);
  const flags = parseFlags(commandArgs.slice(flagArgsStart));
  validateCommandInput(command, commandArgs, flags);
  handler(commandArgs, flags);
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
