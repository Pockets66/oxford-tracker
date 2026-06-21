import { el, clear } from "../dom.js";
import { displayName } from "../schema.js";
import { formatLongDate } from "../dates.js";

let INTERP = null;

async function loadInterp() {
  if (INTERP) return;
  try {
    const resp = await fetch("./js/data/astrology-interpretations.json");
    INTERP = await resp.json();
  } catch (err) {
    console.error("natal chart: failed to load interpretations", err);
    INTERP = {};
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const BODY_GLYPHS = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

const ASPECT_GLYPHS = {
  Conjunction: "☌", Sextile: "⚹", Square: "☐", Trine: "△", Opposition: "☍",
};

const BODY_ORDER = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];

function formatDeg(decimal) {
  const d = Math.floor(decimal);
  const m = Math.round((decimal - d) * 60);
  return `${d}° ${String(m).padStart(2, "0")}'`;
}

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function interp(keys) {
  let node = INTERP;
  for (const k of keys) {
    if (!node || typeof node !== "object") return "";
    node = node[k];
  }
  return typeof node === "string" ? node : "";
}

function aspectKey(from, type, to) {
  return interp(["aspects", `${from}-${type}-${to}`])
      || interp(["aspects", `${to}-${type}-${from}`]);
}

// ── Row builders ──────────────────────────────────────────────────────────────

function bodyRow(body, data, hasHouses) {
  const glyph  = BODY_GLYPHS[body] ?? "";
  const name   = capFirst(body);
  const house  = data.house ? `${ordinal(data.house)} house` : (hasHouses ? "—" : "");
  const note   = interp(["bodies", body, data.sign]);

  const mainEl = el("div", { class: "natal-row-main" }, [
    el("span", { class: "natal-row-glyph" }, [glyph]),
    el("span", { class: "natal-row-name" }, [name]),
    el("span", { class: "natal-row-sign" }, [data.sign]),
    el("span", { class: "natal-row-degree" }, [formatDeg(data.degree)]),
    el("span", { class: "natal-row-house" }, [house]),
  ]);

  const children = [mainEl];
  if (data.approximate) {
    children.push(el("div", { class: "natal-row-interp" }, ["Position is approximate (no birth time)."]));
  }
  if (note) children.push(el("div", { class: "natal-row-interp" }, [note]));

  return el("div", { class: "natal-row" }, children);
}

function angleRow(key, label, glyph, data) {
  if (!data) return null;
  const note = interp(["angles", key, data.sign]);
  const mainEl = el("div", { class: "natal-row-main" }, [
    el("span", { class: "natal-row-glyph" }, [glyph]),
    el("span", { class: "natal-row-name" }, [label]),
    el("span", { class: "natal-row-sign" }, [data.sign]),
    el("span", { class: "natal-row-degree" }, [formatDeg(data.degreeInSign)]),
  ]);
  const children = [mainEl];
  if (note) children.push(el("div", { class: "natal-row-interp" }, [note]));
  return el("div", { class: "natal-row" }, children);
}

function houseRow(h) {
  const note = interp(["houses", String(h.number)]);
  const mainEl = el("div", { class: "natal-row-main" }, [
    el("span", { class: "natal-row-glyph" }, [String(h.number)]),
    el("span", { class: "natal-row-name" }, [h.sign]),
    el("span", { class: "natal-row-degree" }, [formatDeg(h.degreeInSign)]),
  ]);
  const children = [mainEl];
  if (note) children.push(el("div", { class: "natal-row-interp" }, [note]));
  return el("div", { class: "natal-row" }, children);
}

function aspectRow(asp) {
  const fromGlyph = BODY_GLYPHS[asp.from] ?? "";
  const toGlyph   = BODY_GLYPHS[asp.to]   ?? "";
  const aspGlyph  = ASPECT_GLYPHS[asp.type] ?? "";
  const note      = aspectKey(asp.from, asp.type, asp.to);

  const mainEl = el("div", { class: "natal-row-main" }, [
    el("span", { class: "natal-row-glyph" }, [fromGlyph]),
    el("span", { class: "natal-aspect-from" }, [capFirst(asp.from)]),
    el("span", { class: "natal-aspect-glyph" }, [aspGlyph]),
    el("span", { class: "natal-aspect-to" }, [capFirst(asp.to)]),
    el("span", { class: "natal-aspect-type" }, [asp.type]),
    el("span", { class: "natal-aspect-orb" }, [`${asp.orb}° orb`]),
  ]);
  const children = [mainEl];
  if (note) children.push(el("div", { class: "natal-row-interp" }, [note]));
  return el("div", { class: "natal-row" }, children);
}

// ── Content builder ───────────────────────────────────────────────────────────

function buildContent(character, appData) {
  const chart    = character.natalChart;
  const hasHouses = !!chart.houses;
  const cityName  = character.birthCityId
    ? (appData?.meta?.knownCities ?? []).find(c => c.id === character.birthCityId)?.name ?? null
    : null;

  const subtitleParts = [];
  if (character.birthday) subtitleParts.push(formatLongDate(character.birthday));
  if (character.birthTime) subtitleParts.push(character.birthTime);
  if (cityName) subtitleParts.push(cityName);

  const headerEl = el("div", { class: "natal-chart-header" }, [
    el("p", { class: "natal-chart-name" }, ["Natal Chart — ", displayName(character)]),
    el("p", { class: "natal-chart-subtitle" }, [subtitleParts.join(" · ")]),
  ]);

  // Planets
  const planetsSection = el("div", {}, [
    el("div", { class: "natal-section-title" }, ["Planets"]),
    ...BODY_ORDER
      .filter(b => chart.bodies[b])
      .map(b => bodyRow(b, chart.bodies[b], hasHouses)),
  ]);

  // Angles
  const hasAngles = chart.angles?.ascendant || chart.angles?.midheaven;
  const anglesSection = hasAngles
    ? el("div", {}, [
        el("div", { class: "natal-section-title" }, ["Angles"]),
        angleRow("ascendant", "Ascendant", "↑", chart.angles.ascendant),
        angleRow("midheaven", "Midheaven", "↗", chart.angles.midheaven),
      ].filter(Boolean))
    : null;

  // Houses
  const housesSection = hasHouses
    ? el("div", {}, [
        el("div", { class: "natal-section-title" }, ["Houses"]),
        ...chart.houses.map(houseRow),
      ])
    : null;

  // Aspects
  const sorted  = [...chart.aspects].sort((a, b) => a.orb - b.orb);
  const shown   = sorted.slice(0, 25);
  const hidden  = sorted.slice(25);

  const aspectsList = el("div", {});
  for (const asp of shown) {
    aspectsList.append(aspectRow(asp));
  }

  if (hidden.length) {
    const moreEl = el("div", { class: "natal-row" }, []);
    const moreBtn = el("button", { class: "natal-more-btn" }, [`+ ${hidden.length} more aspects`]);
    moreBtn.addEventListener("click", () => {
      for (const asp of hidden) aspectsList.append(aspectRow(asp));
      moreEl.remove();
    });
    moreEl.append(moreBtn);
    aspectsList.append(moreEl);
  }

  const aspectsSection = el("div", {}, [
    el("div", { class: "natal-section-title" }, ["Aspects"]),
    aspectsList,
  ]);

  const content = el("div", { class: "natal-modal-content" }, [
    headerEl,
    planetsSection,
    anglesSection,
    housesSection,
    aspectsSection,
  ].filter(Boolean));

  return content;
}

// ── Modal lifecycle ───────────────────────────────────────────────────────────

let overlayEl = null;

function closeChartModal() {
  overlayEl?.remove();
  overlayEl = null;
  document.removeEventListener("keydown", onEsc);
}

function onEsc(e) {
  if (e.key === "Escape") { e.stopPropagation(); closeChartModal(); }
}

export async function openNatalChartModal(character, appData) {
  if (overlayEl) closeChartModal();
  await loadInterp();

  const closeBtn = el("button", { class: "natal-modal-close", title: "Close" }, ["×"]);
  closeBtn.addEventListener("click", closeChartModal);

  const modalEl = el("div", { class: "natal-modal" }, [
    el("div", { class: "natal-modal-header" }, [
      el("span", { class: "natal-modal-title" }, [displayName(character)]),
      closeBtn,
    ]),
    el("div", { class: "natal-modal-body" }, [buildContent(character, appData)]),
  ]);

  overlayEl = el("div", { class: "natal-modal-overlay" });
  overlayEl.addEventListener("click", (e) => { if (e.target === overlayEl) closeChartModal(); });
  overlayEl.append(modalEl);

  document.body.append(overlayEl);
  document.addEventListener("keydown", onEsc);
}
