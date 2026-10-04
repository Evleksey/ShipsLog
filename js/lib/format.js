const hours = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "1,243.5 h" */
export function formatEngineHours(value) {
  return `${hours.format(value)} h`;
}

/** plural(1, 'entry', 'entries') → "1 entry" */
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
