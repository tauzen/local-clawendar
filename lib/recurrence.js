const WEEKDAY_TO_INDEX = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const SUPPORTED_KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "BYSETPOS", "COUNT", "UNTIL"]);

// Cache Intl.DateTimeFormat instances per timezone — construction is expensive.
const dtfCache = new Map();

function parseRRule(rrule) {
  if (typeof rrule !== "string" || !rrule.trim()) {
    throw new Error("invalid rrule");
  }

  const out = {};
  for (const part of rrule.split(";")) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || rawValue === undefined) {
      throw new Error("invalid rrule");
    }
    const key = rawKey.trim().toUpperCase();
    const value = rawValue.trim();
    if (!SUPPORTED_KEYS.has(key)) {
      throw new Error(`unsupported rrule field: ${key}`);
    }
    out[key] = value;
  }

  if (!out.FREQ || !["WEEKLY", "MONTHLY"].includes(out.FREQ)) {
    throw new Error("unsupported or invalid FREQ");
  }

  const interval = out.INTERVAL ? Number(out.INTERVAL) : 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("invalid INTERVAL");
  }

  const byday = out.BYDAY
    ? out.BYDAY.split(",").map((d) => d.trim().toUpperCase()).filter(Boolean)
    : [];

  for (const d of byday) {
    if (!(d in WEEKDAY_TO_INDEX)) {
      throw new Error("invalid BYDAY");
    }
  }

  const bysetpos = out.BYSETPOS !== undefined ? Number(out.BYSETPOS) : undefined;
  if (out.BYSETPOS !== undefined && (!Number.isInteger(bysetpos) || bysetpos === 0)) {
    throw new Error("invalid BYSETPOS");
  }

  const count = out.COUNT !== undefined ? Number(out.COUNT) : undefined;
  if (out.COUNT !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new Error("invalid COUNT");
  }

  return {
    freq: out.FREQ,
    interval,
    byday,
    bysetpos,
    count,
    until: out.UNTIL,
  };
}

function parseOffsetMinutes(offsetText) {
  const m = offsetText.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!m) {
    throw new Error(`Cannot parse timezone offset: ${offsetText}`);
  }
  const sign = m[1] === "+" ? 1 : -1;
  const hh = Number(m[2]);
  const mm = Number(m[3] || "0");
  return sign * (hh * 60 + mm);
}

