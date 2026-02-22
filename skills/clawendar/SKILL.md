---
name: clawendar
description: Add/list/edit/delete events in a local file-backed calendar using the clawendar CLI (local-clawendar). Use for scheduling one-off or recurring events, listing events by day/week/range, expanding recurring occurrences, skipping a single occurrence, editing, and deleting events. Supports strict ISO-8601 datetimes with offsets (no Z) and recurrence via --tz + --rrule.
---

# clawendar (local calendar)

This skill assumes the **clawendar** CLI is available via:
- `npx clawendar ...` (works without global install)
- or `clawendar ...` (if installed globally / on PATH)

Data location:
- Default: `~/.clawendar/events.json`
- Override directory: set `CLAWENDAR_DATA_DIR` (calendar stores files under that directory)

Timezone:
- Assume **Europe/Warsaw** unless the user explicitly says otherwise.

## Critical rules

1) Datetimes must be **strict ISO-8601 with an explicit offset**:
   - ✅ `2026-02-14T10:00:00+01:00`
   - ❌ `2026-02-14 10:00`
   - ❌ `2026-02-14T10:00:00Z` (this CLI does not accept `Z`; use `+00:00`)

2) If the user gives a fuzzy time (“tomorrow at 3”), ask ONE clarifying question only if needed (date, start time, timezone, duration, title).

3) Default duration: **1 hour** if an end time is not provided.

4) After creating/editing an event, echo back what was scheduled (title + start/end + place if provided).

## Commands

### Add (one-off event)

```bash
npx clawendar add "Dinner" \
  --start 2026-02-14T19:00:00+01:00 \
  --end   2026-02-14T21:00:00+01:00 \
  --place "Home" \
  --participants "Alice,Bob"
```

Notes:
- Title is the first non-flag arg after `add`.
- `--participants` is a comma-separated string with **no spaces**.

### Add (recurring event)

Recurring events are defined by:
- `--tz <IANA timezone>` (e.g. `Europe/Warsaw`)
- `--rrule <RRULE string>`

Policy: recurrence is **wall-clock stable** in the provided timezone (so “09:00 weekly” stays 09:00 local time across DST; the offset may change).

Example (2nd Tuesday of every month at 10:00 Warsaw time):

```bash
npx clawendar add "Team sync" \
  --start 2026-03-10T10:00:00+01:00 \
  --tz Europe/Warsaw \
  --rrule "FREQ=MONTHLY;INTERVAL=1;BYDAY=TU;BYSETPOS=2"
```

Example (weekly Mondays at 09:00 Warsaw time):

```bash
npx clawendar add "Standup" \
  --start 2026-03-23T09:00:00+01:00 \
  --tz Europe/Warsaw \
  --rrule "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO"
```

### Occurrences (expand a recurring event into instances)

```bash
npx clawendar occurrences <id> \
  --from 2026-03-01T00:00:00+01:00 \
  --to   2026-05-01T00:00:00+02:00
```

### Skip (exception: skip one instance in a series)

```bash
npx clawendar skip <id> \
  --date 2026-03-30T09:00:00+02:00
```

### Today / Week

```bash
npx clawendar today
npx clawendar week
```

### List range

```bash
npx clawendar list \
  --from 2026-03-01T00:00:00+01:00 \
  --to   2026-03-31T23:59:59+01:00
```

### Edit

```bash
npx clawendar edit <id> --title "New title"
npx clawendar edit <id> --place "Room 42"
npx clawendar edit <id> --participants "Alice,Bob,Charlie"
npx clawendar edit <id> \
  --start 2026-02-14T11:00:00+01:00 \
  --end   2026-02-14T12:00:00+01:00
```

### Delete

```bash
npx clawendar delete <id>
```

## Common follow-up questions to ask (only when required)

- “What should the event title be?”
- “What exact start datetime (with timezone offset)?”
- “How long should it be (or what end time)?”
- “Any location / participants?”
