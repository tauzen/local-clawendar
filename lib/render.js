const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = 'Su Mo Tu We Th Fr Sa';

/**
 * Return the number of days in a given month (0-indexed month).
 */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Return the day-of-week (0=Sun) for the 1st of the given month.
 */
function firstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

/**
 * Render a single month calendar as a string.
 * `eventDays` is a Set of day numbers that have events.
 * `highlightToday` — if the month/year matches today, highlight the current day.
 */
export function renderMonth(year, month, eventDays = new Set()) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  const title = `${MONTH_NAMES[month]} ${year}`;
  const padding = Math.floor((DAY_HEADERS.length - title.length) / 2);
  const lines = [];

  lines.push(' '.repeat(Math.max(0, padding)) + title);
  lines.push(DAY_HEADERS);

  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfWeek(year, month);

  let line = '   '.repeat(startDay);
  for (let d = 1; d <= totalDays; d++) {
    let cell = String(d).padStart(2, ' ');

    if (isCurrentMonth && d === todayDate) {
      // Invert colors for today
      cell = `\x1b[7m${cell}\x1b[0m`;
    }

    if (eventDays.has(d)) {
      // Underline days with events
      cell = `\x1b[4m${cell}\x1b[0m`;
    }

    line += cell;

    const dayOfWeek = (startDay + d - 1) % 7;
    if (dayOfWeek === 6 || d === totalDays) {
      lines.push(line);
      line = '';
    } else {
      line += ' ';
    }
  }

  return lines.join('\n');
}

/**
 * Render a full year (12 months in a 3-column layout).
 */
export function renderYear(year, eventsByMonth = {}) {
  const lines = [];
  const yearTitle = String(year);
  // 3 calendars side by side, each 20 chars wide + 4 spacing = ~68 wide
  const totalWidth = 20 * 3 + 4 * 2;
  const yearPadding = Math.floor((totalWidth - yearTitle.length) / 2);
  lines.push(' '.repeat(Math.max(0, yearPadding)) + yearTitle);
  lines.push('');

  for (let row = 0; row < 4; row++) {
    const monthBlocks = [];
    for (let col = 0; col < 3; col++) {
      const m = row * 3 + col;
      const events = eventsByMonth[m] || new Set();
      const block = renderMonth(year, m, events).split('\n');
      // Pad each line to 20 chars
      monthBlocks.push(block.map((l) => stripAnsi(l).length <= 20 ? l + ' '.repeat(20 - stripAnsi(l).length) : l));
    }

    const maxLines = Math.max(...monthBlocks.map((b) => b.length));
    for (let i = 0; i < maxLines; i++) {
      const parts = monthBlocks.map((b) => {
        const raw = b[i] || '';
        const visible = stripAnsi(raw).length;
        return raw + ' '.repeat(Math.max(0, 20 - visible));
      });
      lines.push(parts.join('    '));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
