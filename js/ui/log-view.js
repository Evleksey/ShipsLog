import { h, icon, tagPill } from './dom.js';
import { ORDERS, filterEntries, sortEntries, tagCounts } from '../lib/log.js';
import { formatEngineHours, plural } from '../lib/format.js';
import { formatTime, parseTimestamp, shortMonth } from '../lib/time.js';

const MAX_THUMBNAILS = 2;

/**
 * The log: a filter bar (type tags, part tags, ordering) above the list of entries.
 * The view keeps the filter and ordering choices itself; give it entries with `show()`.
 */
export function createLogView(root, { config, source, onOpen, onNew }) {
  let entries = [];
  let order = ORDERS[0].id;
  const selected = { types: new Set(), parts: new Set() };

  const count = h('span', { role: 'status' });
  const clear = h('button', { class: 'link', type: 'button', hidden: true, onclick: clearFilters }, 'Clear filters');
  const typeFilter = tagFilter('Type', 'types', 'type');
  const partFilter = tagFilter('Part', 'parts', 'part');
  const orderSelect = h('select', { class: 'select', id: 'log-order', onchange: changeOrder },
    ORDERS.map(({ id, label }) => h('option', { value: id }, label)));
  const list = h('ol', { class: 'entries' });
  const empty = h('p', { class: 'log__empty', hidden: true });

  root.replaceChildren(
    h('div', { class: 'log__head' },
      h('h2', { class: 'log__title', id: 'log-heading' }, 'Log'),
      h('p', { class: 'log__count' }, count, clear),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => onNew() }, icon('plus'), 'New entry'),
    ),
    h('div', { class: 'filters' },
      h('div', { class: 'filters__tags' }, typeFilter.element, partFilter.element),
      h('div', { class: 'filters__order' },
        h('label', { class: 'filters__label', for: 'log-order' }, 'Order'),
        orderSelect,
      ),
    ),
    list,
    empty,
  );

  function tagFilter(label, key, kind) {
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': `Filter by ${label.toLowerCase()}` });
    const element = h('div', { class: 'filters__group' }, h('span', { class: 'filters__label' }, label), chips);

    function chip({ tag, count: uses }) {
      return h('button', {
        class: `chip chip--${kind}`,
        type: 'button',
        'data-tag': tag.toLowerCase(),
        'aria-pressed': String(selected[key].has(tag)),
        onclick: (event) => {
          if (!selected[key].delete(tag)) selected[key].add(tag);
          // Flip the chip in place rather than rebuilding it, so it keeps keyboard focus.
          event.currentTarget.setAttribute('aria-pressed', String(selected[key].has(tag)));
          renderList();
        },
      }, tag, h('span', { class: 'chip__count' }, uses));
    }

    return {
      element,
      render(tags) {
        element.hidden = tags.length === 0;
        chips.replaceChildren(...tags.map(chip));
      },
    };
  }

  function changeOrder() {
    order = orderSelect.value;
    renderList();
  }

  function clearFilters() {
    selected.types.clear();
    selected.parts.clear();
    renderFilters();
    renderList();
  }

  function renderFilters() {
    typeFilter.render(tagCounts(entries, 'types', config.typeTags));
    partFilter.render(tagCounts(entries, 'parts', config.partTags));
  }

  function renderList() {
    const visible = sortEntries(filterEntries(entries, selected), order);
    const filtering = selected.types.size + selected.parts.size > 0;
    const total = plural(entries.length, 'entry', 'entries');
    count.textContent = filtering ? `${visible.length} of ${total}` : total;
    clear.hidden = !filtering;
    list.replaceChildren(...visible.map(row));
    list.hidden = visible.length === 0;
    empty.hidden = visible.length > 0;
    empty.textContent = entries.length === 0
      ? 'Nothing has been logged for this boat yet.'
      : 'No entries match these filters.';
  }

  function row(entry) {
    const time = parseTimestamp(entry.timestamp);
    const thumbnails = entry.pictures.slice(0, MAX_THUMBNAILS);
    const more = entry.pictures.length - thumbnails.length;
    return h('li', {},
      h('button', { class: 'entry', type: 'button', 'data-entry': entry.id, onclick: () => onOpen(entry.id) },
        h('time', { class: 'entry__date', datetime: entry.timestamp },
          h('span', { class: 'entry__day' }, time.day),
          h('span', { class: 'entry__month' }, `${shortMonth(time.month)} ${time.year}`),
          h('span', { class: 'entry__time' }, formatTime(entry.timestamp)),
        ),
        h('span', { class: 'entry__main' },
          h('span', { class: 'entry__title' }, entry.title),
          h('span', { class: 'entry__tags' },
            entry.types.map((tag) => tagPill(tag, 'type')),
            entry.parts.map((tag) => tagPill(tag, 'part')),
          ),
          entry.notes && h('span', { class: 'entry__notes' }, entry.notes),
          meta(entry),
        ),
        thumbnails.length > 0 && h('span', { class: 'entry__pictures' },
          thumbnails.map((picture, index) => h('span', { class: 'entry__thumb' },
            h('img', { src: source.mediaUrl(picture.src), alt: '', loading: 'lazy' }),
            more > 0 && index === thumbnails.length - 1 && h('span', { class: 'entry__more' }, `+${more}`),
          )),
        ),
      ),
    );
  }

  function meta(entry) {
    const items = [
      entry.location?.name && ['pin', entry.location.name],
      entry.engineHours !== undefined && ['gauge', formatEngineHours(entry.engineHours)],
    ].filter(Boolean);
    if (items.length === 0) return null;
    return h('span', { class: 'entry__meta' },
      items.map(([symbol, label]) => h('span', { class: 'entry__meta-item' }, icon(symbol), label)));
  }

  return {
    /**
     * Shows a boat's entries. `resetFilters` starts with nothing selected (a different boat);
     * `reveal` makes sure the entry with that id is listed, scrolls to it and highlights it.
     */
    show(nextEntries, { resetFilters = false, reveal } = {}) {
      entries = nextEntries;
      for (const key of ['types', 'parts']) {
        // A tag that no entry carries any more can't stay selected: nothing could clear it.
        const inUse = new Set(entries.flatMap((entry) => entry[key]));
        for (const tag of [...selected[key]]) {
          if (resetFilters || !inUse.has(tag)) selected[key].delete(tag);
        }
      }
      if (reveal && !filterEntries(entries, selected).some((entry) => entry.id === reveal)) {
        selected.types.clear();
        selected.parts.clear();
      }
      renderFilters();
      renderList();

      const revealed = reveal && [...list.querySelectorAll('.entry')].find((button) => button.dataset.entry === reveal);
      if (revealed) {
        revealed.scrollIntoView({ block: 'nearest' });
        revealed.classList.add('entry--fresh');
      }
    },
  };
}
