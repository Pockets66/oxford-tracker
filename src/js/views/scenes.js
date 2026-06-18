import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createScene, displayName } from "../schema.js";
import { formatFlexibleDate } from "../dates.js";

const SCENE_STATUSES = ["Draft", "In progress", "Complete"];
const STATUS_SLUG = {
  "Draft": "draft",
  "In progress": "in-progress",
  "Complete": "complete",
};
const PERSIST_KEY = "oxford-filters-scenes";

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

function defaultState() {
  return { search: "", statuses: [...SCENE_STATUSES], factions: [], characters: [] };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if (saved) {
      return {
        search:     saved.search     ?? "",
        statuses:   Array.isArray(saved.statuses)   ? saved.statuses   : [...SCENE_STATUSES],
        factions:   Array.isArray(saved.factions)   ? saved.factions   : [],
        characters: Array.isArray(saved.characters) ? saved.characters : [],
      };
    }
  } catch {}
  return defaultState();
}

function persistState(state) {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(state)); } catch {}
}

function isModified(state) {
  return state.search !== ""
    || state.statuses.length < SCENE_STATUSES.length
    || state.factions.length > 0
    || state.characters.length > 0;
}

function applyFilters(scenes, state) {
  let result = scenes;

  if (state.statuses.length < SCENE_STATUSES.length) {
    result = result.filter(s => state.statuses.includes(s.status ?? "Draft"));
  }

  if (state.factions.length) {
    result = result.filter(s =>
      state.factions.some(fId => (s.factionIds ?? []).includes(fId))
    );
  }

  if (state.characters.length) {
    result = result.filter(s =>
      state.characters.some(cId =>
        (s.characters ?? []).some(sc => sc.characterId === cId)
      )
    );
  }

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(s =>
      (s.title      || "").toLowerCase().includes(q) ||
      (s.summary    || "").toLowerCase().includes(q) ||
      (s.body       || "").toLowerCase().includes(q) ||
      (s.storyBeats || "").toLowerCase().includes(q) ||
      (s.goals      || "").toLowerCase().includes(q)
    );
  }

  return result;
}

