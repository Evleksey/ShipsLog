import { h, icon, tagPill } from './dom.js';
import { openDialog } from './dialog.js';
import { createMinimap } from './minimap.js';
import { formatEngineHours } from '../lib/format.js';
import { formatPosition, hasPosition } from '../lib/geo.js';
import { formatLongDate, formatTime, formatUtcOffset } from '../lib/time.js';

/** The popup behind a log entry: date, time, engine hours, the place on a minimap, notes, pictures. */
export function openEntryDialog(dialog, { entry, config, source, onEdit, onDelete, onClose }) {
  const located = hasPosition(entry.location);
  const minimap = located ? createMinimap({ position: entry.location, map: config.map }) : null;
  const problem = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const offset = formatUtcOffset(entry.timestamp);

  const deleteButton = h('button', { class: 'btn btn--danger', type: 'button', onclick: remove }, icon('trash'), 'Delete');
  const editButton = h('button', { class: 'btn', type: 'button', onclick: edit }, icon('edit'), 'Edit');

  openDialog(dialog, {
    title: entry.title,
    lead: h('div', { class: 'tags' },
      entry.types.map((tag) => tagPill(tag, 'type')),
      entry.parts.map((tag) => tagPill(tag, 'part')),
    ),
    body: [
      problem,
      h('div', { class: `detail ${located ? 'detail--map' : ''}` },
        h('dl', { class: 'detail__facts' },
          fact('calendar', 'Date', formatLongDate(entry.timestamp)),
          fact('clock', 'Time', formatTime(entry.timestamp), offset && h('span', { class: 'fact__aside' }, offset)),
          fact('gauge', 'Engine hours', entry.engineHours === undefined ? 'Not recorded' : formatEngineHours(entry.engineHours)),
          fact('pin', 'Place', place(entry.location, config.map)),
        ),
        minimap?.element,
      ),
      entry.notes && section('Notes', h('p', { class: 'detail__notes' }, entry.notes)),
      entry.pictures.length > 0 && section('Pictures', gallery(entry.pictures, source)),
    ],
    footer: [deleteButton, h('span', { class: 'dialog__spacer' }), editButton],
    dismissible: true,
    onClose: () => {
      minimap?.destroy();
      onClose?.();
    },
  });
  minimap?.draw();

  function edit() {
    dialog.close();
    onEdit();
  }

  async function remove() {
    if (!window.confirm(`Delete “${entry.title}” from the log? This can't be undone.`)) return;
    deleteButton.disabled = true;
    editButton.disabled = true;
    try {
      await onDelete();
      dialog.close();
    } catch (error) {
      problem.textContent = error.message;
      problem.hidden = false;
      deleteButton.disabled = false;
      editButton.disabled = false;
    }
  }
}

function fact(symbol, label, ...value) {
  return h('div', { class: 'fact' },
    h('dt', { class: 'fact__label' }, icon(symbol), label),
    h('dd', { class: 'fact__value' }, value),
  );
}

function section(title, content) {
  return h('section', { class: 'detail__section' }, h('h3', { class: 'detail__heading' }, title), content);
}

function place(location, map = {}) {
  if (!location) return 'Not recorded';
  if (!hasPosition(location)) return location.name;
  const { lat, lon } = location;
  const link = map.linkUrl && h('a', {
    class: 'detail__map-link',
    href: map.linkUrl.replaceAll('{lat}', lat).replaceAll('{lon}', lon),
    target: '_blank',
    rel: 'noopener',
  }, map.linkLabel ?? 'Open map', icon('external'));
  return [
    location.name && h('span', { class: 'detail__place' }, location.name),
    h('span', { class: 'detail__position' }, formatPosition(location)),
    link,
  ];
}

/** One large picture with its caption; the thumbnails underneath choose which. */
function gallery(pictures, source) {
  const image = h('img', { class: 'gallery__image', alt: '' });
  const caption = h('figcaption', { class: 'gallery__caption' });
  const thumbs = pictures.map((picture, index) => h('button', {
    class: 'gallery__thumb',
    type: 'button',
    'aria-label': `Show picture ${index + 1} of ${pictures.length}`,
    onclick: () => choose(index),
  }, h('img', { src: source.mediaUrl(picture.src), alt: '' })));

  function choose(index) {
    const { src, caption: text = '' } = pictures[index];
    image.src = source.mediaUrl(src);
    image.alt = text || `Picture ${index + 1} of ${pictures.length}`;
    caption.textContent = text;
    caption.hidden = !text;
    thumbs.forEach((thumb, position) => thumb.setAttribute('aria-pressed', String(position === index)));
  }
  choose(0);

  return [
    h('figure', { class: 'gallery' }, image, caption),
    pictures.length > 1 && h('div', { class: 'gallery__thumbs' }, thumbs),
  ];
}
