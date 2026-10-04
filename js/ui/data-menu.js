import { h, icon } from './dom.js';
import { toast } from './toast.js';
import { nowInputValue } from '../lib/time.js';

/**
 * The "Demo data" menu of the static site: import a data file, export the current data as
 * one, or go back to the hosted demo data.
 *
 * @param {HTMLElement} root
 * @param {Object} options
 * @param {import('../data/static-source.js').StaticDataSource} options.source
 * @param {() => Promise<void>} options.onChanged   called after the data was replaced
 */
export function renderDataMenu(root, { source, onChanged }) {
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: importFile });
  const reset = item('reset', 'Reset to the demo data', resetData);
  const summary = h('summary', { class: 'menu__button' }, 'Demo data', icon('chevron'));
  const menu = h('details', { class: 'menu' },
    summary,
    h('div', { class: 'menu__list' },
      item('upload', 'Import a data file…', () => fileInput.click()),
      item('download', 'Export as a data file', exportFile),
      reset,
    ),
  );
  root.replaceChildren(menu, fileInput);

  menu.addEventListener('toggle', () => {
    reset.disabled = !source.hasLocalChanges;
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    summary.focus();
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) menu.open = false;
  });

  function item(symbol, label, action) {
    return h('button', {
      class: 'menu__item',
      type: 'button',
      onclick: () => {
        menu.open = false;
        action();
      },
    }, icon(symbol), label);
  }

  async function importFile() {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (!file) return;
    if (!window.confirm(`Replace the log in this browser with the contents of “${file.name}”?`)) return;
    try {
      source.importData(await file.text());
      await onChanged();
      toast(`Imported ${file.name}`);
    } catch (error) {
      toast(`Couldn't import ${file.name}. ${error.message}`, 'error');
    }
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([source.exportData()], { type: 'application/json' }));
    const link = h('a', { href: url, download: `shipslog-${nowInputValue().slice(0, 10)}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function resetData() {
    if (!window.confirm('Discard the changes made in this browser and go back to the demo data?')) return;
    try {
      await source.reset();
      await onChanged();
      toast('Back to the demo data');
    } catch (error) {
      toast(error.message, 'error');
    }
  }
}
