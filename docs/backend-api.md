# Backend API

What a backend has to provide so the site can run with `dataSource: 'api'` in `config.js`.
The only client of this API is [js/data/api-source.js](../js/data/api-source.js).

All paths are relative to `apiBaseUrl` (default: `api/` next to `index.html`). Requests and
answers are JSON (`Content-Type: application/json`).

## Endpoints

| Method | Path | Request body | Answer |
| --- | --- | --- | --- |
| `GET` | `boats` | — | `200` with a list of [boats](#boat) |
| `POST` | `boats` | a boat [draft](#boat-draft) | `200` or `201` with the saved boat |
| `PUT` | `boats/{boatId}` | a boat [draft](#boat-draft) | `200` with the saved boat |
| `DELETE` | `boats/{boatId}` | — | `200` or `204`; a body is ignored |
| `GET` | `boats/{boatId}/entries` | — | `200` with the boat's [entries](#log-entry), in any order |
| `POST` | `boats/{boatId}/entries` | an entry [draft](#draft) | `200` or `201` with the saved entry |
| `PUT` | `boats/{boatId}/entries/{entryId}` | an entry [draft](#draft) | `200` with the saved entry |
| `DELETE` | `boats/{boatId}/entries/{entryId}` | — | `200` or `204`; a body is ignored |
| `PUT` | `boats/{boatId}/inspection` | [inspection settings](#inspection-settings) | `200` with the saved settings |

That is the whole API.

The page asks for the boats once when it opens, and for a boat's entries each time that boat is
selected. After a change it shows the boat or entry from the answer rather than asking again —
which is why `POST` and `PUT` have to return what was saved. Filtering, ordering and working
out which inspections are overdue all happen in the browser.

## Data

### Boat

```json
{
  "id": "aurora",
  "name": "Aurora",
  "type": "Sailing yacht",
  "description": "Masthead sloop kept in the Stockholm archipelago.",
  "picture": "media/aurora.jpg",
  "details": [
    { "label": "Home port", "value": "Saltsjöbaden" },
    { "label": "Length overall", "value": "10.4 m" }
  ],
  "inspection": {
    "Sails": { "days": 30 },
    "Deck": { "days": 30, "monitored": false }
  }
}
```

Only `id` is required. `details` is shown as given, in order. `inspection` holds the boat's
[inspection settings](#inspection-settings).

### Boat draft

The body of `POST boats` and `PUT boats/{boatId}`: a boat without `id` and `inspection`.

- `POST` creates the boat; the backend chooses its `id` and answers with the whole boat. A new
  boat has no inspection settings and an empty log.
- `PUT` replaces the name, type, description, picture and details as a whole — whatever is
  missing from the draft has been cleared by the user. The boat's `id` and its inspection
  settings stay as they are, and come back in the answer.
- `DELETE boats/{boatId}` deletes the boat together with its log entries. The page asks the
  user to confirm first.
- A `picture` the user just chose arrives as a `data:` URL, like the [pictures](#pictures) of
  an entry; one that was already there comes back with the `src` the backend gave it.

### Log entry

```json
{
  "id": "1042",
  "boatId": "aurora",
  "timestamp": "2026-09-28T09:30:00+02:00",
  "title": "Engine serviced",
  "notes": "250-hour service. Engine oil changed …",
  "types": ["Service"],
  "parts": ["Engine"],
  "engineHours": 1241.0,
  "location": { "name": "Saltsjöbaden, home berth", "lat": 59.27793, "lon": 18.31632 },
  "pictures": [
    { "src": "media/1042-1.jpg", "caption": "Engine after the service" }
  ]
}
```

- `id` and `timestamp` are required in answers; the page does not rely on `boatId`. Ids may be
  strings or numbers; the page treats them as text and URL-encodes them in paths.
- `timestamp` is the wall-clock time where the entry was made, with its UTC offset
  (ISO 8601). Store and return it exactly as received: the page shows the wall-clock part and
  uses the offset only for ordering.
- `types` and `parts` are free-text tags. Whatever its type, an entry counts towards the
  inspection reminder of every part it names.
- `engineHours`, `location`, `notes` and `pictures` are optional. `location` may carry a
  `name`, a position (`lat` and `lon` together, decimal degrees, south and west negative), or
  both.

### Draft

The body of `POST` and `PUT` for entries: an entry without `id` and `boatId`. `engineHours` and `location`
are absent when the user left them empty; `notes` may be an empty string, and the tag and
picture lists may be empty. `PUT` replaces the entry as a whole — whatever is missing from the
draft has been cleared by the user.

### Pictures

- A picture the user just added arrives in the draft with a `data:` URL as its `src`
  (`data:image/jpeg;base64,…`). The page scales pictures down to at most 1280 px on the long
  edge first, so each is typically 100–300 kB. Allow request bodies of a few megabytes.
- The backend may keep the `data:` URL as it is, or store the picture and answer with a path
  or URL in `src` instead. Paths are resolved relative to `apiBaseUrl`, so `media/1042-1.jpg`
  is fetched from `api/media/1042-1.jpg`; serving those files is then up to the backend.
- On `PUT`, pictures that were already there come back with the `src` the backend gave them.
  A picture missing from the list was removed by the user.
- The same applies to a boat's `picture`: a path relative to `apiBaseUrl`, or a full URL.

### Inspection settings

```json
{
  "Engine": { "days": 14 },
  "Sails": { "days": 30 },
  "Deck": { "days": 30, "monitored": false }
}
```

One key per part tag. `days` is how long the part may go without a log entry before it is
overdue for inspection (1–3650; the configured default of 14 when absent). `monitored: false`
switches reminders for the part off. `PUT boats/{boatId}/inspection` sends the complete map and replaces
whatever was stored.

## Errors

Any status outside `2xx` counts as a failure, and the page keeps the user's form open so
nothing typed is lost. To tell the user why, answer with a message:

```json
{ "error": "The log is read-only while the engine is running." }
```

Without such a body the page shows the status code.

## Practical notes

- **Same origin.** If the backend serves both the site and the API, nothing more is needed.
  An API on another origin has to send CORS headers.
- **Content types.** Serve `.js` files as `text/javascript`; browsers refuse to run modules
  with any other type.
- **No sign-in yet.** The page sends no credentials of its own. Cookies set by the same origin
  travel with every request, which is enough for a simple session if one is wanted later.
