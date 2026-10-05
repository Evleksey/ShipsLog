import { h, tagPill } from './dom.js';
import { openDialog } from './dialog.js';
import { describeDaysAgo } from '../lib/time.js';

/**
 * Inspection reminder settings for one boat: per part, whether to remind and after how many
 * days without a log entry.
 *
 * @param {HTMLDialogElement} dialog
 * @param {Object} options
 * @param {Object} options.boat
 * @param {Array} options.report                the boat's inspectionReport()
 * @param {{ defaultIntervalDays: number }} options.rules
 * @param {(settings: Object) => Promise<void>} options.onSave
 */
export function openSettingsDialog(dialog, { boat, report, rules, onSave }) {
  const rows = [];
  const list = h('ul', { class: 'intervals' });
  const none = h('p', { class: 'field__hint', hidden: report.length > 0 },
    'No parts yet. They appear here once log entries carry part tags — or add one below.');
  const newPart = h('input', {
    class: 'input input--inline',
    type: 'text',
    maxlength: 30,
    placeholder: 'e.g. Sails',
    'aria-label': 'Part to add',
    onkeydown: (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault(); // Enter adds the part instead of saving the settings
      addPart();
    },
  });
  const problem = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn--primary', type: 'submit' }, 'Save');

  report.forEach(addRow);

  openDialog(dialog, {
    title: `Inspection reminders — ${boat.name}`,
    onSubmit: submit,
    body: h('div', { class: 'form' },
      problem,
      h('p', { class: 'form__intro' },
        'A part is flagged as overdue for inspection when nothing has been logged for it — an inspection or '
        + 'any other entry — within the number of days set here.'),
      list,
      none,
      h('div', { class: 'field' },
        h('span', { class: 'field__label' }, 'Add a part'),
        h('div', { class: 'tag-picker__add' },
          newPart,
          h('button', { class: 'btn btn--small', type: 'button', onclick: addPart }, 'Add'),
        ),
      ),
    ),
    footer: [
      h('span', { class: 'dialog__spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
      save,
    ],
  });

  function addRow({ part, monitored, intervalDays, lastEntry, daysAgo }) {
    const remind = h('input', {
      type: 'checkbox',
      checked: monitored,
      'aria-label': `Remind about ${part} inspections`,
      onchange: sync,
    });
    const days = h('input', {
      class: 'input input--days',
      type: 'number',
      min: 1,
      max: 3650,
      step: 1,
      required: true,
      inputmode: 'numeric',
      'aria-label': `Days before ${part} is overdue`,
      value: intervalDays,
    });
    const element = h('li', { class: 'intervals__row' },
      h('label', { class: 'intervals__part' }, remind, tagPill(part, 'part')),
      h('span', { class: 'intervals__last' }, lastEntry ? `Last entry ${describeDaysAgo(daysAgo)}` : 'Nothing logged'),
      h('span', { class: 'intervals__days' }, 'every', days, 'days'),
    );

    function sync() {
      days.disabled = !remind.checked;
      element.classList.toggle('intervals__row--off', !remind.checked);
    }
    sync();

    const row = { part, remind, days, sync };
    rows.push(row);
    list.append(element);
    none.hidden = true;
    return row;
  }

  function addPart() {
    const part = newPart.value.trim();
    newPart.value = '';
    if (!part) return;
    let row = rows.find((existing) => existing.part.toLowerCase() === part.toLowerCase());
    if (row) {
      row.remind.checked = true;
      row.sync();
    } else {
      row = addRow({ part, monitored: true, intervalDays: rules.defaultIntervalDays, lastEntry: null, daysAgo: null });
    }
    row.days.focus();
  }

  async function submit(event) {
    event.preventDefault();
    addPart(); // a part still sitting in the box counts as added
    const settings = {};
    for (const { part, remind, days } of rows) {
      settings[part] = {
        days: Number(days.value) || rules.defaultIntervalDays,
        ...(!remind.checked && { monitored: false }),
      };
    }

    problem.hidden = true;
    save.disabled = true;
    try {
      await onSave(settings);
      dialog.close();
    } catch (error) {
      problem.textContent = error.message;
      problem.hidden = false;
      save.disabled = false;
    }
  }
}
