import { h } from './dom.js';

const SHOW_MS = 4000;
const SHOW_ERROR_MS = 8000;

/** A short message at the bottom of the page that goes away by itself. */
export function toast(message, kind = 'info') {
  const note = h('p', { class: `toast toast--${kind}` }, message);
  document.getElementById('toasts').append(note);
  setTimeout(() => note.remove(), kind === 'error' ? SHOW_ERROR_MS : SHOW_MS);
}
