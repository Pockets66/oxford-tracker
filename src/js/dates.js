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

export function parseFlexibleDate(s) {
  if (!s) return null;
  const parts = s.split("-").map(Number);
  if (parts.length === 3) return { year: parts[0], month: parts[1], day: parts[2] };
  if (parts.length === 2) return { year: parts[0], month: parts[1], day: null };
  return null;
}

export function formatFlexibleDate(s) {
  const p = parseFlexibleDate(s);
  if (!p) return "";
  if (p.day) return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

export function flexibleDateSortKey(s) {
  const p = parseFlexibleDate(s);
  if (!p) return "";
  const m = String(p.month).padStart(2, "0");
  const d = String(p.day ?? 1).padStart(2, "0");
  return `${p.year}-${m}-${d}`;
}
