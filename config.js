/**
 * Deployment configuration — the only file that differs between the static demo and an
 * installation on the boat's own hardware.
 */
export default {
  /**
   * Where the log lives.
   *   'static' — imported from the JSON file below; changes stay in the visitor's browser.
   *              Needs nothing but a static file host such as GitHub Pages.
   *   'api'    — read from and saved to a backend over HTTP (see docs/backend-api.md).
   */
  dataSource: 'static',

  /** 'static' only: the data file. Picture paths inside the file are relative to it. */
  staticDataUrl: 'data/shipslog.json',

  /** 'api' only: base URL of the backend, relative to index.html or absolute. */
  apiBaseUrl: 'api/',

  inspection: {
    /** Entries carrying this type tag count as inspections. */
    tag: 'Inspection',
    /** Days before a part is overdue, until the user sets that part's own interval. */
    defaultIntervalDays: 14,
  },

  /** Tags always offered in the entry form. Tags already used in the log are offered too. */
  typeTags: ['Inspection', 'Service', 'Replacement', 'Repair'],
  partTags: ['Engine', 'Hull', 'Rigging', 'Sails'],

  map: {
    /** Starting zoom of the minimap in an entry's details (2 = world, 17 = pontoon). */
    zoom: 11,
    /**
     * Tile layers, bottom first. Point these at your own tile server for use without
     * internet, or leave the list empty to show positions on a plain grid.
     */
    layers: [
      {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap',
        creditUrl: 'https://www.openstreetmap.org/copyright',
      },
      {
        url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        credit: 'OpenSeaMap',
        creditUrl: 'https://www.openseamap.org/',
      },
    ],
    /** Link to a full map from an entry's details. Remove to hide the link. */
    linkLabel: 'Open in OpenStreetMap',
    linkUrl: 'https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=13/{lat}/{lon}',
  },
};
