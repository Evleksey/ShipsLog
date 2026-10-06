import { h, icon } from './dom.js';
import { openDialog } from './dialog.js';
import { readPicture } from './pictures.js';
import { plural } from '../lib/format.js';

let fieldCount = 0;

/**
 * The form for a new boat, or for changing an existing one. Deleting a boat is done from here
 * too.
 *
 * @param {HTMLDialogElement} dialog
 * @param {Object} options
 * @param {Object} [options.boat]            the boat to change; leave out for a new one
 * @param {number} [options.entryCount]      size of the boat's log, named when deleting it
 * @param {Object} options.source            the data source, for showing the picture
 * @param {(draft: Object) => Promise<void>} options.onSave
 * @param {() => Promise<void>} [options.onDelete]
 */
export function openBoatForm(dialog, { boat, entryCount = 0, source, onSave, onDelete }) {
  let picture = boat?.picture;
  const rows = [];

  const name = input({
    type: 'text',
    required: true,
    maxlength: 60,
    autocomplete: 'off',
    autofocus: true,
    placeholder: 'e.g. Aurora',
    value: boat?.name ?? '',
  });
  const type = input({ type: 'text', maxlength: 60, placeholder: 'e.g. Sailing yacht', value: boat?.type ?? '' });
  const description = h('textarea', { class: 'input', rows: 3, maxlength: 400, value: boat?.description ?? '' });

  const preview = h('img', { alt: '' });
  const noPicture = h('span', { class: 'boat-picture__none' }, icon('anchor'));
  const fileInput = h('input', { class: 'visually-hidden', type: 'file', accept: 'image/*', onchange: choosePicture });
  const chooseLabel = h('span', {});
  const removePicture = h('button', {
    class: 'btn btn--small btn--danger',
    type: 'button',
    onclick: () => showPicture(undefined),
  }, icon('trash'), 'Remove');

  const detailList = h('ul', { class: 'detail-list' });
  const problem = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn--primary', type: 'submit' }, boat ? 'Save changes' : 'Add boat');
  const deleteButton = boat && onDelete
    && h('button', { class: 'btn btn--danger', type: 'button', onclick: remove }, icon('trash'), 'Delete boat');

  showPicture(picture);
  (boat?.details ?? []).forEach((detail) => addDetail(detail));
  if (rows.length === 0) addDetail();

  openDialog(dialog, {
    title: boat ? `Edit ${boat.name}` : 'New boat',
    onSubmit: submit,
    body: h('div', { class: 'form' },
      problem,
      h('div', { class: 'form__row' },
        field('Name', name),
        field('Type', type),
      ),
      field('Description', description),
      h('div', { class: 'field' },
        h('span', { class: 'field__label' }, 'Picture'),
        h('div', { class: 'boat-picture' },
          h('div', { class: 'boat-picture__frame' }, preview, noPicture),
          h('div', { class: 'form__actions' },
            h('label', { class: 'btn btn--small' }, icon('camera'), chooseLabel, fileInput),
            removePicture,
          ),
        ),
      ),
      h('fieldset', { class: 'field' },
        h('legend', { class: 'field__label' }, 'General information'),
        detailList,
        h('div', {},
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => addDetail().label.focus() },
            icon('plus'), 'Add a line'),
        ),
        h('p', { class: 'field__hint' }, 'Shown under the boat’s name, in this order. Engine hours and the last entry come from the log.'),
      ),
    ),
    footer: [
      deleteButton,
      h('span', { class: 'dialog__spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
      save,
    ],
  });

  function showPicture(src) {
    picture = src;
    if (src) preview.src = source.mediaUrl(src);
    preview.hidden = !src;
    noPicture.hidden = Boolean(src);
    removePicture.hidden = !src;
    chooseLabel.textContent = src ? 'Replace picture' : 'Choose a picture';
  }

  async function choosePicture() {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (!file) return;
    showProblem('');
    try {
      showPicture(await readPicture(file));
    } catch {
      showProblem(`“${file.name}” isn't a picture this browser can read.`);
    }
  }

  /** One line of general information: a label and its value. */
  function addDetail({ label = '', value = '' } = {}) {
    const number = rows.length + 1;
    const row = {
      label: input({
        type: 'text',
        maxlength: 40,
        placeholder: 'e.g. Home port',
        'aria-label': `Label of line ${number}`,
        value: label,
        oninput: clearProblem,
      }),
      value: input({
        type: 'text',
        maxlength: 80,
        placeholder: 'e.g. Saltsjöbaden',
        'aria-label': `Value of line ${number}`,
        value,
        oninput: clearProblem,
      }),
    };
    const element = h('li', { class: 'detail-list__item' },
      row.label,
      row.value,
      h('button', {
        class: 'icon-btn',
        type: 'button',
        'aria-label': `Remove line ${number}`,
        onclick: () => {
          rows.splice(rows.indexOf(row), 1);
          element.remove();
        },
      }, icon('trash')),
    );

    function clearProblem() {
      row.label.setCustomValidity('');
      row.value.setCustomValidity('');
    }

    rows.push(row);
    detailList.append(element);
    return row;
  }

  function showProblem(message) {
    problem.textContent = message;
    problem.hidden = !message;
    if (message) problem.scrollIntoView({ block: 'nearest' });
  }

  function setBusy(busy) {
    save.disabled = busy;
    if (deleteButton) deleteButton.disabled = busy;
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.value.trim()) {
      name.value = ''; // only spaces: let the browser ask for a name
      name.reportValidity();
      return;
    }
    const details = [];
    for (const row of rows) {
      const label = row.label.value.trim();
      const value = row.value.value.trim();
      if (!label && !value) continue; // an empty line is simply left out
      if (!label || !value) {
        const missing = label ? row.value : row.label;
        missing.setCustomValidity('Fill in both the label and the value, or remove the line.');
        missing.reportValidity();
        return;
      }
      details.push({ label, value });
    }

    const draft = {
      name: name.value.trim(),
      type: type.value.trim(),
      description: description.value.trim(),
      picture,
      details,
    };

    showProblem('');
    setBusy(true);
    try {
      await onSave(draft);
      dialog.close();
    } catch (error) {
      showProblem(error.message);
      setBusy(false);
    }
  }

  async function remove() {
    const log = entryCount > 0 ? ` and its ${plural(entryCount, 'log entry', 'log entries')}` : '';
    if (!window.confirm(`Delete ${boat.name}${log}? This can't be undone.`)) return;
    showProblem('');
    setBusy(true);
    try {
      await onDelete();
      dialog.close();
    } catch (error) {
      showProblem(error.message);
      setBusy(false);
    }
  }
}

function input(props) {
  return h('input', { class: 'input', ...props });
}

function field(label, control) {
  fieldCount += 1;
  control.id = `boat-field-${fieldCount}`;
  return h('div', { class: 'field' },
    h('label', { class: 'field__label', for: control.id }, label),
    control,
  );
}
