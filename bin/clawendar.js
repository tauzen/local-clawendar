#!/usr/bin/env node

import { createCalendar } from "../lib/calendar.js";
import { isStrictISODateTimeWithOffset } from "../lib/event.js";
import path from "node:path";
import os from "node:os";

const dataDir = process.env.CLAWENDAR_DATA_DIR || path.join(os.homedir(), ".clawendar");
const calendar = createCalendar({ dataDir });

const args = process.argv.slice(2);
const command = args[0];

// (help handling is implemented below, after printUsage is defined)

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function formatEvent(event) {
  let line = `${event.id}  ${event.start}  ${event.title}`;
  if (event.place) {
    line += `  [${event.place}]`;
  }
  if (event.participants && event.participants.length > 0) {
    line += `  (${event.participants.join(", ")})`;
  }
  if (event.rrule) {
    line += "  {series}";
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
  add <title> --start <datetime> [--end <datetime>] [--place <place>] [--participants <a,b>] [--tz <iana>] [--rrule <rrule>]
  today                          List today's events
  week                           List this week's events
  list --from <datetime> --to <datetime>   List events in range
  occurrences <id> --from <datetime> --to <datetime>  Expand recurring event
  skip <id> --date <datetime>    Skip one recurring instance
  delete <id>                    Delete an event
  edit <id> [--title <t>] [--place <p>] [--participants <a,b>]  Edit an event
`
  );
}

// Help should be a successful exit (many wrappers treat non-zero as failure).
if (!command || args.includes("--help") || args.includes("-h") || command === "help") {
  // Keep usage on stderr for consistency, but exit 0.
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
      if (flags.participants) eventData.participants = flags.participants.split(",");
      if (flags.tz) eventData.tz = flags.tz;
      if (flags.rrule) eventData.rrule = flags.rrule;

      const event = calendar.add(eventData);
      console.log(formatEvent(event));
      break;
    }

    case "today": {
      const events = calendar.today();
      printEvents(events);
      break;
    }

    case "week": {
      const events = calendar.week();
      printEvents(events);
      break;
    }

    case "list": {
      const flags = parseFlags(args.slice(1));
      if (!flags.from || !flags.to) {
        process.stderr.write("Error: --from and --to are required\n");
        process.exit(1);
      }

      const events = calendar.listRange(flags.from, flags.to);
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
      if (flags.participants) updates.participants = flags.participants.split(",");

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
