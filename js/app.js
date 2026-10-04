import { inspectionReport } from './lib/inspections.js';
import { latestEngineHours, tagCounts } from './lib/log.js';
import { renderBoatPanel } from './ui/boat-panel.js';
import { renderDataMenu } from './ui/data-menu.js';
import { h } from './ui/dom.js';
import { openEntryDialog } from './ui/entry-dialog.js';
import { openEntryForm } from './ui/entry-form.js';
import { createLogView } from './ui/log-view.js';
import { openSettingsDialog } from './ui/settings-dialog.js';
import { toast } from './ui/toast.js';

const LAST_BOAT_KEY = 'shipslog.boat';
const element = (id) => document.getElementById(id);

/**
 * Runs the page: loads the boats, shows the chosen boat with its log, and carries out what
 * the views ask for — open an entry, save one, change the reminder settings.
 */
export async function startApp(config, createDataSource) {
  const page = {
    main: element('main'),
    status: element('status'),
    boatSelect: element('boat-select'),
    boatPanel: element('boat-panel'),
    logPanel: element('log-panel'),
    dataMenu: element('data-menu'),
    footer: element('footer'),
    entryDialog: element('entry-dialog'),
    formDialog: element('form-dialog'),
    settingsDialog: element('settings-dialog'),
  };

  /** `boat` is one of `boats`; `entries` are that boat's log. */
  const state = { boats: [], boat: null, entries: [] };
  let source;
  let logView;
  let latestRequest = 0;

  // A picture that can't be loaded leaves its frame empty rather than showing a broken-image icon.
  document.addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement) event.target.classList.add('is-missing');
  }, true);
  document.addEventListener('load', (event) => {
    if (event.target instanceof HTMLImageElement) event.target.classList.remove('is-missing');
  }, true);

  try {
    source = await createDataSource(config);
    await source.init();
    logView = createLogView(page.logPanel, { config, source, onOpen: openEntry, onNew: () => editEntry(null) });
    page.boatSelect.addEventListener('change', () => selectBoat(page.boatSelect.value));
    if (source.kind === 'static') {
      renderDataMenu(page.dataMenu, { source, onChanged: () => loadBoats(state.boat?.id) });
    }

    const link = new URLSearchParams(window.location.search);
    await loadBoats(link.get('boat') ?? recall(LAST_BOAT_KEY));
    if (link.has('entry')) openEntry(link.get('entry'));
  } catch (error) {
    showStatus(error.message, true);
  }

  async function loadBoats(preferredId) {
    state.boats = await source.listBoats();
    page.boatSelect.replaceChildren(...state.boats.map((boat) => h('option', { value: boat.id }, boat.name)));
    page.boatSelect.disabled = state.boats.length === 0;
    if (state.boats.length === 0) {
      state.boat = null;
      showStatus('There are no boats in this log yet.');
      renderFooter();
      return;
    }
    const boat = state.boats.find((candidate) => candidate.id === preferredId) ?? state.boats[0];
    await selectBoat(boat.id);
  }

  async function selectBoat(boatId) {
    const boat = state.boats.find((candidate) => candidate.id === boatId);
    const request = ++latestRequest;
    page.main.setAttribute('aria-busy', 'true');
    let entries;
    try {
      entries = await source.listEntries(boat.id);
    } catch (error) {
      if (request !== latestRequest) return;
      if (state.boats.includes(state.boat)) {
        // Stay on the boat that is on screen.
        page.main.removeAttribute('aria-busy');
        page.boatSelect.value = state.boat.id;
        toast(error.message, 'error');
      } else {
        showStatus(error.message, true);
      }
      return;
    }
    if (request !== latestRequest) return; // the user has already picked another boat

    state.boat = boat;
    state.entries = entries;
    page.main.removeAttribute('aria-busy');
    page.boatSelect.value = boat.id;
    page.status.hidden = true;
    page.boatPanel.hidden = false;
    page.logPanel.hidden = false;
    document.title = `${boat.name} · Ship’s Log`;
    remember(LAST_BOAT_KEY, boat.id);
    updateLink();

    renderBoat();
    renderFooter();
    logView.show(entries, { resetFilters: true });
  }

  function report() {
    return inspectionReport(state.boat, state.entries, config.inspection);
  }

  function renderBoat() {
    renderBoatPanel(page.boatPanel, {
      boat: state.boat,
      entries: state.entries,
      report: report(),
      source,
      onOpenSettings: openSettings,
      onLogInspection: (part) => editEntry(null, {
        title: `${part} inspected`,
        types: [config.inspection.tag],
        parts: [part],
      }),
    });
  }

  /** After a change to the log: redraw everything that depends on the entries. */
  function showEntries(entries, revealEntryId) {
    state.entries = entries;
    renderBoat();
    renderFooter();
    logView.show(entries, { reveal: revealEntryId });
  }

  function openEntry(entryId) {
    const entry = state.entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;
    updateLink(entry.id);
    openEntryDialog(page.entryDialog, {
      entry,
      config,
      source,
      onEdit: () => editEntry(entry),
      onDelete: async () => {
        await source.deleteEntry(state.boat.id, entry.id);
        showEntries(state.entries.filter((existing) => existing.id !== entry.id));
        toast('Entry deleted');
      },
      onClose: () => updateLink(),
    });
  }

  function editEntry(entry, prefill) {
    const offered = (key, always) => [...new Set([...always, ...tagCounts(state.entries, key).map(({ tag }) => tag)])];
    openEntryForm(page.formDialog, {
      entry,
      prefill,
      typeOptions: offered('types', config.typeTags),
      partOptions: offered('parts', config.partTags),
      lastEngineHours: latestEngineHours(state.entries)?.engineHours,
      source,
      // The data source answers with the entry as it was saved; that is what goes on screen.
      onSave: async (draft) => {
        if (entry) {
          const saved = await source.updateEntry(state.boat.id, entry.id, draft);
          showEntries(state.entries.map((existing) => (existing.id === entry.id ? saved : existing)), saved.id);
          toast('Entry updated');
        } else {
          const saved = await source.createEntry(state.boat.id, draft);
          showEntries([...state.entries, saved], saved.id);
          toast('Entry added to the log');
        }
      },
    });
  }

  function openSettings() {
    openSettingsDialog(page.settingsDialog, {
      boat: state.boat,
      report: report(),
      rules: config.inspection,
      onSave: async (settings) => {
        state.boat.inspection = await source.saveInspectionSettings(state.boat.id, settings);
        renderBoat();
        renderFooter();
        toast('Inspection reminders updated');
      },
    });
  }

  /** Keeps the address bar pointing at what is on screen, so it can be bookmarked or shared. */
  function updateLink(entryId) {
    const url = new URL(window.location.href);
    url.searchParams.set('boat', state.boat.id);
    if (entryId) url.searchParams.set('entry', entryId);
    else url.searchParams.delete('entry');
    window.history.replaceState(null, '', url);
  }

  /** Replaces the boat and its log with a message; a failure also offers to start over. */
  function showStatus(message, failed = false) {
    page.status.replaceChildren(
      h('span', {}, message),
      failed && h('button', { class: 'btn', type: 'button', onclick: () => window.location.reload() }, 'Try again'),
    );
    page.status.classList.toggle('page__status--error', failed);
    page.status.hidden = false;
    page.boatPanel.hidden = true;
    page.logPanel.hidden = true;
    page.main.removeAttribute('aria-busy');
    if (failed) page.footer.textContent = '';
  }

  /** Says where the log on screen comes from and where changes to it go. */
  function renderFooter() {
    if (source.kind !== 'static') {
      const { baseUrl } = source;
      const address = baseUrl.origin === window.location.origin ? baseUrl.pathname : baseUrl.href;
      page.footer.textContent = `Connected to the log server at ${address}`;
    } else if (!source.hasLocalChanges) {
      page.footer.textContent = `Demo — this log is imported from ${config.staticDataUrl}. `
        + (source.keepsChanges
          ? 'Changes you make are kept in this browser only.'
          : 'Changes you make are lost when the page is reloaded.');
    } else {
      page.footer.textContent = 'Demo — you are looking at your own copy of the log, '
        + (source.keepsChanges ? 'kept in this browser only. ' : 'which is lost when the page is reloaded. ')
        + `“Demo data → Reset” goes back to ${config.staticDataUrl}.`;
    }
  }
}

function recall(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage blocked: just start with the first boat
  }
}

function remember(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: the choice simply isn't remembered
  }
}
