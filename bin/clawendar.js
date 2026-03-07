#!/usr/bin/env node

import { createCalendar } from "../lib/calendar.js";
import { isStrictISODateTimeWithOffset } from "../lib/event.js";
import path from "node:path";
import os from "node:os";

const dataDir = process.env.CLAWENDAR_DATA_DIR || path.join(os.homedir(), ".clawendar");
const calendar = createCalendar({ dataDir });

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      const key = args[i].slice(2);
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
  }
  return flags;
}

function getManyFlag(flags, key) {
  if (flags[key] === undefined) return [];
  return Array.isArray(flags[key]) ? flags[key] : [flags[key]];
}

function parseCategories(flags) {
  const repeated = getManyFlag(flags, "category").flatMap((v) => String(v).split(","));
  const any = flags["category-any"] ? String(flags["category-any"]).split(",") : [];
  const all = flags["category-all"] ? String(flags["category-all"]).split(",") : [];

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
    filters.calendarIds = String(flags.calendars).split(",").map((s) => s.trim()).filter(Boolean);
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
`
  );
}

if (!command || args.includes("--help") || args.includes("-h") || command === "help") {
  printUsage();
  process.exit(0);
}

try {
  switch (command) {
    case "add": {
      let title = null;
      for (let i = 1; i < args.length; i++) {
        if (args[i].startsWith("--")) {
          i++;
          continue;
        }
        title = args[i];
        break;
      }

      const flags = parseFlags(args.slice(1));

      if (!title) {
        process.stderr.write("Error: title is required\n");
        process.exit(1);
      }
      if (!flags.start) {
        process.stderr.write("Error: --start is required\n");
        process.exit(1);
      }

      const eventData = {
        title,
        start: flags.start,
      };
      if (flags.end) eventData.end = flags.end;
      if (flags.place) eventData.place = flags.place;
      if (flags.participants) eventData.participants = String(flags.participants).split(",");
      if (flags.tz) eventData.tz = flags.tz;
      if (flags.rrule) eventData.rrule = flags.rrule;
      if (flags.calendar !== undefined) eventData.calendarId = flags.calendar;

      const categories = parseCategories(flags);
      if (categories.categoryValues.length > 0) {
        eventData.categories = categories.categoryValues;
      }

      const event = calendar.add(eventData);
      console.log(formatEvent(event));
      break;
    }

    case "today": {
      const flags = parseFlags(args.slice(1));
      const events = calendar.today(buildFilterFlags(flags));
      printEvents(events);
      break;
    }

    case "week": {
      const flags = parseFlags(args.slice(1));
      const events = calendar.week(buildFilterFlags(flags));
      printEvents(events);
      break;
    }

    case "list": {
      const flags = parseFlags(args.slice(1));
      if (!flags.from || !flags.to) {
        process.stderr.write("Error: --from and --to are required\n");
        process.exit(1);
      }

      const events = calendar.listRange(flags.from, flags.to, buildFilterFlags(flags));
      printEvents(events);
      break;
    }

    case "occurrences": {
      const id = args[1];
      const flags = parseFlags(args.slice(2));
      if (!flags.from || !flags.to) {
        process.stderr.write("Error: --from and --to are required\n");
        process.exit(1);
      }
      const dates = calendar.occurrences(id, flags.from, flags.to);
      if (dates.length === 0) {
        console.log("No events.");
      } else {
        for (const iso of dates) {
          console.log(`${id}  ${iso}  {occurrence}`);
        }
      }
      break;
    }

    case "skip": {
      const id = args[1];
      const flags = parseFlags(args.slice(2));
      if (!flags.date) {
        process.stderr.write("Error: --date is required\n");
        process.exit(1);
      }
      if (!isStrictISODateTimeWithOffset(flags.date)) {
        process.stderr.write("Error: --date must be strict ISO datetime with offset\n");
        process.exit(1);
      }
      calendar.skip(id, flags.date);
      console.log(`Skipped occurrence ${flags.date} for event ${id}`);
      break;
    }

    case "delete": {
      const id = args[1];
      const result = calendar.delete(id);
      if (!result) {
        process.stderr.write(`Error: event not found: ${id}\n`);
        process.exit(1);
      }
      console.log(`Deleted event ${id}`);
      break;
    }

    case "edit": {
      const id = args[1];
      const flags = parseFlags(args.slice(2));
      const updates = {};
      if (flags.title) updates.title = flags.title;
      if (flags.place) updates.place = flags.place;
      if (flags.start) updates.start = flags.start;
      if (flags.end) updates.end = flags.end;
      if (flags.participants) updates.participants = String(flags.participants).split(",");
      if (flags.calendar !== undefined) updates.calendarId = flags.calendar;

      const categories = parseCategories(flags);
      if (categories.categoryValues.length > 0) {
        updates.categories = categories.categoryValues;
      }

      const updated = calendar.edit(id, updates);
      console.log(formatEvent(updated));
      break;
    }

    default: {
      printUsage();
      process.exit(1);
    }
  }
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
