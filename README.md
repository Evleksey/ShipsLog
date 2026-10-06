# Ship's Log

A maintenance log for boats. It records what was inspected, serviced, replaced or repaired:
when, where, at how many engine hours, and with pictures. Each boat has its own log, and the
log reminds you when a part has gone too long without attention.

Ship's Log is a static web page written in plain HTML, CSS and JavaScript modules. It has no
build step and no dependencies.

Disclamer: This project is in part made with AI. Author advocates for responsible use of LLM and AI and human-centric approach.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [The data file](#the-data-file)
- [Running offline](#running-on-offline-hardware)
- [Map data](#map-data)

## Features

- **One log per boat.** A selector at the top switches boats. Below it are the boat's picture,
  description and general information such as home port and length.
- **Inspection reminders.** A part is flagged when nothing has been logged for it within its
  interval. Any entry for the part counts: a service, replacement or repair as much as an
  inspection. The interval is 14 days unless you set another one for that part under
  *Reminder settings*, where reminders can also be switched off per part.
- **Tagged entries.** Every entry has type tags (Inspection, Service, Replacement, Repair, …)
  and part tags (Engine, Hull, Rigging, Sails, …). Tags are free text, so you can add your own.
- **Filtering and ordering.** The list can be filtered by type tag and by part tag, and ordered
  by newest, oldest, engine hours or title.
- **Entry details.** Clicking an entry shows its date, time, engine hours, notes and pictures,
  and its position on a minimap with OpenSeaMap seamarks.
- **Writing the log.** Entries can be added, edited and deleted. *Log inspection* on a reminder
  opens the form with the tags already filled in.
- **Three ways to set a position.** Type it in, take it from the device, or pick it on a map
  that opens where the boat was last logged.
- **Pictures.** Pictures added on the page are scaled down to at most 1280 px on the long edge
  before they are stored.
- **Ship's time.** An entry shows the wall-clock time at the place it was made, whatever time
  zone it is read in.
- **Shareable links.** The address bar follows what is on screen
  (`?boat=aurora&entry=aurora-15`), so a boat or a single entry can be bookmarked or shared.
- **Import and export.** On the static site, the *Demo data* menu imports a data file, exports
  the current log as one, and resets to the published file.
- **Light and dark themes**, following the device setting.

## Quick start

The repository includes a demo log with three boats. To try it, serve the folder with any
static web server and open the page:

```sh
git clone https://github.com/Evleksey/ShipsLog.git
cd ShipsLog
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

Or go to <http://github.>
You can modify any data as it is stored only on local browser. You can export it and store it yourself.
Import your data to work on it. It will not be collected or used in any way.

## The data file

The static site imports [data/shipslog.json](data/shipslog.json). Replace it with your own log or start from scratch.

In the demo version all data is made up and does not represent any real vessel.

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
| `boats[].id` | yes | What entries refer to. |
| `boats[].name` | no | Shown in the boat selector. |
| `boats[].type`, `description`, `picture` | no | Shown in the boat's header. |
| `boats[].details` | no | General information as label/value pairs, shown in this order. |
| `boats[].inspection` | no | Reminder settings per part tag: `days` the part may go without a log entry (14 when absent), and `monitored: false` to switch reminders for that part off. |
| `entries[].id`, `boatId`, `timestamp` | yes | Ids must be unique. The timestamp is ship's time with its UTC offset. |
| `entries[].title` | no | Defaults to "Untitled entry". |
| `entries[].types`, `parts` | no | Tags: what was done, and to which part. Any text works. |
| `entries[].engineHours` | no | Engine hour meter reading. |
| `entries[].location` | no | `name`, and `lat`/`lon` in decimal degrees (south and west negative). The minimap needs both coordinates. |
| `entries[].notes`, `pictures` | no | Free text, and pictures with an optional caption. |

A file that breaks these rules is refused with a message that names the entry at fault.

Things worth knowing:

- **Times are ship's time.** The log shows the wall-clock time in the timestamp wherever it is
  read. The offset is only used to put entries in order.
- **Pictures** are paths relative to the data file (keep the file and its `images/` folder
  together), full URLs, or `data:` URLs. Pictures added on the page are embedded as `data:`
  URLs.
- **Which parts get reminders:** every part tag used in the boat's log, plus every part listed
  under `inspection`. A part listed there with nothing logged yet is flagged straight away.

## Running on offline hardware

Next step is to create a small portable device to host the web server and storage so that log can be accessed and edited offline.
Data stored on that device will use the same structure and thus will be compatible with the online(demo) version by use of import data function, in case of device failure or if the owner chooses to.

## Map data

The maps show tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright)
(© OpenStreetMap contributors) with seamarks from [OpenSeaMap](https://www.openseamap.org/).
