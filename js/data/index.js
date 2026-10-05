/**
 * The log's storage, behind one interface. The pages only ever talk to a DataSource, so the
 * same site runs from a JSON file (the static demo) or against a backend on the boat's own
 * hardware. `dataSource` in config.js picks which; only that module is downloaded.
 *
 * @typedef {Object} Boat
 * @property {string} id
 * @property {string} name
 * @property {string} type                 e.g. "Sailing yacht"; may be empty
 * @property {string} description          may be empty
 * @property {string} [picture]            path or URL; show it through DataSource.mediaUrl()
 * @property {{ label: string, value: string }[]} details   general information, shown in order
 * @property {InspectionSettings} inspection
 *
 * @typedef {Object<string, { days?: number, monitored?: boolean }>} InspectionSettings
 *   Per part tag: `days` the part may go without a log entry before it is overdue for
 *   inspection (the configured default when absent) and `monitored: false` to switch
 *   reminders for the part off.
 *
 * @typedef {Object} LogEntry
 * @property {string} id
 * @property {string} boatId
 * @property {string} timestamp            ship's time with UTC offset: "2026-09-28T09:30:00+02:00"
 * @property {string} title
 * @property {string} notes                may be empty
 * @property {string[]} types              what was done: "Inspection", "Service", "Replacement", …
 * @property {string[]} parts              what it was done to: "Engine", "Hull", "Rigging", …
 * @property {number} [engineHours]
 * @property {{ name?: string, lat?: number, lon?: number }} [location]   lat/lon in decimal degrees
 * @property {{ src: string, caption?: string }[]} pictures   show `src` through DataSource.mediaUrl()
 *
 * @typedef {Omit<LogEntry, 'id' | 'boatId'>} LogEntryDraft
 *
 * @typedef {Object} DataSource
 * @property {'static' | 'api'} kind
 * @property {() => Promise<void>} init
 * @property {() => Promise<Boat[]>} listBoats
 * @property {(boatId: string) => Promise<LogEntry[]>} listEntries
 * @property {(boatId: string, draft: LogEntryDraft) => Promise<LogEntry>} createEntry
 * @property {(boatId: string, entryId: string, draft: LogEntryDraft) => Promise<LogEntry>} updateEntry
 * @property {(boatId: string, entryId: string) => Promise<void>} deleteEntry
 * @property {(boatId: string, settings: InspectionSettings) => Promise<InspectionSettings>} saveInspectionSettings
 * @property {(src: string) => string} mediaUrl   turns a picture's `src` into a URL the page can load
 */

/** @returns {Promise<DataSource>} */
export async function createDataSource(config) {
  switch (config.dataSource) {
    case 'static': {
      const { StaticDataSource } = await import('./static-source.js');
      return new StaticDataSource(config);
    }
    case 'api': {
      const { ApiDataSource } = await import('./api-source.js');
      return new ApiDataSource(config);
    }
    default:
      throw new Error(`config.js: unknown dataSource "${config.dataSource}" — use "static" or "api".`);
  }
}
