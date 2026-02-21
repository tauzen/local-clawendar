# local-clawendar (clawendar)

Minimal, file-backed calendar CLI with strict timezone-aware datetimes.

- Stores events as JSON on disk (default: `~/.clawendar/events.json`)
- Requires **ISO-8601 datetimes with a timezone offset** (e.g. `2026-02-14T10:00:00+01:00`)
- Written for **Node >= 22**

## Install / run

From this directory:

```bash
npm test

# Run without installing:
node ./bin/clawendar.js today

# Optional: install the `clawendar` command into your PATH
npm i -g .
# or (for local dev)
npm link
```

## Data location

By default the CLI writes to:

- `~/.clawendar/events.json`

Override with:

- `CLAWENDAR_DATA_DIR=/some/dir`

Example:

```bash
CLAWENDAR_DATA_DIR=/tmp/my-cal node ./bin/clawendar.js week
```

## Datetime format (important)

`--start`, `--end`, `--from`, and `--to` must be **strict ISO-8601 with an explicit offset**:

- ✅ `2026-02-14T10:00:00+01:00`
- ❌ `2026-02-14 10:00`
- ❌ `2026-02-14T10:00:00Z` (UTC `Z` is currently not accepted; use `+00:00`)

If `--end` is omitted on `add`, it defaults to **start + 1 hour**.

## Commands

### Add an event

```bash
clawendar add "Dinner" \
  --start 2026-02-14T19:00:00+01:00 \
  --end   2026-02-14T21:00:00+01:00 \
  --place "Home" \
  --participants "Alice,Bob"
```

Notes:
- The title is the first non-flag argument after `add`.
- `--participants` is a comma-separated string (no spaces) and is stored as an array.

### Add a recurring event

Recurrence is designed to be **wall-clock stable** in an IANA timezone (for example `Europe/Warsaw`), meaning a “09:00 weekly meeting” stays 09:00 local time even when DST changes (the **offset** will change).

```bash
clawendar add "Team sync" \
  --start 2026-03-10T10:00:00+01:00 \
  --tz Europe/Warsaw \
  --rrule "FREQ=MONTHLY;INTERVAL=1;BYDAY=TU;BYSETPOS=2"
```

RRULE notes:
- Supports **nth weekday** patterns via `BYDAY=<weekday>;BYSETPOS=<n>` (e.g. `2nd Tuesday`).
- The `--start` value must still be a strict ISO-8601 datetime with an explicit offset.

### Expand occurrences for a recurring event

```bash
clawendar occurrences <id> \
  --from 2026-03-01T00:00:00+01:00 \
  --to   2026-05-01T00:00:00+02:00
```

### Skip a single occurrence (exception)

```bash
clawendar skip <id> --date 2026-03-30T09:00:00+02:00
```

### List events

```bash
clawendar today
clawendar week

clawendar list \
  --from 2026-03-01T00:00:00+01:00 \
  --to   2026-03-31T23:59:59+01:00
```

### Edit an event

```bash
clawendar edit <id> --title "New title"
clawendar edit <id> --place "Room 42"
clawendar edit <id> --participants "Alice,Bob,Charlie"
clawendar edit <id> --start 2026-02-14T11:00:00+01:00 --end 2026-02-14T12:00:00+01:00
```

### Delete an event

```bash
clawendar delete <id>
```

## Output format

Each event prints as a single line:

```
<id>  <start>  <title>  [<place>]  (<participants...>)
```

(Place / participants only appear when present.)
