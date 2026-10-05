import { h, icon, tagPill } from './dom.js';
import { nextDue, overdueParts } from '../lib/inspections.js';
import { latestEngineHours, sortEntries } from '../lib/log.js';
import { daysSince, describeDaysAgo, describeDaysAhead, formatDate } from '../lib/time.js';
import { formatEngineHours } from '../lib/format.js';

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The top of the page: the boat's picture and general information, and underneath the
 * reminder for parts that are overdue for inspection.
 */
export function renderBoatPanel(root, { boat, entries, report, source, onLogInspection, onOpenSettings }) {
  root.replaceChildren(
    h('article', { class: 'boat' },
      h('figure', { class: 'boat__picture' },
        boat.picture
          ? h('img', { src: source.mediaUrl(boat.picture), alt: `Picture of ${boat.name}` })
          : h('span', { class: 'boat__no-picture' }, icon('anchor')),
      ),
      h('div', { class: 'boat__body' },
        boat.type && h('p', { class: 'boat__type' }, boat.type),
        h('h1', { class: 'boat__name' }, boat.name),
        boat.description && h('p', { class: 'boat__description' }, boat.description),
        facts(boat, entries),
      ),
      inspectionNotice(report, { onLogInspection, onOpenSettings }),
    ),
  );
}

/** What the log itself knows about the boat, followed by the details from the data. */
function facts(boat, entries) {
  const reading = latestEngineHours(entries);
  const newest = sortEntries(entries, 'newest')[0];
  const items = [
    reading && { label: 'Engine hours', value: formatEngineHours(reading.engineHours) },
    newest && { label: 'Last entry', value: capitalize(describeDaysAgo(daysSince(newest.timestamp))) },
    ...boat.details,
  ].filter(Boolean);
  if (items.length === 0) return null;
  return h('dl', { class: 'facts' }, items.map(({ label, value }) => h('div', { class: 'fact' },
    h('dt', { class: 'fact__label' }, label),
    h('dd', { class: 'fact__value' }, value),
  )));
}

function inspectionNotice(report, { onLogInspection, onOpenSettings }) {
  const overdue = overdueParts(report);
  const settings = h('button', { class: 'btn btn--small btn--quiet', type: 'button', onclick: onOpenSettings },
    icon('sliders'), 'Reminder settings');

  if (overdue.length > 0) {
    return h('section', { class: 'notice notice--warn', 'aria-label': 'Inspection reminders' },
      h('div', { class: 'notice__head' },
        icon('alert'),
        h('h2', { class: 'notice__title' }, overdue.length === 1 ? '1 inspection overdue' : `${overdue.length} inspections overdue`),
        settings,
      ),
      h('ul', { class: 'notice__list' }, overdue.map((item) => h('li', { class: 'notice__item' },
        tagPill(item.part, 'part'),
        h('span', { class: 'notice__text' },
          item.lastEntry
            ? ['Last entry ', h('strong', {}, describeDaysAgo(item.daysAgo)), ` (${formatDate(item.lastEntry.timestamp)})`]
            : h('strong', {}, 'Nothing logged yet'),
          h('span', { class: 'notice__interval' }, ` · due every ${item.intervalDays} days`),
        ),
        h('button', { class: 'btn btn--small', type: 'button', onclick: () => onLogInspection(item.part) }, 'Log inspection'),
      ))),
    );
  }

  const next = nextDue(report);
  return h('section', { class: `notice ${next ? 'notice--ok' : 'notice--idle'}`, 'aria-label': 'Inspection reminders' },
    h('div', { class: 'notice__head' },
      icon(next ? 'check' : 'clock'),
      h('p', { class: 'notice__title' },
        next ? 'Inspections up to date' : 'No inspection reminders are set for this boat',
        next && h('span', { class: 'notice__interval' }, ` · next due: ${next.part}, ${describeDaysAhead(next.dueInDays)}`),
      ),
      settings,
    ),
  );
}