function renderCard(scene, appData) {
  const slug = STATUS_SLUG[scene.status] ?? "draft";
  const statusChip = el("span", { class: `scene-status-chip scene-status-chip--${slug}` }, [scene.status ?? "Draft"]);

  const dateStr = scene.sceneDate ? formatFlexibleDate(scene.sceneDate) : "";
  const metaStr = [dateStr, scene.location].filter(Boolean).join(" · ");

  const charCount    = (scene.characters ?? []).length;
  const factionChips = (scene.factionIds ?? []).map(fid => {
    const f    = appData.factions.find(x => x.id === fid);
    const chip = el("span", { class: "scene-card-faction-chip" }, [f ? f.name : fid]);
    if (f?.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
    return chip;
  });

  const card = el("article", { class: "scene-card" }, [
    el("div", { class: "scene-card-header" }, [
      el("h2", { class: "scene-card-title" }, [scene.title || "Untitled"]),
      statusChip,
    ]),
    metaStr ? el("p", { class: "scene-card-meta" }, [metaStr]) : null,
    scene.summary ? el("p", { class: "scene-card-summary" }, [scene.summary]) : null,
    el("div", { class: "scene-card-footer" }, [
      ...factionChips,
      el("span", { class: "scene-card-count" }, [`${charCount} character${charCount !== 1 ? "s" : ""}`]),
    ]),
  ].filter(Boolean));

  card.addEventListener("click", () => navigate(`scenes/${scene.id}`));
  return card;
}

export function mountScenes(container, appData) {
  appData.scenes ??= [];
  let state = loadState();

  async function handleNew() {
    const scene = createScene();
    appData.scenes.push(scene);
    await save("scenes", appData.scenes);
    navigate(`scenes/${scene.id}`);
  }

  // ── Grid ──
  const grid = el("div", { class: "scene-grid" });

  function renderGrid() {
    clear(grid);
    const visible = applyFilters(appData.scenes, state);
    if (!visible.length) {
      grid.append(el("p", { class: "scene-empty" }, ["No scenes match."]));
    } else {
      for (const s of visible) grid.append(renderCard(s, appData));
    }
  }

  function onChange() {
    persistState(state);
    clearBtn.style.display = isModified(state) ? "" : "none";
    renderGrid();
  }

  // ── Status toggle chips ──
  const statusBtns = SCENE_STATUSES.map(status => {
    const slug = STATUS_SLUG[status];
    const btn  = el("button", { class: "scene-status-toggle" }, [status]);

    function syncBtn() {
      const on = state.statuses.includes(status);
      btn.classList.toggle("is-active", on);
      btn.dataset.status = on ? slug : "";
    }
    syncBtn();

    btn.addEventListener("click", () => {
      if (state.statuses.includes(status)) {
        if (state.statuses.length === 1) return;
        state.statuses = state.statuses.filter(x => x !== status);
      } else {
        state.statuses = [...state.statuses, status];
      }
      syncBtn();
      onChange();
    });

    return { btn, syncBtn };
  });

  // ── Search ──
  const searchInput = el("input", { type: "text", class: "filter-search", placeholder: "Search scenes…" });
  searchInput.value = state.search;
  searchInput.addEventListener("input", () => { state.search = searchInput.value; onChange(); });

  // ── Faction filter ──
  const factionChipsEl = el("div", { class: "filter-faction-chips" });

  function renderFactionChips() {
    clear(factionChipsEl);
    for (const fId of state.factions) {
      const f    = (appData.factions ?? []).find(x => x.id === fId);
      const chip = el("span", { class: "filter-faction-active-chip" }, [
        f?.name ?? fId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.factions = state.factions.filter(id => id !== fId);
          renderFactionChips();
          onChange();
        }}, ["×"]),
      ]);
      if (f?.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
      factionChipsEl.append(chip);
    }
  }

  const factionSelect = el("select", { class: "filter-faction-select" });
  factionSelect.append(el("option", { value: "" }, ["Filter by faction…"]));
  for (const f of [...(appData.factions ?? [])].sort((a, b) => a.name.localeCompare(b.name))) {
    factionSelect.append(el("option", { value: f.id }, [f.name]));
  }
  factionSelect.addEventListener("change", () => {
    const val = factionSelect.value;
    if (!val || state.factions.includes(val)) { factionSelect.value = ""; return; }
    state.factions = [...state.factions, val];
    factionSelect.value = "";
    renderFactionChips();
    onChange();
  });
  renderFactionChips();

  // ── Character filter ──
  const charChipsEl = el("div", { class: "filter-faction-chips" });

  function renderCharChips() {
    clear(charChipsEl);
    for (const cId of state.characters) {
      const c = (appData.characters ?? []).find(x => x.id === cId);
      charChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        c ? displayName(c) : cId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.characters = state.characters.filter(id => id !== cId);
          renderCharChips();
          onChange();
        }}, ["×"]),
      ]));
    }
  }

  const charSelect = el("select", { class: "filter-faction-select" });
  charSelect.append(el("option", { value: "" }, ["Filter by character…"]));
  for (const c of [...(appData.characters ?? [])].sort((a, b) => displayName(a).localeCompare(displayName(b)))) {
    charSelect.append(el("option", { value: c.id }, [displayName(c)]));
  }
  charSelect.addEventListener("change", () => {
    const val = charSelect.value;
    if (!val || state.characters.includes(val)) { charSelect.value = ""; return; }
    state.characters = [...state.characters, val];
    charSelect.value = "";
    renderCharChips();
    onChange();
  });
  renderCharChips();

  // ── Popover ──
  const popover = el("div", { class: "filter-popover" });
  popover.append(
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Faction"]),
      el("div", { class: "filter-faction-wrap" }, [factionSelect, factionChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Character"]),
      el("div", { class: "filter-faction-wrap" }, [charSelect, charChipsEl]),
    ]),
  );

  const filterByBtn = el("button", { class: "btn-small filter-by-btn" }, ["Filter by ▾"]);
  filterByBtn.addEventListener("click", () => {
    const open = popover.classList.toggle("is-open");
    filterByBtn.classList.toggle("is-active", open);
    filterByBtn.textContent = open ? "Filter by ▴" : "Filter by ▾";
  });

  // ── Clear ──
  const clearBtn = el("button", { class: "btn-link filter-clear-btn" }, ["Clear filters"]);
  clearBtn.style.display = isModified(state) ? "" : "none";
  clearBtn.addEventListener("click", () => {
    state = defaultState();
    searchInput.value = "";
    statusBtns.forEach(({ syncBtn }) => syncBtn());
    renderFactionChips();
    renderCharChips();
    try { localStorage.removeItem(PERSIST_KEY); } catch {}
    clearBtn.style.display = "none";
    renderGrid();
  });

  const inlineBar = el("div", { class: "filter-inline-bar" }, [
    searchInput,
    el("div", { class: "scene-status-toggles" }, statusBtns.map(x => x.btn)),
    clearBtn,
    filterByBtn,
  ]);

  renderGrid();

  container.append(
    el("div", { class: "scenes-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New scene"]),
    ]),
    inlineBar,
    el("div", { class: "scenes-body" }, [grid, popover]),
  );
}
