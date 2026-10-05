import { h, icon } from './dom.js';

const TILE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 17;
const MAX_LATITUDE = 85.0511; // where the square Web Mercator map ends
const WORLD_VIEW = { lat: 30, lon: 0 }; // what to look at when there is nothing to centre on
const CLICK_SLACK = 5; // pixels a pointer may wander between press and release and still be a click

const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));

/** A position as fractions (0–1) of the square world map: x from 180°W eastwards, y from the top. */
function project({ lat, lon }) {
  const sin = Math.sin((Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat)) * Math.PI) / 180);
  return { x: (lon + 180) / 360, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
}

function unproject({ x, y }) {
  return { lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI, lon: x * 360 - 180 };
}

/**
 * A small map without a map library: the few tile images that cover the box, a marker and
 * zoom buttons. Without internet (or without configured layers) the tiles stay away and the
 * marker sits on a plain chart grid.
 *
 * On its own it is a fixed picture of one position. Given `onPick` it becomes a position
 * picker: the map can be dragged, and a click sets the marker and reports the spot.
 *
 * Put `element` on the page, call `draw()` once it has a size, and `destroy()` when done.
 *
 * @param {Object} options
 * @param {{ lat: number, lon: number }} [options.position]  where the marker stands; none without it
 * @param {{ lat: number, lon: number }} [options.center]    what to show while there is no position
 * @param {Object} [options.map]                             the `map` section of config.js
 * @param {(position: { lat: number, lon: number }) => void} [options.onPick]
 */
