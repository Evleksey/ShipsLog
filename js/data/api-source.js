/**
 * The module for an installation with its own backend (the boat's hardware): the log is read
 * from and saved to a small REST API. The contract the backend has to fulfil is written down
 * in docs/backend-api.md — this file is its only client.
 */

import { normalizeBoat, normalizeEntry, normalizeInspection } from './schema.js';

const id = encodeURIComponent;

export class ApiDataSource {
  kind = 'api';

  constructor(config) {
    const base = config.apiBaseUrl.endsWith('/') ? config.apiBaseUrl : `${config.apiBaseUrl}/`;
    this.baseUrl = new URL(base, document.baseURI);
  }

  async init() {
    // Nothing to prepare: the first request is listBoats().
  }

  listBoats() {
    return this.request('GET', 'boats', { expect: (boats) => list(boats).map(normalizeBoat) });
  }

  createBoat(draft) {
    return this.request('POST', 'boats', { body: draft, expect: normalizeBoat });
  }

  updateBoat(boatId, draft) {
    return this.request('PUT', `boats/${id(boatId)}`, { body: draft, expect: normalizeBoat });
  }

  async deleteBoat(boatId) {
    await this.request('DELETE', `boats/${id(boatId)}`);
  }

  listEntries(boatId) {
    return this.request('GET', `boats/${id(boatId)}/entries`, {
      expect: (entries) => list(entries).map(savedEntry),
    });
  }

  createEntry(boatId, draft) {
    return this.request('POST', `boats/${id(boatId)}/entries`, { body: draft, expect: savedEntry });
  }

  updateEntry(boatId, entryId, draft) {
    return this.request('PUT', `boats/${id(boatId)}/entries/${id(entryId)}`, { body: draft, expect: savedEntry });
  }

  async deleteEntry(boatId, entryId) {
    await this.request('DELETE', `boats/${id(boatId)}/entries/${id(entryId)}`);
  }

  saveInspectionSettings(boatId, settings) {
    return this.request('PUT', `boats/${id(boatId)}/inspection`, { body: settings, expect: normalizeInspection });
  }

  /** Picture paths from the backend are relative to the API base; full URLs pass through. */
  mediaUrl(src) {
    return new URL(src, this.baseUrl).href;
  }

  /**
   * Sends one request. `expect` turns the JSON answer into the value to return and throws
   * when the answer doesn't have the agreed shape; without it the answer is ignored.
   */
  async request(method, path, { body, expect } = {}) {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => {
      throw new Error(`Can't reach the log server at ${this.baseUrl.href}`);
    });

    if (!response.ok) {
      // The backend may explain itself with { "error": "..." }.
      const problem = await response.json().catch(() => null);
      throw new Error(problem?.error || `The log server answered ${response.status} ${response.statusText}`.trim());
    }
    if (!expect) return undefined;
    try {
      return expect(await response.json());
    } catch (error) {
      throw new Error(`The log server sent an unexpected answer. ${error.message}`);
    }
  }
}

function list(value) {
  if (!Array.isArray(value)) throw new Error('Expected a list.');
  return value;
}

/** An entry as the backend stores it: without an id it could not be opened or changed. */
function savedEntry(raw) {
  const entry = normalizeEntry(raw);
  if (!entry.id) throw new Error(`Log entry “${entry.title}” has no id.`);
  return entry;
}
