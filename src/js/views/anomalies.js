import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createAnomaly, ANOMALY_CATEGORIES, ANOMALY_CLASSES, ANOMALY_STATUSES, anomalyOverallClass } from "../schema.js";
import { ANOMALY_GLYPHS } from "./anomaly-glyphs.js";

const PERSIST_KEY = "oxford-filters-anomalies";

function classSlug(roman) {
  return roman.toLowerCase();
}

function defaultState() {
  return {
    search:         "",
    types:          [],
    classes:        ANOMALY_CLASSES.map(c => c.roman),
    statuses:       [],
    locationSearch: "",
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if (saved) {
      return {
        search:         saved.search ?? "",
        types:          Array.isArray(saved.types)    ? saved.types    : [],
        classes:        Array.isArray(saved.classes)  ? saved.classes  : ANOMALY_CLASSES.map(c => c.roman),
        statuses:       Array.isArray(saved.statuses) ? saved.statuses : [],
        locationSearch: saved.locationSearch ?? "",
      };
    }
  } catch {}
  return defaultState();
}

function persistState(state) {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(state)); } catch {}
}

function applyFilters(anomalies, state) {
  let result = anomalies.filter(a => !a.archived);

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(a =>
      (a.title    ?? "").toLowerCase().includes(q) ||
      (a.lore     ?? "").toLowerCase().includes(q) ||
      (a.location ?? "").toLowerCase().includes(q) ||
      (a.tags     ?? []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (state.types.length) {
    result = result.filter(a => state.types.includes(a.primaryCategory));
  }

  if (state.classes.length < ANOMALY_CLASSES.length) {
    result = result.filter(a => {
      const overall = anomalyOverallClass(a);
      if (!overall) return true;
      return state.classes.includes(overall);
    });
  }

  if (state.statuses.length) {
    result = result.filter(a => state.statuses.includes(a.status ?? "Unknown"));
  }

  if (state.locationSearch) {
    const q = state.locationSearch.toLowerCase();
    result = result.filter(a => (a.location ?? "").toLowerCase().includes(q));
  }

  return result;
}

function renderCard(anomaly) {
  const overall = anomalyOverallClass(anomaly);
  const slug    = overall ? classSlug(overall) : null;

  const card = el("article", { class: "anomaly-card" });

  const headerEl = el("div", { class: "anomaly-card-header" });
  headerEl.append(el("h2", { class: "anomaly-card-title" }, [anomaly.title || "(unnamed)"]));
  if (overall) {
    headerEl.append(el("span", { class: `class-chip class-chip--${slug}` }, [`Class ${overall}`]));
  }
  card.append(headerEl);

  if (anomaly.primaryCategory) {
    const label     = anomaly.primaryClass
      ? `${anomaly.primaryCategory}-${anomaly.primaryClass}`
      : anomaly.primaryCategory;
    const glyphSpan = el("span", { class: "anomaly-glyph" });
    glyphSpan.innerHTML = ANOMALY_GLYPHS[anomaly.primaryCategory] || "";
    card.append(el("div", { class: "anomaly-card-primary" }, [glyphSpan, ` ${label}`]));
  }

  const secondaryTypes = anomaly.secondaryTypes ?? [];
  if (secondaryTypes.length) {
    const chipsEl = el("div", { class: "anomaly-card-secondary" });
    for (const st of secondaryTypes) {
      if (!st.category) continue;
      const stLabel = st.class ? `${st.category}-${st.class}` : st.category;
      const stSlug  = st.class ? classSlug(st.class) : null;
      const classes = ["anomaly-secondary-chip", stSlug ? `class-chip--${stSlug}` : ""].filter(Boolean).join(" ");
      chipsEl.append(el("span", { class: classes }, [stLabel]));
    }
    card.append(chipsEl);
  }

  if (anomaly.location) {
    card.append(el("p", { class: "anomaly-card-location" }, [anomaly.location]));
  }

  if (anomaly.lore) {
    card.append(el("p", { class: "anomaly-card-lore" }, [anomaly.lore]));
  }

  const statusSlug = (anomaly.status ?? "Unknown").toLowerCase();
  card.append(el("div", { class: "anomaly-card-footer" }, [
    el("span", { class: `anomaly-status-chip anomaly-status-chip--${statusSlug}` }, [anomaly.status ?? "Unknown"]),
  ]));

  card.addEventListener("click", () => navigate(`anomalies/${anomaly.id}`));
  return card;
}

export function mountAnomalies(container, appData) {
  appData.anomalies ??= [];
  let state       = loadState();
  let currentView = "list";

  async function handleNew() {
    const anomaly = createAnomaly();
    appData.anomalies.push(anomaly);
    await save("anomalies", appData.anomalies);
    navigate(`anomalies/${anomaly.id}`);
  }

  const grid = el("div", { class: "anomaly-grid" });

  function renderGrid() {
    clear(grid);
    if (currentView === "index") {
      renderIndex(grid, appData.anomalies, state);
      return;
    }
    const visible = applyFilters(appData.anomalies, state);
    if (!visible.length) {
      const emptyEl = el("div", { class: "anomaly-empty" }, [
        el("p", {}, ["No anomalies catalogued yet. Add one to start building Foley's Book."]),
      ]);
      const newBtn = el("button", { class: "btn-primary" }, ["New anomaly"]);
      newBtn.addEventListener("click", handleNew);
      emptyEl.append(newBtn);
      grid.append(emptyEl);
    } else {
      for (const a of visible) grid.append(renderCard(a));
    }
  }

  function onChange() {
    persistState(state);
    renderGrid();
  }

  // ── List / Index toggle ──
  const listBtn  = el("button", { class: "factions-view-toggle-btn is-active" }, ["List"]);
  const indexBtn = el("button", { class: "factions-view-toggle-btn" }, ["Index"]);
  listBtn.addEventListener("click", () => {
    if (currentView !== "list") {
      currentView = "list";
      listBtn.classList.add("is-active");
      indexBtn.classList.remove("is-active");
      grid.className = "anomaly-grid";
      renderGrid();
    }
  });
  indexBtn.addEventListener("click", () => {
    if (currentView !== "index") {
      currentView = "index";
      indexBtn.classList.add("is-active");
      listBtn.classList.remove("is-active");
      grid.className = "anomaly-index";
      renderGrid();
    }
  });

  // ── Search ──
  const searchInput = el("input", { type: "text", class: "filter-search", placeholder: "Search anomalies…" });
  searchInput.value = state.search;
  searchInput.addEventListener("input", () => { state.search = searchInput.value; onChange(); });

  // ── Primary Type filter ──
  const typeSelect = el("select", { class: "filter-faction-select" });
  typeSelect.append(el("option", { value: "" }, ["All types…"]));
  for (const cat of [...ANOMALY_CATEGORIES].sort((a, b) => a.name.localeCompare(b.name))) {
    typeSelect.append(el("option", { value: cat.name }, [cat.name]));
  }

  const typeChipsEl = el("div", { class: "filter-faction-chips" });

  function renderTypeChips() {
    clear(typeChipsEl);
    for (const name of state.types) {
      typeChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        name,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.types = state.types.filter(t => t !== name);
          renderTypeChips();
          onChange();
        }}, ["×"]),
      ]));
    }
  }

  typeSelect.addEventListener("change", () => {
    const val = typeSelect.value;
    if (!val || state.types.includes(val)) { typeSelect.value = ""; return; }
    state.types = [...state.types, val];
    typeSelect.value = "";
    renderTypeChips();
    onChange();
  });
  renderTypeChips();

  // ── Class filter ──
  const classChipsEl = el("div", { class: "anomaly-class-filter" });
  for (const cls of ANOMALY_CLASSES) {
    const slug = classSlug(cls.roman);
    const btn  = el("button", {
      class: `anomaly-class-toggle class-chip class-chip--${slug}`,
      title: cls.label,
    }, [cls.roman]);
    if (!state.classes.includes(cls.roman)) btn.classList.add("is-off");
    btn.addEventListener("click", () => {
      const idx = state.classes.indexOf(cls.roman);
      if (idx === -1) {
        state.classes.push(cls.roman);
        btn.classList.remove("is-off");
      } else {
        state.classes.splice(idx, 1);
        btn.classList.add("is-off");
      }
      onChange();
    });
    classChipsEl.append(btn);
  }

  // ── Status filter ──
  const statusSelect = el("select", { class: "filter-faction-select" });
  statusSelect.append(el("option", { value: "" }, ["All statuses…"]));
  for (const st of ANOMALY_STATUSES) {
    statusSelect.append(el("option", { value: st }, [st]));
  }

  const statusChipsEl = el("div", { class: "filter-faction-chips" });

  function renderStatusChips() {
    clear(statusChipsEl);
    for (const st of state.statuses) {
      statusChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        st,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.statuses = state.statuses.filter(s => s !== st);
          renderStatusChips();
          onChange();
        }}, ["×"]),
      ]));
    }
  }

  statusSelect.addEventListener("change", () => {
    const val = statusSelect.value;
    if (!val || state.statuses.includes(val)) { statusSelect.value = ""; return; }
    state.statuses = [...state.statuses, val];
    statusSelect.value = "";
    renderStatusChips();
    onChange();
  });
  renderStatusChips();

  // ── Location filter ──
  const locationInput = el("input", {
    type: "text", class: "filter-search", placeholder: "Filter by location…",
    style: "width: 160px",
  });
  locationInput.value = state.locationSearch;
  locationInput.addEventListener("input", () => { state.locationSearch = locationInput.value; onChange(); });

  renderGrid();

  container.append(
    el("div", { class: "anomalies-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New anomaly"]),
      el("div", { class: "factions-view-toggle" }, [listBtn, indexBtn]),
    ]),
    el("div", { class: "anomalies-filter-bar" }, [
      searchInput,
      el("div", { class: "filter-faction-wrap" }, [typeSelect, typeChipsEl]),
      classChipsEl,
      el("div", { class: "anomalies-filter-row" }, [
        el("div", { class: "filter-faction-wrap" }, [statusSelect, statusChipsEl]),
        locationInput,
      ]),
    ]),
    grid,
  );
}

