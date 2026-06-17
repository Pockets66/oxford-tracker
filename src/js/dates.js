const DAYS   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

function parseIso(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayOfWeek(isoDate) {
  return DAYS[parseIso(isoDate).getDay()];
}

export function addDays(isoDate, n) {
  const d = parseIso(isoDate);
  d.setDate(d.getDate() + n);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dy}`;
}

export function formatLongDate(isoDate) {
  const d = parseIso(isoDate);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
