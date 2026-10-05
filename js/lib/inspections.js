import { daysSince, parseTimestamp } from './time.js';

const time = (entry) => parseTimestamp(entry.timestamp)?.epochMs ?? 0;

/**
 * For every part of a boat: when it was last attended to and whether that is too long ago.
 *
 * A part is any part tag used in the boat's log, plus any part the user has a setting for.
 * Every log entry for a part counts — a service, replacement or repair as much as an
 * inspection — so the clock runs from the part's newest entry. The part is overdue for
 * inspection when that entry is more than its interval ago, or when nothing was ever logged.
 *
 * @param {{ inspection?: Object<string, { days?: number, monitored?: boolean }> }} boat
 * @param {Array} entries the boat's log entries
 * @param {{ defaultIntervalDays: number }} rules
 */
export function inspectionReport(boat, entries, { defaultIntervalDays }, now = new Date()) {
  const newest = new Map();
  for (const entry of entries) {
    for (const part of entry.parts) {
      const previous = newest.get(part);
      if (!previous || time(entry) > time(previous)) newest.set(part, entry);
    }
  }

  const settings = boat.inspection ?? {};
  const parts = new Set([...newest.keys(), ...Object.keys(settings)]);
  return [...parts].sort((a, b) => a.localeCompare(b)).map((part) => {
    const intervalDays = settings[part]?.days ?? defaultIntervalDays;
    const monitored = settings[part]?.monitored !== false;
    const lastEntry = newest.get(part) ?? null;
    const daysAgo = lastEntry ? daysSince(lastEntry.timestamp, now) : null;
    return {
      part,
      monitored,
      intervalDays,
      lastEntry,
      daysAgo,
      overdue: monitored && (daysAgo === null || daysAgo > intervalDays),
      dueInDays: daysAgo === null ? null : intervalDays - daysAgo,
    };
  });
}

/** Overdue parts, the longest overdue first and parts with nothing logged last. */
export function overdueParts(report) {
  const daysOver = (item) => (item.daysAgo === null ? -Infinity : item.daysAgo - item.intervalDays);
  return report
    .filter((item) => item.overdue)
    .sort((a, b) => daysOver(b) - daysOver(a) || a.part.localeCompare(b.part));
}

/** The monitored part whose inspection comes due soonest, or null when none is pending. */
export function nextDue(report) {
  const pending = report.filter((item) => item.monitored && !item.overdue);
  return pending.sort((a, b) => a.dueInDays - b.dueInDays)[0] ?? null;
}