function getZonedParts(date, tz) {
  let dtf = dtfCache.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "longOffset",
    });
    dtfCache.set(tz, dtf);
  }

  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    offsetMinutes: parseOffsetMinutes(map.timeZoneName),
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatIsoInTimeZone(date, tz) {
  const p = getZonedParts(date, tz);
  const sign = p.offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(p.offsetMinutes);
  const oh = pad2(Math.floor(abs / 60));
  const om = pad2(abs % 60);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}${sign}${oh}:${om}`;
}

function cmpLocal(a, b) {
  return (
    a.year - b.year
    || a.month - b.month
    || a.day - b.day
    || a.hour - b.hour
    || a.minute - b.minute
    || a.second - b.second
  );
}

function addMinutesLocal(local, deltaMinutes) {
  const dt = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second));
  dt.setUTCMinutes(dt.getUTCMinutes() + deltaMinutes);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hour: dt.getUTCHours(),
    minute: dt.getUTCMinutes(),
    second: dt.getUTCSeconds(),
  };
}

function findUtcCandidatesForLocal(local, tz) {
  const base = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);

  // Probe the timezone offset at a few points near this local time to discover
  // all possible offsets (covers DST transitions where 2 offsets may apply).
  const probeOffsets = new Set();
  probeOffsets.add(getZonedParts(new Date(base), tz).offsetMinutes);
  probeOffsets.add(getZonedParts(new Date(base - 86400000), tz).offsetMinutes);
  probeOffsets.add(getZonedParts(new Date(base + 86400000), tz).offsetMinutes);

  const candidates = [];
  const seen = new Set();
  for (const offset of probeOffsets) {
    // If local = UTC + offset, then UTC = local - offset
    const utcCandidate = new Date(base - offset * 60000);
    const verify = getZonedParts(utcCandidate, tz);
    if (cmpLocal(local, verify) === 0) {
      const ts = utcCandidate.getTime();
      if (!seen.has(ts)) {
        seen.add(ts);
        candidates.push(utcCandidate);
      }
    }
  }
  return candidates;
}

function resolveLocalToUtc(local, tz) {
  const candidates = findUtcCandidatesForLocal(local, tz);
  if (candidates.length > 0) {
    // On ambiguous fold times, pick the later absolute instant (standard-time occurrence).
    return candidates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
  }

  // Gap policy: shift-forward while preserving minute/second when possible.
  let fallback = null;
  for (let shift = 1; shift <= 180; shift++) {
    const shifted = addMinutesLocal(local, shift);
    const shiftedCandidates = findUtcCandidatesForLocal(shifted, tz);
    if (shiftedCandidates.length === 0) continue;
    const chosen = shiftedCandidates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));
    if (!fallback) fallback = chosen;
    if (shifted.minute === local.minute && shifted.second === local.second) {
      return chosen;
    }
  }

  if (fallback) return fallback;
  throw new Error("invalid local datetime for timezone");
}

function parseLocalDateTime(iso) {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
    hour: Number(iso.slice(11, 13)),
    minute: Number(iso.slice(14, 16)),
    second: Number(iso.slice(17, 19)),
  };
}

function localDateKey(local) {
  return `${local.year}-${pad2(local.month)}-${pad2(local.day)}`;
}

function addDaysLocal(localDate, days) {
  const dt = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

function weekdayIndexFromLocalDate(localDate) {
  return new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day)).getUTCDay();
}

function daysBetweenLocal(a, b) {
  const aMs = Date.UTC(a.year, a.month - 1, a.day);
  const bMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.floor((bMs - aMs) / 86400000);
}

function monthDiff(a, b) {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

function getMonthlyCandidates(monthDate, rule) {
  const candidates = [];
  const dt = new Date(Date.UTC(monthDate.year, monthDate.month - 1, 1));
  while (dt.getUTCMonth() === monthDate.month - 1) {
    const local = { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
    const wd = weekdayIndexFromLocalDate(local);
    if (rule.byday.length === 0 || rule.byday.some((d) => WEEKDAY_TO_INDEX[d] === wd)) {
      candidates.push(local);
    }
    dt.setUTCDate(dt.getUTCDate() + 1);
  }

  if (rule.bysetpos === undefined) {
    return candidates;
  }

  const idx = rule.bysetpos > 0 ? rule.bysetpos - 1 : candidates.length + rule.bysetpos;
  if (idx < 0 || idx >= candidates.length) {
    return [];
  }
  return [candidates[idx]];
}

export function expandOccurrences({ dtStart, tz, rrule, from, to, mode, exDates = [] }) {
  if (mode !== "wall") {
    throw new Error("unsupported mode");
  }
  const rule = parseRRule(rrule);

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error("invalid range");
  }

  const untilDate = rule.until ? new Date(rule.until) : null;
  if (rule.until && Number.isNaN(untilDate.getTime())) {
    throw new Error("invalid UNTIL");
  }

  const startLocal = parseLocalDateTime(dtStart);
  const startDateLocal = { year: startLocal.year, month: startLocal.month, day: startLocal.day };
  const startWeekday = weekdayIndexFromLocalDate(startDateLocal);
  const bydayIndices = rule.byday.length > 0 ? rule.byday.map((d) => WEEKDAY_TO_INDEX[d]) : [startWeekday];

  const exSet = new Set();
  for (const ex of exDates) {
    const d = new Date(ex);
    if (typeof ex !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(ex) || Number.isNaN(d.getTime())) {
      throw new Error("invalid exDates: must be strict ISO with offset");
    }
    exSet.add(ex);
  }

  const results = [];
  let generatedCount = 0;
  const dtStartDate = new Date(dtStart);
  const bydaySet = new Set(bydayIndices);

  if (rule.freq === "WEEKLY") {
    // When there is no COUNT constraint we can skip ahead to near the query
    // window instead of iterating day-by-day from dtStart.
    let startDayOffset = 0;
    if (rule.count === undefined) {
      const roughDaysToFrom = Math.floor((fromDate.getTime() - dtStartDate.getTime()) / 86400000);
      if (roughDaysToFrom > 0) {
        const periodDays = 7 * rule.interval;
        const periodsToSkip = Math.floor(roughDaysToFrom / periodDays) - 2;
        if (periodsToSkip > 0) {
          startDayOffset = periodsToSkip * periodDays;
        }
      }
    }

    for (let dayOffset = startDayOffset; dayOffset < 3660; dayOffset++) {
      const candidateDate = addDaysLocal(startDateLocal, dayOffset);
      const wd = weekdayIndexFromLocalDate(candidateDate);
      if (!bydaySet.has(wd)) continue;

      const weekDelta = Math.floor(daysBetweenLocal(startDateLocal, candidateDate) / 7);
      if (weekDelta < 0 || weekDelta % rule.interval !== 0) continue;

      const candidateLocal = { ...candidateDate, hour: startLocal.hour, minute: startLocal.minute, second: startLocal.second };
      const utcDate = resolveLocalToUtc(candidateLocal, tz);

      if (utcDate < dtStartDate) continue;
      if (untilDate && utcDate > untilDate) break;

      generatedCount += 1;
      if (rule.count && generatedCount > rule.count) break;

      if (utcDate >= fromDate && utcDate <= toDate) {
        const iso = formatIsoInTimeZone(utcDate, tz);
        if (!exSet.has(iso)) {
          results.push(iso);
        }
      }

      if (utcDate > toDate && rule.count === undefined) {
        break;
      }
    }
  } else if (rule.freq === "MONTHLY") {
    // Skip ahead for monthly rules without COUNT.
    let startMonthOffset = 0;
    if (rule.count === undefined) {
      const roughMonthsToFrom = monthDiff(startDateLocal, {
        year: fromDate.getUTCFullYear(),
        month: fromDate.getUTCMonth() + 1,
      });
      if (roughMonthsToFrom > 0) {
        const periodsToSkip = Math.floor(roughMonthsToFrom / rule.interval) - 2;
        if (periodsToSkip > 0) {
          startMonthOffset = periodsToSkip * rule.interval;
        }
      }
    }

    const bydayNames = bydayIndices.map((idx) => Object.keys(WEEKDAY_TO_INDEX).find((k) => WEEKDAY_TO_INDEX[k] === idx));

    for (let monthOffset = startMonthOffset; monthOffset < 240; monthOffset += rule.interval) {
      const totalMonth = (startDateLocal.month - 1) + monthOffset;
      const year = startDateLocal.year + Math.floor(totalMonth / 12);
      const month = (totalMonth % 12) + 1;
      const monthDate = { year, month };

      const dayCandidates = getMonthlyCandidates(monthDate, { ...rule, byday: bydayNames });
      for (const d of dayCandidates) {
        const candidateLocal = { ...d, hour: startLocal.hour, minute: startLocal.minute, second: startLocal.second };
        const utcDate = resolveLocalToUtc(candidateLocal, tz);

        if (utcDate < dtStartDate) continue;
        if (untilDate && utcDate > untilDate) return results;

        generatedCount += 1;
        if (rule.count && generatedCount > rule.count) return results;

        if (utcDate >= fromDate && utcDate <= toDate) {
          const iso = formatIsoInTimeZone(utcDate, tz);
          if (!exSet.has(iso)) {
            results.push(iso);
          }
        }
      }

      if (new Date(Date.UTC(year, month, 1)) > toDate && rule.count === undefined) {
        break;
      }
    }
  } else {
    throw new Error("unsupported rrule");
  }

  return results;
}