function renderIndex(container, anomalies, state) {
  const visible = applyFilters(anomalies, state);

  if (!visible.length) {
    container.append(el("p", { class: "anomaly-empty" }, ["No anomalies match the current filters."]));
    return;
  }

  const grouped = {};
  for (const a of visible) {
    const cat = a.primaryCategory || "(Uncategorised)";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  }

  const sortedCats = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const orderedRomans = ANOMALY_CLASSES.map(c => c.roman);

  for (const cat of sortedCats) {
    const rows = [...grouped[cat]].sort((a, b) => {
      const oa = anomalyOverallClass(a);
      const ob = anomalyOverallClass(b);
      const ia = oa ? orderedRomans.indexOf(oa) : 999;
      const ib = ob ? orderedRomans.indexOf(ob) : 999;
      if (ia !== ib) return ia - ib;
      return (a.title || "").localeCompare(b.title || "");
    });

    const glyphSpan = el("span", { class: "anomaly-glyph" });
    glyphSpan.innerHTML = ANOMALY_GLYPHS[cat] || "";

    const groupEl = el("div", { class: "anomaly-index-group" });
    groupEl.append(el("div", { class: "anomaly-index-group-header" }, [glyphSpan, cat]));

    for (const a of rows) {
      const overall = anomalyOverallClass(a);
      const slug    = overall ? overall.toLowerCase() : null;
      const row     = el("div", { class: "anomaly-index-row" }, [
        el("span", { class: "anomaly-index-row-title" }, [a.title || "(unnamed)"]),
        slug
          ? el("span", { class: `class-chip class-chip--${slug}` }, [overall])
          : el("span", { class: "anomaly-index-row-meta" }, ["—"]),
        el("span", { class: "anomaly-index-row-meta" }, [a.status ?? "Unknown"]),
        el("span", { class: "anomaly-index-row-meta" }, [a.location ?? ""]),
      ]);
      row.addEventListener("click", () => navigate(`anomalies/${a.id}`));
      groupEl.append(row);
    }

    container.append(groupEl);
  }
}
