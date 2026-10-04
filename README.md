# Ship's Log

A maintenance log for boats: what was inspected, serviced, replaced or repaired — when, where,
at how many engine hours, with pictures. One log per boat.

The site is plain HTML, CSS and JavaScript modules. There is nothing to install or build, and it
runs in two ways from the same files:

- **as a static demo** (GitHub Pages): the log is imported from a JSON file;
- **on the boat's own hardware**: the log is read from and saved to a backend over HTTP.
  The backend is not written yet; its contract is in [docs/backend-api.md](docs/backend-api.md).

## What it does

- **Boat selector** at the top, then the boat's picture and general information.
- **Inspection reminders.** A part is flagged when its newest log entry tagged *Inspection* is
  older than its interval: 14 days, unless you set another number for that part under
  *Reminder settings*. Reminders can also be switched off per part.
- **The log.** Every entry has type tags (Inspection, Service, Replacement, …), part tags
  (Engine, Hull, Rigging, Sails, …), a date and time, and pictures. Above the list: a filter for
  type tags, a separate filter for part tags, and an ordering selector.
- **Entry details.** Clicking an entry opens a popup with the date, time, engine hours, the
  place on a minimap, the notes and the pictures.
- **Writing the log.** *New entry* adds an entry; entries can be edited and deleted from their
  popup. *Log inspection* on a reminder opens the form with the tags filled in.

The address bar follows what is on screen (`?boat=aurora&entry=aurora-15`), so a boat or a
single entry can be bookmarked or shared.

## Run it locally

Serve the folder with any static web server and open it:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` straight from disk does not work: browsers only load JavaScript modules
and data files over HTTP.

## Publish the demo on GitHub Pages

1. Push this repository to GitHub.
2. In the repository: **Settings → Pages → Build and deployment**. Choose **Deploy from a
   branch**, your main branch, folder **/ (root)**.
3. A minute later the demo is at `https://<user>.github.io/<repository>/`.

No workflow is needed. All paths in the site are relative, so it works under that sub-path, and
the empty `.nojekyll` file tells Pages to publish the files exactly as they are.

In the demo nothing is sent anywhere. Changes a visitor makes — entries, reminder settings —
become a private copy of the log in that browser's local storage. The **Demo data** menu can
import a data file, export the current log as one, and reset to the published file.

## The data file

The static site imports [data/shipslog.json](data/shipslog.json). Replace it with your own log,
or change `staticDataUrl` in [config.js](config.js) to point at another file.

