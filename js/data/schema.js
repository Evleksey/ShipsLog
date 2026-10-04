/**
 * Turns whatever a data file or backend hands over into the shapes documented in index.js,
 * and says clearly what is wrong when it can't.
 */

import { parseTimestamp } from '../lib/time.js';

const MAX_INTERVAL_DAYS = 3650;

function text(value) {
  if (typeof value === 'string') return value.trim();
  return typeof value === 'number' ? String(value) : '';
}

function number(value, min = -Infinity, max = Infinity) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

/** Trimmed, non-empty tags; a tag repeated in different capitalisation is kept once. */
function tags(value) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(value) ? value : []) {
    const tag = text(item);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      result.push(tag);
    }
  }
  return result;
}

function location(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const name = text(raw.name);
  const lat = number(raw.lat, -90, 90);
  const lon = number(raw.lon, -180, 180);
  const located = lat !== undefined && lon !== undefined;
  if (!name && !located) return undefined;
  return { ...(name && { name }), ...(located && { lat, lon }) };
}

function picture(raw) {
  const src = text(typeof raw === 'string' ? raw : raw?.src);
  if (!src) return null;
  const caption = text(raw?.caption);
  return caption ? { src, caption } : { src };
}

export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('A log entry is not an object.');
  const title = text(raw.title) || 'Untitled entry';
  if (!parseTimestamp(raw.timestamp)) {
    throw new Error(`Log entry “${title}” needs a timestamp like 2026-09-28T09:30:00+02:00.`);
  }
  return {
    id: text(raw.id),
    boatId: text(raw.boatId),
    timestamp: raw.timestamp.trim(),
    title,
    notes: text(raw.notes),
    types: tags(raw.types),
    parts: tags(raw.parts),
    engineHours: number(raw.engineHours, 0),
    location: location(raw.location),
    pictures: (Array.isArray(raw.pictures) ? raw.pictures : []).map(picture).filter(Boolean),
  };
}

export function normalizeInspection(raw) {
  const settings = {};
  for (const [key, value] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
    const part = key.trim();
    if (!part) continue;
    const days = number(value?.days, 1, MAX_INTERVAL_DAYS);
    settings[part] = {
      ...(days !== undefined && { days: Math.round(days) }),
      ...(value?.monitored === false && { monitored: false }),
    };
  }
  return settings;
}

export function normalizeBoat(raw) {
  const id = text(raw?.id);
  if (!id) throw new Error('A boat is missing its id.');
  return {
    id,
    name: text(raw.name) || id,
    type: text(raw.type),
    description: text(raw.description),
    picture: text(raw.picture) || undefined,
    details: (Array.isArray(raw.details) ? raw.details : [])
      .map((detail) => ({ label: text(detail?.label), value: text(detail?.value) }))
      .filter((detail) => detail.label && detail.value),
    inspection: normalizeInspection(raw.inspection),
  };
}

/** Checks a whole data file: `{ boats: [...], entries: [...] }`. */
export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.boats)) {
    throw new Error('The data file needs a "boats" list.');
  }
  const boats = raw.boats.map(normalizeBoat);
  const boatIds = new Set(boats.map((boat) => boat.id));
  if (boatIds.size !== boats.length) throw new Error('Two boats in the data file share an id.');

  const entries = (Array.isArray(raw.entries) ? raw.entries : []).map(normalizeEntry);
  const entryIds = new Set();
  for (const entry of entries) {
    if (!entry.id) throw new Error(`Log entry “${entry.title}” is missing its id.`);
    if (entryIds.has(entry.id)) throw new Error(`Two log entries share the id "${entry.id}".`);
    if (!boatIds.has(entry.boatId)) {
      throw new Error(`Log entry “${entry.title}” belongs to an unknown boat "${entry.boatId}".`);
    }
    entryIds.add(entry.id);
  }
  return { boats, entries };
}
