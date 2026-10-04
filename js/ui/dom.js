const SVG = 'http://www.w3.org/2000/svg';

/**
 * Builds an element: h('button', { class: 'btn', onclick: save }, icon('check'), 'Save').
 *
 * Props become attributes (true → present, false/null → left out), functions become event
 * listeners and `value` is set as a property. Children may be nodes, strings, numbers, arrays
 * of those, or null/false to skip. Strings become text nodes, so text typed into the log is
 * never interpreted as HTML.
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value == null || value === false || name === 'value') continue;
    if (typeof value === 'function') node.addEventListener(name.replace(/^on/, ''), value);
    else if (name === 'class') node.className = value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  node.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  if (props.value != null) node.value = props.value; // after the children, so a <select> has its options
  return node;
}

/** An icon from the SVG sprite in index.html. */
export function icon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}

/** A tag label. `kind` is 'type' (what was done) or 'part' (what it was done to). */
export function tagPill(tag, kind) {
  return h('span', { class: `tag tag--${kind}`, 'data-tag': tag.toLowerCase() }, tag);
}