```json
{
  "formatVersion": 1,
  "boats": [
    {
      "id": "aurora",
      "name": "Aurora",
      "type": "Sailing yacht",
      "description": "Masthead sloop kept in the Stockholm archipelago.",
      "picture": "images/aurora.svg",
      "details": [
        { "label": "Home port", "value": "Saltsjöbaden" },
        { "label": "Length overall", "value": "10.4 m" }
      ],
      "inspection": {
        "Sails": { "days": 30 },
        "Deck": { "days": 30, "monitored": false }
      }
    }
  ],
  "entries": [
    {
      "id": "aurora-15",
      "boatId": "aurora",
      "timestamp": "2026-09-28T09:30:00+02:00",
      "title": "Engine serviced",
      "types": ["Service"],
      "parts": ["Engine"],
      "engineHours": 1241.0,
      "location": { "name": "Saltsjöbaden, home berth", "lat": 59.27793, "lon": 18.31632 },
      "notes": "250-hour service. Engine oil changed …",
      "pictures": [
        { "src": "images/engine.svg", "caption": "Engine after the service" }
      ]
    }
  ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `boats[].id`, `name` | id | The id is what entries refer to; the name is shown in the selector. |
| `boats[].type`, `description`, `picture` | no | Shown in the boat's header. |
| `boats[].details` | no | General information as label/value pairs, shown in this order. |
| `boats[].inspection` | no | Reminder settings per part tag: `days` between inspections (14 when absent) and `monitored: false` to switch reminders for that part off. |
| `entries[].id`, `boatId`, `timestamp` | yes | Ids must be unique. The timestamp is ship's time with its UTC offset. |
| `entries[].title` | no | Defaults to "Untitled entry". |
| `entries[].types`, `parts` | no | Tags: what was done, and to which part. Any text works; tags are not a fixed list. |
| `entries[].engineHours` | no | Engine hour meter reading. |
| `entries[].location` | no | `name`, and `lat`/`lon` in decimal degrees (south and west negative). The minimap needs both coordinates. |
| `entries[].notes`, `pictures` | no | Free text; pictures with an optional caption. |

Things worth knowing:

- **Times are ship's time.** The log shows the wall-clock time in the timestamp wherever it is
  read; the offset is only used to put entries in order.
- **Pictures** are paths relative to the data file (keep the file and its `images/` folder
  together), full URLs, or `data:` URLs. Pictures added on the page are scaled down and embedded
  as `data:` URLs.
- **Which parts get reminders:** every part tag used in the boat's log, plus every part listed
  under `inspection`. A part that has entries but no inspection yet is flagged as well.
- **`demo.anchorDate`** exists for the demo only. When the file contains
  `"demo": { "anchorDate": "2026-10-04" }`, every timestamp is moved by the number of days
  between that date and today when the file is loaded, so the demo never grows stale: an
  inspection three days before the anchor is always "3 days ago". Leave `demo` out of a real log.

A file that breaks these rules is refused with a message that names the entry at fault.

## Running on the boat's own hardware

1. Serve `index.html`, `config.js`, `favicon.svg`, `css/` and `js/` from the device.
   The `data/` folder is demo material and is not needed.
2. In [config.js](config.js) set `dataSource: 'api'`, and `apiBaseUrl` if the API does not
   live at `api/` next to `index.html`.
3. Implement the six endpoints described in [docs/backend-api.md](docs/backend-api.md).

Three things small web servers get wrong:

- `.js` files must be sent with a JavaScript content type (`text/javascript`). Browsers refuse
  to run modules served as `text/plain` or `application/octet-stream`.
- *Use current position* in the entry form only appears on pages served over HTTPS (or from
  `localhost`): browsers do not hand out the device's position to plain-HTTP pages.
- The minimap loads map tiles from the internet. Without a connection it still shows the
  position, on a plain grid. For charts on board, point `map.layers` in `config.js` at a tile
  server on the boat's network.

## Configuration

Everything that differs between installations is in [config.js](config.js).

| Setting | Default | Meaning |
| --- | --- | --- |
| `dataSource` | `'static'` | `'static'` (data file) or `'api'` (backend). |
| `staticDataUrl` | `'data/shipslog.json'` | The data file of the static site. |
| `apiBaseUrl` | `'api/'` | Where the backend lives, relative to `index.html` or absolute. |
| `inspection.tag` | `'Inspection'` | The type tag that marks an entry as an inspection. |
| `inspection.defaultIntervalDays` | `14` | Days before a part is overdue, until the user sets its own interval. |
| `typeTags`, `partTags` | see file | Tags always offered in the entry form. |
| `map.zoom` | `11` | Starting zoom of the minimap. |
| `map.layers` | OpenStreetMap + OpenSeaMap seamarks | Tile layers, bottom first. Empty list: no map, position only. |
| `map.linkUrl`, `map.linkLabel` | OpenStreetMap | The "open full map" link in an entry's details. |

## How the code is organised

```
index.html              page skeleton and the icon sprite
config.js               deployment configuration
css/styles.css          all styles; light and dark follow the system setting
js/main.js              entry point
js/app.js               loads boats and entries, wires the views to the data source
js/data/index.js        the DataSource interface and the data shapes (start reading here)
js/data/static-source.js    data file + browser storage — the module for static hosting
js/data/api-source.js       REST client — the module for the boat's backend
js/data/schema.js       validates and tidies boats and entries from either source
js/lib/                 rules without any page: time, positions, filtering, inspections
js/ui/                  one file per piece of the page: boat panel, log, dialogs, minimap
data/                   demo log and its pictures
docs/backend-api.md     the contract for the backend
```

The pages never touch storage directly. They call a `DataSource`; `config.js` decides which one
is loaded. A new kind of storage is one more file next to `static-source.js` and
`api-source.js`, plus a line in `js/data/index.js`.

## Map data

The minimap shows tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright)
(© OpenStreetMap contributors) with seamarks from [OpenSeaMap](https://www.openseamap.org/).
Their public tile servers are fine for a demo and for personal use; an installation with real
traffic should use its own tiles.
