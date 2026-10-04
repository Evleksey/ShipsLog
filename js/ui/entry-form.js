import { h, icon } from './dom.js';
import { openDialog } from './dialog.js';
import { readPicture } from './pictures.js';
import { formatEngineHours } from '../lib/format.js';
import { fromInputValue, nowInputValue, parseTimestamp, toInputValue } from '../lib/time.js';

let fieldCount = 0;

/**
 * The form for a new log entry, or for changing an existing one.
 *
 * @param {HTMLDialogElement} dialog
 * @param {Object} options
 * @param {Object} [options.entry]           the entry to change; leave out for a new one
 * @param {Object} [options.prefill]         starting title/types/parts for a new entry
 * @param {string[]} options.typeOptions     type tags to offer
 * @param {string[]} options.partOptions     part tags to offer
 * @param {number} [options.lastEngineHours] shown as a hint
 * @param {Object} options.source            the data source, for showing pictures
 * @param {(draft: Object) => Promise<void>} options.onSave
 */
export function openEntryForm(dialog, { entry, prefill = {}, typeOptions, partOptions, lastEngineHours, source, onSave }) {
  const start = entry ?? prefill;
  const pictures = (entry?.pictures ?? []).map((picture) => ({ ...picture }));

  const title = input({
    type: 'text',
    required: true,
    maxlength: 120,
    autocomplete: 'off',
    autofocus: true,
    placeholder: 'e.g. Engine serviced',
    value: start.title ?? '',
  });
  const when = input({
    type: 'datetime-local',
    required: true,
    value: entry ? toInputValue(entry.timestamp) : nowInputValue(),
  });
  const engineHours = input({ type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: entry?.engineHours ?? '' });
  const types = tagPicker('Type', typeOptions, start.types ?? []);
  const parts = tagPicker('Part', partOptions, start.parts ?? []);
  const placeName = input({
    type: 'text',
    maxlength: 120,
    'aria-label': 'Name of the place',
    placeholder: 'e.g. Sandhamn guest harbour',
    value: entry?.location?.name ?? '',
  });
  const latitude = degrees(90, '59.2888', entry?.location?.lat);
  const longitude = degrees(180, '18.9175', entry?.location?.lon);
  const notes = h('textarea', { class: 'input', rows: 4, value: entry?.notes ?? '' });

  const pictureList = h('ul', { class: 'picture-list' });
  const fileInput = h('input', {
    class: 'visually-hidden',
    type: 'file',
    accept: 'image/*',
    multiple: true,
    onchange: addPictures,
  });
  // Browsers only hand out the device's position to pages served over HTTPS (or localhost).
  const locate = window.isSecureContext && 'geolocation' in navigator && h('button', {
    class: 'btn btn--small',
    type: 'button',
    onclick: useCurrentPosition,
  }, icon('crosshair'), 'Use current position');

  const problem = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn--primary', type: 'submit' }, entry ? 'Save changes' : 'Add to log');

  renderPictures();
  openDialog(dialog, {
    title: entry ? 'Edit entry' : 'New log entry',
    onSubmit: submit,
    body: h('div', { class: 'form' },
      problem,
      field('Title', title),
      h('div', { class: 'form__row' },
        field('Date and time', when),
        field('Engine hours', engineHours, lastEngineHours !== undefined && `Last logged: ${formatEngineHours(lastEngineHours)}`),
      ),
      types.element,
      parts.element,
      h('fieldset', { class: 'field' },
        h('legend', { class: 'field__label' }, 'Place'),
        placeName,
        h('div', { class: 'form__row' },
          field('Latitude', latitude),
          field('Longitude', longitude),
        ),
        h('p', { class: 'field__hint' }, 'Position in decimal degrees; south and west are negative.'),
        locate && h('div', {}, locate),
      ),
      field('Notes', notes),
      h('div', { class: 'field' },
        h('span', { class: 'field__label' }, 'Pictures'),
        pictureList,
        h('div', {}, h('label', { class: 'btn btn--small' }, icon('camera'), 'Add pictures', fileInput)),
      ),
    ),
    footer: [
      h('span', { class: 'dialog__spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
      save,
    ],
  });

  function renderPictures() {
    pictureList.hidden = pictures.length === 0;
    pictureList.replaceChildren(...pictures.map((picture, index) => h('li', { class: 'picture-list__item' },
      h('img', { src: source.mediaUrl(picture.src), alt: '' }),
      h('input', {
        class: 'input',
        type: 'text',
        maxlength: 140,
        placeholder: 'Caption (optional)',
        'aria-label': `Caption of picture ${index + 1}`,
        value: picture.caption ?? '',
        oninput: (event) => {
          picture.caption = event.target.value;
        },
      }),
      h('button', {
        class: 'icon-btn',
        type: 'button',
        'aria-label': `Remove picture ${index + 1}`,
        onclick: () => {
          pictures.splice(index, 1);
          renderPictures();
        },
      }, icon('trash')),
    )));
  }

  async function addPictures() {
    const files = [...fileInput.files];
    fileInput.value = '';
    showProblem('');
    for (const file of files) {
      try {
        pictures.push({ src: await readPicture(file) });
      } catch {
        showProblem(`“${file.name}” isn't a picture this browser can read.`);
      }
    }
    renderPictures();
  }

  function useCurrentPosition() {
    locate.disabled = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        latitude.value = coords.latitude.toFixed(5);
        longitude.value = coords.longitude.toFixed(5);
        clearPositionProblem();
        locate.disabled = false;
      },
      () => {
        showProblem("Couldn't get the current position — enter it by hand instead.");
        locate.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  /** A field for decimal degrees between −limit and +limit. */
  function degrees(limit, placeholder, value) {
    return input({
      type: 'number',
      min: -limit,
      max: limit,
      step: 'any',
      inputmode: 'decimal',
      placeholder,
      value: value ?? '',
      oninput: clearPositionProblem,
    });
  }

  function clearPositionProblem() {
    latitude.setCustomValidity('');
    longitude.setCustomValidity('');
  }

  function showProblem(message) {
    problem.textContent = message;
    problem.hidden = !message;
    if (message) problem.scrollIntoView({ block: 'nearest' });
  }

  /** The time as typed, in the entry's own time zone (a new entry takes this device's zone). */
  function timestamp() {
    if (entry && when.value === toInputValue(entry.timestamp)) return entry.timestamp;
    return fromInputValue(when.value, entry ? parseTimestamp(entry.timestamp).offsetMinutes : null);
  }

  async function submit(event) {
    event.preventDefault();
    const lat = latitude.value.trim();
    const lon = longitude.value.trim();
    if ((lat === '') !== (lon === '')) {
      const missing = lat === '' ? latitude : longitude;
      missing.setCustomValidity('Enter both latitude and longitude, or leave both empty.');
      missing.reportValidity();
      return;
    }

    const name = placeName.value.trim();
    const draft = {
      title: title.value.trim(),
      timestamp: timestamp(),
      notes: notes.value.trim(),
      types: types.values(),
      parts: parts.values(),
      engineHours: engineHours.value === '' ? undefined : Number(engineHours.value),
      location: name || lat !== ''
        ? { ...(name && { name }), ...(lat !== '' && { lat: Number(lat), lon: Number(lon) }) }
        : undefined,
      pictures: pictures.map(({ src, caption }) => (caption?.trim() ? { src, caption: caption.trim() } : { src })),
    };

    showProblem('');
    save.disabled = true;
    try {
      await onSave(draft);
      dialog.close();
    } catch (error) {
      showProblem(error.message);
      save.disabled = false;
    }
  }
}

function input(props) {
  return h('input', { class: 'input', ...props });
}

function field(label, control, hint) {
  fieldCount += 1;
  control.id = `field-${fieldCount}`;
  return h('div', { class: 'field' },
    h('label', { class: 'field__label', for: control.id }, label),
    control,
    hint && h('p', { class: 'field__hint' }, hint),
  );
}

/** Checkable chips for the offered tags, plus a box to add a tag that isn't offered yet. */
function tagPicker(label, options, chosen) {
  const chips = h('div', { class: 'chips' });
  const custom = h('input', {
    class: 'input input--inline',
    type: 'text',
    maxlength: 30,
    placeholder: 'Another…',
    'aria-label': `Another ${label.toLowerCase()} tag`,
    onkeydown: (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault(); // Enter adds the tag instead of submitting the form
      addCustom();
    },
  });

  const boxes = () => [...chips.querySelectorAll('input')];
  const find = (tag) => boxes().find((box) => box.value.toLowerCase() === tag.toLowerCase());

  function add(tag, checked) {
    chips.append(h('label', { class: 'chip chip--check' },
      h('input', { class: 'visually-hidden', type: 'checkbox', checked, value: tag }),
      h('span', {}, tag),
    ));
  }

  function addCustom() {
    const tag = custom.value.trim();
    custom.value = '';
    if (!tag) return;
    const existing = find(tag);
    if (existing) existing.checked = true;
    else add(tag, true);
  }

  const offered = [...options];
  for (const tag of chosen) {
    if (!offered.some((option) => option.toLowerCase() === tag.toLowerCase())) offered.push(tag);
  }
  for (const tag of offered) add(tag, chosen.some((choice) => choice.toLowerCase() === tag.toLowerCase()));

  return {
    element: h('fieldset', { class: 'field' },
      h('legend', { class: 'field__label' }, label),
      h('div', { class: 'tag-picker' },
        chips,
        h('div', { class: 'tag-picker__add' },
          custom,
          h('button', { class: 'btn btn--small', type: 'button', onclick: addCustom }, 'Add'),
        ),
      ),
    ),
    /** The checked tags; a tag still sitting in the box counts as added. */
    values() {
      addCustom();
      return boxes().filter((box) => box.checked).map((box) => box.value);
    },
  };
}
