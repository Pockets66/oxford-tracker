// Shared type-settings used by both the global timeline and personal timelines.

export const ALL_TIMELINE_KINDS = ["scenes", "events", "births", "deaths", "anomalies"];

export const DEFAULT_TYPE_SETTINGS = {
  scenes:    { color: "#3d7a4a", symbol: "■" },
  events:    { color: "#4a6b8a", symbol: "●" },
  births:    { color: "#5a8a5a", symbol: "✦" },
  deaths:    { color: "#8a8a8a", symbol: "✝" },
  anomalies: { color: "#9a3520", symbol: "▲" },
};

// Ordered list of selectable Unicode symbols (no emoji).
export const SYMBOLS = [
  { value: "●", label: "Dot ●" },
  { value: "○", label: "Ring ○" },
  { value: "■", label: "Square ■" },
  { value: "□", label: "Square □" },
  { value: "▲", label: "Triangle ▲" },
  { value: "▼", label: "Triangle ▼" },
  { value: "◆", label: "Diamond ◆" },
  { value: "◇", label: "Diamond ◇" },
  { value: "★", label: "Star ★" },
  { value: "✦", label: "Star ✦" },
  { value: "✚", label: "Cross ✚" },
  { value: "✝", label: "Cross ✝" },
  { value: "✿", label: "Flower ✿" },
  { value: "♦", label: "Diamond ♦" },
  { value: "♥", label: "Heart ♥" },
  { value: "♠", label: "Spade ♠" },
  { value: "⬟", label: "Pentagon ⬟" },
  { value: "⬡", label: "Hexagon ⬡" },
];

export function getTypeSettings(appData) {
  const saved = appData.meta?.timelineTypeSettings ?? {};
  const result = {};
  for (const kind of ALL_TIMELINE_KINDS) {
    result[kind] = { ...DEFAULT_TYPE_SETTINGS[kind], ...(saved[kind] ?? {}) };
  }
  return result;
}

// Build the HTML content string for a timeline item box.
// symbol and color refer to the leading indicator only; label text stays neutral.
export function itemContent(symbol, color, label) {
  const esc = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<span class="gtl-sym" style="color:${color}">${symbol}</span><span class="gtl-lbl">${esc}</span>`;
}
