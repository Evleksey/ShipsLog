import { h, icon } from './dom.js';

/** Per dialog: the tidy-up for whatever it is currently showing. */
const tidyUps = new WeakMap();

/**
 * Fills a <dialog> with a title bar, a scrolling body and an optional footer, and opens it as
 * a modal. The browser takes care of focus, Escape and the backdrop.
 *
 * @param {HTMLDialogElement} dialog
 * @param {Object} options
 * @param {string} options.title
 * @param {Node} [options.lead]              shown above the title
 * @param {Node|Node[]} options.body
 * @param {Node|Node[]} [options.footer]
 * @param {(event: SubmitEvent) => void} [options.onSubmit]  makes the dialog a form
 * @param {boolean} [options.dismissible]    also close when the backdrop is clicked
 * @param {() => void} [options.onClose]
 */
export function openDialog(dialog, { title, lead, body, footer, onSubmit, dismissible = false, onClose }) {
  tidyUps.get(dialog)?.(); // still showing something else: finish that first

  dialog.replaceChildren(
    h(onSubmit ? 'form' : 'div', { class: 'dialog__panel', onsubmit: onSubmit },
      h('header', { class: 'dialog__head' },
        h('div', { class: 'dialog__heading' },
          lead,
          h('h2', { class: 'dialog__title', id: `${dialog.id}-title` }, title),
        ),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close')),
      ),
      h('div', { class: 'dialog__body' }, body),
      footer && h('footer', { class: 'dialog__foot' }, footer),
    ),
  );

  // A click lands on the <dialog> itself only when it hits the backdrop. Requiring the press
  // to start there too keeps a text selection dragged out of the panel from closing it.
  let pressedBackdrop = false;
  dialog.onpointerdown = (event) => {
    pressedBackdrop = event.target === dialog;
  };
  dialog.onclick = (event) => {
    if (dismissible && pressedBackdrop && event.target === dialog) dialog.close();
  };

  const tidyUp = () => {
    dialog.removeEventListener('close', tidyUp);
    tidyUps.delete(dialog);
    dialog.replaceChildren();
    onClose?.();
  };
  tidyUps.set(dialog, tidyUp);
  dialog.addEventListener('close', tidyUp);

  if (!dialog.open) dialog.showModal();
}
