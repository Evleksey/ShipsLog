/** Positions the way a navigator writes them: degrees and decimal minutes. */

export function hasPosition(location) {
  return Number.isFinite(location?.lat) && Number.isFinite(location?.lon);
}

/** "59°17.276′N 018°55.117′E" */
export function formatPosition({ lat, lon }) {
  return `${degreesMinutes(lat, 2, 'N', 'S')} ${degreesMinutes(lon, 3, 'E', 'W')}`;
}

function degreesMinutes(value, degreeDigits, positive, negative) {
  // Round once, in thousandths of a minute, so 59.9999999° can't print as 59°60.000′.
  const thousandths = Math.round(Math.abs(value) * 60000);
  const degrees = String(Math.floor(thousandths / 60000)).padStart(degreeDigits, '0');
  const minutes = ((thousandths % 60000) / 1000).toFixed(3).padStart(6, '0');
  return `${degrees}°${minutes}′${value < 0 ? negative : positive}`;
}
