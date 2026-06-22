import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { createPlotline, displayName } from "../schema.js";
import { navigate } from "../router.js";
import { mountPlotlineDetail } from "./plotline-detail.js";

const FILTER_KEY = "oxford-filters-plotlines";

const LOCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11 7V5a3 3 0 0 0-6 0v2H4v7h8V7h-1zm-4-2a1 1 0 0 1 2 0v2H7V5zm1 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';

function loadFilters() {
  try { return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}"); }
  catch { return {}; }
}

function saveFilters(f) {
  localStorage.setItem(FILTER_KEY, JSON.stringify(f));
}

export function mountPlotlines(container, appData, selectedId) {
  appData.plotlines ??= [];

  if (selectedId) {
    const pl = appData.plotlines.find(p => p.id === selectedId);
    if (!pl) {
      container.append(el("p", {}, ["Plotline not found."]));
      return;
    }
    mountPlotlineDetail(container, appData, pl, {
      onUpdate: () => {},
      onDelete: () => navigate("plotlines"),
    });
    return;
  }

  renderOverview(container, appData);
}

function renderOverview(container, appData) {
  const filters = loadFilters();
  filters.search     ??= "";
  filters.charId     ??= "";
  filters.secretOnly ??= false;

  const charMap = new Map((appData.characters ?? []).map(c => [c.id, c]));

  function matchesFilters(pl) {
    const q = filters.search.toLowerCase().trim();
    if (q) {
      const text = [pl.title, pl.summary, pl.body].join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }
    if (filters.charId && !(pl.characterIds ?? []).includes(filters.charId)) return false;
    if (filters.secretOnly && !pl.isSecret) return false;
    return true;
  }

  const wrap = el("div", { class: "plotlines-overview" });

  // ── Toolbar ──
  const toolbar = el("div", { class: "plotlines-toolbar" });

  const newBtn = el("button", { class: "btn-primary", onclick: handleNew }, ["+ New plotline"]);

  const searchInput = el("input", {
    type: "text",
    class: "filter-search",
    placeholder: "Search title, summary, body…",
    value: filters.search,
  });
  searchInput.addEventListener("input", () => {
    filters.search = searchInput.value;
    saveFilters(filters);
    renderGrid();
  });

  // Character filter: only show chars that appear in at least one plotline
  const seenCharIds = new Set();
  for (const pl of appData.plotlines) {
    for (const cid of (pl.characterIds ?? [])) seenCharIds.add(cid);
  }
  const charSelect = el("select", { class: "filter-select" });
  charSelect.append(el("option", { value: "" }, ["All characters"]));
  for (const cid of seenCharIds) {
    const ch = charMap.get(cid);
    if (!ch) continue;
    const opt = el("option", { value: cid }, [displayName(ch)]);
    if (cid === filters.charId) opt.selected = true;
    charSelect.append(opt);
  }
  charSelect.addEventListener("change", () => {
    filters.charId = charSelect.value;
    saveFilters(filters);
    renderGrid();
  });

  const secretLabel = el("label", { class: "filter-checkbox-label" });
  const secretCheck = el("input", { type: "checkbox" });
  secretCheck.checked = filters.secretOnly;
  secretCheck.addEventListener("change", () => {
    filters.secretOnly = secretCheck.checked;
    saveFilters(filters);
    renderGrid();
  });
  secretLabel.append(secretCheck, " Secret only");

  toolbar.append(newBtn, searchInput, charSelect, secretLabel);
  wrap.append(toolbar);

  // ── Grid ──
  const gridEl = el("div", { class: "plotlines-grid" });
  wrap.append(gridEl);

  function renderGrid() {
    clear(gridEl);
    const visible = appData.plotlines.filter(matchesFilters);

    if (!appData.plotlines.length) {
      const emptyEl = el("div", { class: "plotlines-empty" }, [
        el("p", {}, ["No plotlines yet. Start one to thread scenes and events into a story."]),
        el("button", { class: "btn-primary", onclick: handleNew }, ["+ New plotline"]),
      ]);
      gridEl.append(emptyEl);
      return;
    }

    if (!visible.length) {
      gridEl.append(el("p", { class: "plotlines-empty-filter" }, ["No plotlines match the current filters."]));
      return;
    }

    for (const pl of visible) {
      gridEl.append(buildCard(pl));
    }
  }

  function buildCard(pl) {
    const total = (pl.items ?? []).length;
    const done  = (pl.items ?? []).filter(i => i.completed).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    const color = pl.color ?? "#4a6b8a";

    const chars    = (pl.characterIds ?? []).map(id => charMap.get(id)).filter(Boolean);
    const chipsEl  = el("div", { class: "plotline-card-characters" });
    const MAX_CHIPS = 3;
    for (const ch of chars.slice(0, MAX_CHIPS)) {
      chipsEl.append(el("span", { class: "char-chip" }, [displayName(ch)]));
    }
    if (chars.length > MAX_CHIPS) {
      chipsEl.append(el("span", { class: "char-chip char-chip--more" }, [`+${chars.length - MAX_CHIPS}`]));
    }

    const card = el("div", {
      class: "plotline-card",
      onclick: () => navigate(`plotlines/${pl.id}`),
    });

    const stripe = el("div", { class: "plotline-card-stripe", style: `background:${color}` });
    card.append(stripe);

    if (pl.isSecret) {
      const iconEl = el("span", { class: "plotline-card-secret-icon", title: "Secret plotline" });
      iconEl.innerHTML = LOCK_SVG;
      card.append(iconEl);
    }

    card.append(el("div", { class: "plotline-card-title" }, [pl.title || "Untitled"]));

    if (pl.summary) {
      card.append(el("div", { class: "plotline-card-summary" }, [pl.summary]));
    }

    if (total > 0) {
      card.append(
        el("div", { class: "plotline-card-progress-text" }, [`${done} of ${total} items complete`]),
        el("div", { class: "plotline-card-progress-bar" }, [
          el("div", {
            class: "plotline-card-progress-fill",
            style: `width:${pct}%;background:${color}`,
          }),
        ])
      );
    }

    card.append(chipsEl);
    return card;
  }

  async function handleNew() {
    const pl = createPlotline();
    appData.plotlines.push(pl);
    await save("plotlines", appData.plotlines);
    navigate(`plotlines/${pl.id}`);
  }

  renderGrid();
  container.append(wrap);
}
