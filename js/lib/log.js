import { hasPosition } from './geo.js';
import { parseTimestamp } from './time.js';

/** The choices in the log's ordering selector; the first one is the default. */
export const ORDERS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'engine-hours', label: 'Engine hours, highest first' },
  { id: 'title', label: 'Title, A to Z' },
];

const time = (entry) => parseTimestamp(entry.timestamp)?.epochMs ?? 0;
const hours = (entry) => entry.engineHours ?? -Infinity;
const newestFirst = (a, b) => time(b) - time(a);

const comparators = {
  newest: newestFirst,
  oldest: (a, b) => time(a) - time(b),
  // Entries without a reading sink to the bottom (their difference is NaN, so the date decides).
  'engine-hours': (a, b) => hours(b) - hours(a) || newestFirst(a, b),
  title: (a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) || newestFirst(a, b),
};

export function sortEntries(entries, order) {
  return [...entries].sort(comparators[order] ?? newestFirst);
}

/**
 * Keeps the entries that carry at least one of the selected type tags and at least one of
 * the selected part tags. A group with nothing selected lets everything through.
 */
export function filterEntries(entries, { types, parts }) {
  const matches = (selected, tags) => selected.size === 0 || tags.some((tag) => selected.has(tag));
  return entries.filter((entry) => matches(types, entry.types) && matches(parts, entry.parts));
}

/**
 * The tags used under `key` ('types' or 'parts') and how many entries carry each,
 * with `preferred` tags first in their given order and the rest alphabetically.
 */
export function tagCounts(entries, key, preferred = []) {
  const counts = new Map();
  for (const entry of entries) {
    for (const tag of entry[key]) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const rank = (tag) => {
    const index = preferred.indexOf(tag);
    return index < 0 ? preferred.length : index;
  };
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => rank(a.tag) - rank(b.tag) || a.tag.localeCompare(b.tag));
}

/** The newest entry that recorded engine hours, or null. */
export function latestEngineHours(entries) {
  return sortEntries(entries.filter((entry) => Number.isFinite(entry.engineHours)), 'newest')[0] ?? null;
}

/** The newest entry that recorded a position, or null. */
export function latestPosition(entries) {
  return sortEntries(entries.filter((entry) => hasPosition(entry.location)), 'newest')[0] ?? null;
}
