/**
 * Log timestamps are ship's time: the wall-clock time where the entry was made plus its UTC
 * offset, e.g. "2026-09-28T09:30:00+02:00". The log always shows that wall-clock time, wherever
 * it is read; the offset is only used to put entries in order.
 */

const DAY_MS = 86400000;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (number, width = 2) => String(number).padStart(width, '0');
const cache = new Map();

/** Splits a timestamp into its wall-clock parts. Returns null when it isn't a valid timestamp. */
export function parseTimestamp(value) {
  if (!cache.has(value)) cache.set(value, parse(value));
  return cache.get(value);
}

function parse(value) {
  const match = TIMESTAMP.exec(String(value ?? '').trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map((part) => Number(part ?? 0));
  // The wall clock read as if it were UTC: handy for calendar arithmetic, wrong as an instant.
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const rolledOver = wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day || wall.getUTCHours() !== hour;
  if (rolledOver || minute > 59 || second > 59) return null;

  const offsetMinutes = match[7] === undefined ? null : parseOffset(match[7]);
  const epochMs = offsetMinutes === null
    ? new Date(year, month - 1, day, hour, minute, second).getTime() // no offset: the reader's zone
    : wall.getTime() - offsetMinutes * 60000;
  return {
    year, month, day, hour, minute, second,
    weekday: wall.getUTCDay(),
    offsetMinutes,
    epochMs,
    dayNumber: Math.floor(wall.getTime() / DAY_MS),
  };
}

function parseOffset(zone) {
  if (zone === 'Z') return 0;
  const digits = zone.slice(1).replace(':', '');
  const minutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2));
  return zone[0] === '-' ? -minutes : minutes;
}

function offsetSuffix(offsetMinutes) {
  const minutes = Math.abs(offsetMinutes);
  return `${offsetMinutes < 0 ? '-' : '+'}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "28 Sep 2026" */
export function formatDate(timestamp) {
  const time = parseTimestamp(timestamp);
  return time ? `${time.day} ${shortMonth(time.month)} ${time.year}` : '';
}

/** "Monday 28 September 2026" */
export function formatLongDate(timestamp) {
  const time = parseTimestamp(timestamp);
  return time ? `${WEEKDAYS[time.weekday]} ${time.day} ${MONTHS[time.month - 1]} ${time.year}` : '';
}

/** "09:30" */
export function formatTime(timestamp) {
  const time = parseTimestamp(timestamp);
  return time ? `${pad(time.hour)}:${pad(time.minute)}` : '';
}

/** "UTC+2", "UTC−3:30", or "" when the timestamp carries no offset. */
export function formatUtcOffset(timestamp) {
  const offset = parseTimestamp(timestamp)?.offsetMinutes;
  if (offset == null) return '';
  if (offset === 0) return 'UTC';
  const minutes = Math.abs(offset);
  const remainder = minutes % 60 ? `:${pad(minutes % 60)}` : '';
  return `UTC${offset < 0 ? '−' : '+'}${Math.floor(minutes / 60)}${remainder}`;
}

/** "Sep" for month 9. */
export function shortMonth(month) {
  return MONTHS[month - 1].slice(0, 3);
}

/** Today's calendar day (in the reader's time zone) as a count of days since 1970. */
export function todayDayNumber(now = new Date()) {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/** The day count of a plain "YYYY-MM-DD" date, or null when it isn't one. */
export function dayNumberOfDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS) : null;
}

/** Whole calendar days from the entry's date to today; never negative. */
export function daysSince(timestamp, now = new Date()) {
  const time = parseTimestamp(timestamp);
  return time ? Math.max(0, todayDayNumber(now) - time.dayNumber) : 0;
}

export function describeDaysAgo(days) {
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function describeDaysAhead(days) {
  if (days <= 0) return 'today';
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** Moves a timestamp by whole days, keeping its time of day and offset. */
export function shiftDays(timestamp, days) {
  const time = parseTimestamp(timestamp);
  if (!time) return timestamp;
  const date = new Date(Date.UTC(time.year, time.month - 1, time.day + days));
  const zone = time.offsetMinutes === null ? '' : offsetSuffix(time.offsetMinutes);
  return `${isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())}`
    + `T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}${zone}`;
}

function isoDate(year, month, day) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The wall-clock part of a timestamp as a <input type="datetime-local"> value. */
export function toInputValue(timestamp) {
  const time = parseTimestamp(timestamp);
  return time ? `${isoDate(time.year, time.month, time.day)}T${pad(time.hour)}:${pad(time.minute)}` : '';
}

/** The current local time as a <input type="datetime-local"> value. */
export function nowInputValue(now = new Date()) {
  return `${isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Turns a datetime-local value into a timestamp. Without an explicit offset it takes the
 * offset this device's time zone has at that moment.
 */
export function fromInputValue(value, offsetMinutes) {
  const offset = offsetMinutes ?? -new Date(value).getTimezoneOffset();
  return `${value.slice(0, 16)}:00${offsetSuffix(offset)}`;
}
