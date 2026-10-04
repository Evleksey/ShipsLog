import { h, icon } from './dom.js';

const TILE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 17;
const MAX_LATITUDE = 85.0511; // where the square Web Mercator map ends

const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));

/**
 * A small fixed map centred on one position: no map library, just the few tile images that
 * cover the box, a marker in the middle and zoom buttons. Without internet (or without
 * configured layers) the tiles stay away and the marker sits on a plain chart grid.
 *
 * Put `element` on the page, call `draw()` once it has a size, and `destroy()` when done.
 */
export function createMinimap({ lat, lon, map = {} }) {
  const layers = map.layers ?? [];
  let zoom = clampZoom(map.zoom ?? 11);
  let drawnSize = '';

  const tiles = h('div', { class: 'minimap__tiles' });
  const note = h('p', { class: 'minimap__note', hidden: true }, 'Map unavailable — showing the position only');
  const zoomIn = h('button', { type: 'button', 'aria-label': 'Zoom in', onclick: () => setZoom(zoom + 1) }, '+');
  const zoomOut = h('button', { type: 'button', 'aria-label': 'Zoom out', onclick: () => setZoom(zoom - 1) }, '−');
  const marker = icon('marker');
  marker.classList.add('minimap__marker');

  const element = h('div', { class: 'minimap', role: 'group', 'aria-label': 'Map of the position' },
    tiles,
    marker,
    h('div', { class: 'minimap__zoom' }, zoomIn, zoomOut),
    credits(layers),
    note,
  );

  function setZoom(next) {
    zoom = clampZoom(next);
    draw();
  }

  function draw() {
    const { clientWidth: width, clientHeight: height } = element;
    if (!width || !height) return;
    drawnSize = `${width}x${height}`;
    zoomIn.disabled = zoom >= MAX_ZOOM;
    zoomOut.disabled = zoom <= MIN_ZOOM;

    // The position in pixels on the world map at this zoom (Web Mercator).
    const columns = 2 ** zoom;
    const sin = Math.sin((Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat)) * Math.PI) / 180);
    const x = Math.round(((lon + 180) / 360) * columns * TILE);
    const y = Math.round((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * columns * TILE);

    const firstColumn = Math.floor((x - width / 2) / TILE);
    const lastColumn = Math.floor((x + width / 2) / TILE);
    const firstRow = Math.max(0, Math.floor((y - height / 2) / TILE));
    const lastRow = Math.min(columns - 1, Math.floor((y + height / 2) / TILE));

    // The tile layer's origin sits at the centre of the box, so tiles are placed relative
    // to the position itself and the marker never needs to move.
    const images = [];
    let waiting = 0;
    let loaded = 0;
    layers.forEach((layer, index) => {
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const wrapped = ((column % columns) + columns) % columns;
          const image = h('img', {
            class: 'minimap__tile',
            alt: '',
            draggable: 'false',
            style: `left:${column * TILE - x}px;top:${row * TILE - y}px`,
            src: layer.url.replace('{z}', zoom).replace('{x}', wrapped).replace('{y}', row),
          });
          if (index === 0) {
            // Only the base layer decides whether there is a map at all.
            waiting += 1;
            const settle = (ok) => {
              waiting -= 1;
              loaded += ok ? 1 : 0;
              if (waiting === 0 && image.isConnected) note.hidden = loaded > 0;
            };
            image.addEventListener('load', () => settle(true));
            image.addEventListener('error', () => settle(false));
          }
          image.addEventListener('error', () => image.remove());
          images.push(image);
        }
      }
    });
    note.hidden = layers.length > 0;
    tiles.replaceChildren(...images);
  }

  const observer = new ResizeObserver(() => {
    if (`${element.clientWidth}x${element.clientHeight}` !== drawnSize) draw();
  });
  observer.observe(element);

  return { element, draw, destroy: () => observer.disconnect() };
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
