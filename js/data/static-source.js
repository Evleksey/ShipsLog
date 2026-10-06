/**
 * The module for static hosting (the GitHub Pages demo): the log is imported from a JSON file
 * that sits next to the site, and no server is involved.
 *
 * Changes made on the page — new boats and entries, reminder settings, an imported file — turn the data
 * into a private copy kept in this browser's localStorage. "Reset" throws that copy away and
 * goes back to the hosted file.
 */

import { dayNumberOfDate, shiftDays, todayDayNumber } from '../lib/time.js';
import { normalizeBoat, normalizeData, normalizeEntry, normalizeInspection } from './schema.js';

const STORAGE_KEY = 'shipslog.data';
const FORMAT_VERSION = 1;

const clone = (value) => JSON.parse(JSON.stringify(value));

export class StaticDataSource {
  kind = 'static';

  /** True once the data differs from the hosted file. */
  hasLocalChanges = false;

  constructor(config) {
    this.fileUrl = new URL(config.staticDataUrl, document.baseURI);
    this.storage = openStorage();
    this.data = null;
  }

  /** False when the browser blocks localStorage: changes then last until the page is reloaded. */
  get keepsChanges() {
    return this.storage !== null;
  }

  async init() {
    const saved = this.storage && readSaved(this.storage);
    if (saved) {
      this.data = saved;
      this.hasLocalChanges = true;
    } else {
      this.data = await this.loadFile();
    }
  }

  async listBoats() {
    return clone(this.data.boats);
  }

  async createBoat(draft) {
    const boat = normalizeBoat({ ...draft, id: newBoatId(draft.name, this.data.boats), inspection: {} });
    this.commit({ ...this.data, boats: [...this.data.boats, boat] });
    return clone(boat);
  }

  /** The id and the reminder settings stay; everything else is replaced by the draft. */
  async updateBoat(boatId, draft) {
    const { inspection } = this.requireBoat(boatId);
    const boat = normalizeBoat({ ...draft, id: boatId, inspection });
    this.commit({
      ...this.data,
      boats: this.data.boats.map((existing) => (existing.id === boatId ? boat : existing)),
    });
    return clone(boat);
  }

  /** Takes the boat's log with it. */
  async deleteBoat(boatId) {
    this.requireBoat(boatId);
    this.commit({
      boats: this.data.boats.filter((boat) => boat.id !== boatId),
      entries: this.data.entries.filter((entry) => entry.boatId !== boatId),
    });
  }

  async listEntries(boatId) {
    return clone(this.data.entries.filter((entry) => entry.boatId === boatId));
  }

  async createEntry(boatId, draft) {
    this.requireBoat(boatId);
    const entry = normalizeEntry({ ...draft, id: newId(), boatId });
    this.commit({ ...this.data, entries: [...this.data.entries, entry] });
    return clone(entry);
  }

  async updateEntry(boatId, entryId, draft) {
    this.requireEntry(boatId, entryId);
    const entry = normalizeEntry({ ...draft, id: entryId, boatId });
    this.commit({
      ...this.data,
      entries: this.data.entries.map((existing) => (existing.id === entryId ? entry : existing)),
    });
    return clone(entry);
  }

  async deleteEntry(boatId, entryId) {
    this.requireEntry(boatId, entryId);
    this.commit({ ...this.data, entries: this.data.entries.filter((entry) => entry.id !== entryId) });
  }

  async saveInspectionSettings(boatId, settings) {
    this.requireBoat(boatId);
    const inspection = normalizeInspection(settings);
    this.commit({
      ...this.data,
      boats: this.data.boats.map((boat) => (boat.id === boatId ? { ...boat, inspection } : boat)),
    });
    return clone(inspection);
  }

  /** Picture paths are relative to the data file, so the file and its pictures travel together. */
  mediaUrl(src) {
    return new URL(src, this.fileUrl).href;
  }

  /** The current data as the text of a data file. */
  exportData() {
    return `${JSON.stringify({ formatVersion: FORMAT_VERSION, ...this.data }, null, 2)}\n`;
  }

  /** Replaces the log with the contents of a data file chosen by the user. */
  importData(fileText) {
    let raw;
    try {
      raw = JSON.parse(fileText);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
    this.commit(prepare(raw));
  }

  /** Forgets all local changes and reloads the hosted data file. */
  async reset() {
    const data = await this.loadFile();
    this.storage?.removeItem(STORAGE_KEY);
    this.data = data;
    this.hasLocalChanges = false;
  }

  async loadFile() {
    const response = await fetch(this.fileUrl, { cache: 'no-cache' }).catch(() => null);
    if (!response?.ok) {
      throw new Error(`Couldn't load the data file ${this.fileUrl.pathname}${response ? ` (HTTP ${response.status})` : ''}.`);
    }
    const raw = await response.json().catch(() => {
      throw new Error(`The data file ${this.fileUrl.pathname} isn't valid JSON.`);
    });
    return prepare(raw);
  }

  requireBoat(boatId) {
    const boat = this.data.boats.find((candidate) => candidate.id === boatId);
    if (!boat) throw new Error('This boat is no longer in the log.');
    return boat;
  }

  requireEntry(boatId, entryId) {
    if (!this.data.entries.some((entry) => entry.id === entryId && entry.boatId === boatId)) {
      throw new Error('This entry is no longer in the log.');
    }
  }

  /** Saves first, then switches over — a failed save leaves the log exactly as it was. */
  commit(data) {
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        throw new Error("This browser's storage is full. Remove some pictures, or export the data file and reset.");
      }
    }
    this.data = data;
    this.hasLocalChanges = true;
  }
}

function prepare(raw) {
  return normalizeData(rebaseDemoDates(raw));
}

/**
 * Keeps demo data evergreen. When the file names a `demo.anchorDate`, every timestamp moves by
 * the number of days between that date and today — an inspection "3 days before the anchor"
 * in the file is always 3 days ago on screen. Real logs simply leave `demo` out.
 */
function rebaseDemoDates(raw) {
  const anchor = dayNumberOfDate(raw?.demo?.anchorDate);
  if (anchor === null || !Array.isArray(raw.entries)) return raw;
  const days = todayDayNumber() - anchor;
  return {
    ...raw,
    entries: raw.entries.map((entry) => ({ ...entry, timestamp: shiftDays(entry?.timestamp, days) })),
  };
}

function openStorage() {
  try {
    const storage = window.localStorage;
    storage.setItem(`${STORAGE_KEY}.probe`, '1');
    storage.removeItem(`${STORAGE_KEY}.probe`);
    return storage;
  } catch {
    return null;
  }
}

function readSaved(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return saved ? normalizeData(JSON.parse(saved)) : null;
  } catch {
    return null; // unreadable copy: fall back to the hosted file
  }
}

/** A readable id from the boat's name — "Sea Otter" → "sea-otter" — numbered when it is taken. */
function newBoatId(name, boats) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents: "Björn" → "bjorn"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'boat';
  const taken = new Set(boats.map((boat) => boat.id));
  let id = slug;
  for (let count = 2; taken.has(id); count += 1) id = `${slug}-${count}`;
  return id;
}

function newId() {
  return `e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