export function createMinimap({ position, center, map = {}, onPick }) {
  const layers = map.layers ?? [];
  const start = position ?? center;
  let zoom = start ? clampZoom(map.zoom ?? 11) : MIN_ZOOM;
  let view = project(start ?? WORLD_VIEW); // the point in the middle of the box
  let spot = position ? project(position) : null; // the point under the marker
  let drawnSize = '';

  /** "layer/zoom/column/row" → the tile's <img>, or null once it has failed to load. */
  const shown = new Map();
  const sheets = layers.map(() => h('div', {}));
  const note = h('p', { class: 'minimap__note', hidden: true },
    onPick ? 'Map unavailable — type the position instead' : 'Map unavailable — showing the position only');
  const zoomIn = h('button', { type: 'button', 'aria-label': 'Zoom in', onclick: () => setZoom(zoom + 1) }, '+');
  const zoomOut = h('button', { type: 'button', 'aria-label': 'Zoom out', onclick: () => setZoom(zoom - 1) }, '−');
  const marker = icon('marker');
  marker.classList.add('minimap__marker');

  const element = h('div', {
    class: `minimap ${onPick ? 'minimap--picker' : ''}`,
    role: 'group',
    'aria-label': onPick ? 'Map for choosing the position' : 'Map of the position',
  },
    h('div', { class: 'minimap__tiles' }, sheets),
    marker,
    h('div', { class: 'minimap__zoom' }, zoomIn, zoomOut),
    credits(layers),
    note,
  );

  /** The width of the whole world in pixels at the current zoom. */
  const worldSize = () => TILE * 2 ** zoom;

  /** Puts a point of the world map in the middle of the box. The map repeats sideways, not up and down. */
  function lookAt(x, y) {
    view = { x: x - Math.floor(x), y: Math.min(1, Math.max(0, y)) };
  }

  /** How far the marker is from the middle of the box, in pixels; null when there is no marker. */
  function markerOffset() {
    if (!spot) return null;
    const across = spot.x - view.x;
    return {
      x: (across - Math.round(across)) * worldSize(), // the closest copy on a map that repeats sideways
      y: (spot.y - view.y) * worldSize(),
    };
  }

  function setZoom(next) {
    // While the marker is in view the map grows and shrinks around it, so that zooming in on
    // a roughly placed marker to place it better doesn't push it out of sight.
    const offset = markerOffset();
    const inView = offset
      && Math.abs(offset.x) <= element.clientWidth / 2
      && Math.abs(offset.y) <= element.clientHeight / 2;
    zoom = clampZoom(next);
    if (inView) lookAt(spot.x - offset.x / worldSize(), spot.y - offset.y / worldSize());
    draw();
  }

  function draw() {
    const { clientWidth: width, clientHeight: height } = element;
    if (!width || !height) return;
    drawnSize = `${width}x${height}`;
    zoomIn.disabled = zoom >= MAX_ZOOM;
    zoomOut.disabled = zoom <= MIN_ZOOM;

    const columns = 2 ** zoom;
    const x = Math.round(view.x * worldSize());
    const y = Math.round(view.y * worldSize());
    const firstColumn = Math.floor((x - width / 2) / TILE);
    const lastColumn = Math.floor((x + width / 2) / TILE);
    const firstRow = Math.max(0, Math.floor((y - height / 2) / TILE));
    const lastRow = Math.min(columns - 1, Math.floor((y + height / 2) / TILE));

    // The tile layer's origin sits at the centre of the box, so every tile is placed relative
    // to the point in view. Tiles already on the map are moved, not fetched again.
    const wanted = new Set();
    layers.forEach((layer, index) => {
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const key = `${index}/${zoom}/${column}/${row}`;
          wanted.add(key);
          if (!shown.has(key)) {
            const wrapped = ((column % columns) + columns) % columns; // the map repeats sideways
            addTile(key, sheets[index], layer.url.replace('{z}', zoom).replace('{x}', wrapped).replace('{y}', row));
          }
          const image = shown.get(key);
          if (image) image.style.cssText = `left:${column * TILE - x}px;top:${row * TILE - y}px`;
        }
      }
    });
    for (const [key, image] of shown) {
      if (wanted.has(key)) continue;
      image?.remove();
      shown.delete(key);
    }
    placeMarker();
    updateNote();
  }

  function addTile(key, sheet, src) {
    const image = h('img', { class: 'minimap__tile', alt: '', draggable: 'false', src });
    image.addEventListener('load', updateNote);
    image.addEventListener('error', () => {
      image.remove();
      if (shown.get(key) === image) shown.set(key, null); // remembered, so it isn't requested over and over
      updateNote();
    });
    shown.set(key, image);
    sheet.append(image);
  }

  /** Only the bottom layer decides whether there is a map at all. */
  function updateNote() {
    const base = [...shown].filter(([key, image]) => key.startsWith('0/') && image).map(([, image]) => image);
    const loading = base.some((image) => !image.complete);
    const loaded = base.some((image) => image.complete && image.naturalWidth > 0);
    note.hidden = loading || loaded;
  }

  function placeMarker() {
    const offset = markerOffset();
    marker.toggleAttribute('hidden', !offset);
    if (!offset) return;
    marker.style.left = `calc(50% + ${Math.round(offset.x)}px)`;
    marker.style.top = `calc(50% + ${Math.round(offset.y)}px)`;
  }

  /** The point on the world map under a pointer, or null above or below the map. */
  function pointUnder(event) {
    const box = element.getBoundingClientRect();
    const x = view.x + (event.clientX - box.left - box.width / 2) / worldSize();
    const y = view.y + (event.clientY - box.top - box.height / 2) / worldSize();
    return y < 0 || y > 1 ? null : { x: x - Math.floor(x), y };
  }

  if (onPick) {
    // One pointer at a time: a press that moves drags the map, a press that stays put picks.
    let press = null;
    element.addEventListener('pointerdown', (event) => {
      if (press || event.button !== 0 || event.target.closest('button, a')) return;
      press = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false };
      element.setPointerCapture(event.pointerId); // keep the drag alive outside the box
    });
    element.addEventListener('pointermove', (event) => {
      if (event.pointerId !== press?.id) return;
      const wandered = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
      if (!press.dragging && wandered < CLICK_SLACK) return;
      press.dragging = true;
      element.classList.add('minimap--dragging');
      lookAt(view.x - (event.clientX - press.x) / worldSize(), view.y - (event.clientY - press.y) / worldSize());
      press.x = event.clientX;
      press.y = event.clientY;
      draw();
    });
    const release = (event) => {
      if (event.pointerId !== press?.id) return;
      const picked = event.type === 'pointerup' && !press.dragging && pointUnder(event);
      press = null;
      element.classList.remove('minimap--dragging');
      if (!picked) return;
      spot = picked;
      placeMarker();
      onPick(unproject(picked));
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  const observer = new ResizeObserver(() => {
    if (`${element.clientWidth}x${element.clientHeight}` !== drawnSize) draw();
  });
  observer.observe(element);

  return {
    element,
    draw,
    /** Puts the marker on `position` and centres the map there; null takes the marker away. */
    setPosition(next) {
      spot = next ? project(next) : null;
      if (spot) view = spot;
      draw();
    },
    destroy: () => observer.disconnect(),
  };
}

function credits(layers) {
  const credited = layers.filter((layer) => layer.credit);
  if (credited.length === 0) return null;
  return h('p', { class: 'minimap__credit' }, credited.map((layer, index) => [
    index > 0 && ' · ',
    layer.creditUrl
      ? h('a', { href: layer.creditUrl, target: '_blank', rel: 'noopener' }, layer.credit)
      : layer.credit,
  ]));
}
