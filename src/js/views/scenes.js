import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createScene } from "../schema.js";
import { formatFlexibleDate } from "../dates.js";

const SCENE_STATUSES = ["Draft", "In progress", "Complete"];

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}
const STATUS_SLUG = {
  "Draft": "draft",
  "In progress": "in-progress",
  "Complete": "complete",
};
const PERSIST_KEY = "oxford-filters-scenes";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if (saved) {
      return {
        search: saved.search ?? "",
        statuses: saved.statuses ?? [...SCENE_STATUSES],
      };
    }
  } catch {}
  return { search: "", statuses: [...SCENE_STATUSES] };
}

function persistState(state) {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(state)); } catch {}
}

function applyFilters(scenes, state) {
  let result = scenes;
  if (state.statuses.length < SCENE_STATUSES.length) {
    result = result.filter(s => state.statuses.includes(s.status));
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

  const charCount = (scene.characters ?? []).length;

  // Faction chips
  const factionChips = (scene.factionIds ?? []).map(fid => {
    const f = appData.factions.find(x => x.id === fid);
    const chip = el("span", { class: "scene-card-faction-chip" }, [f ? f.name : fid]);
    if (f?.color) {
      chip.style.background = f.color;
      chip.style.color = chipTextColor(f.color);
    }
    return chip;
  });

  const footer = el("div", { class: "scene-card-footer" }, [
    ...factionChips,
    el("span", { class: "scene-card-count" }, [
      `${charCount} character${charCount !== 1 ? "s" : ""}`,
    ]),
  ]);

  const card = el("article", { class: "scene-card" }, [
    el("div", { class: "scene-card-header" }, [
      el("h2", { class: "scene-card-title" }, [scene.title || "Untitled"]),
      statusChip,
    ]),
    metaStr ? el("p", { class: "scene-card-meta" }, [metaStr]) : null,
    scene.summary ? el("p", { class: "scene-card-summary" }, [scene.summary]) : null,
    footer,
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

  // ── Status toggle chips ──
  const statusBtns = SCENE_STATUSES.map(status => {
    const slug = STATUS_SLUG[status];
    const btn  = el("button", { class: "scene-status-toggle" }, [status]);

    function sync() {
      const on = state.statuses.includes(status);
      btn.classList.toggle("is-active", on);
      btn.dataset.status = on ? slug : "";
    }
    sync();

    btn.addEventListener("click", () => {
      if (state.statuses.includes(status)) {
        if (state.statuses.length === 1) return;
        state.statuses = state.statuses.filter(x => x !== status);
      } else {
        state.statuses = [...state.statuses, status];
      }
      sync();
      persistState(state);
      renderGrid();
    });

    return btn;
  });

  // ── Search ──
  const searchInput = el("input", { type: "text", class: "filter-search", placeholder: "Search scenes…" });
  searchInput.value = state.search;
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    persistState(state);
    renderGrid();
    updateClearBtn();
  });

  function isModified() {
    return state.search !== "" || state.statuses.length < SCENE_STATUSES.length;
  }

  const clearBtn = el("button", { class: "filter-clear-btn" }, ["Clear filters"]);
  clearBtn.addEventListener("click", () => {
    state = { search: "", statuses: [...SCENE_STATUSES] };
    searchInput.value = "";
    statusBtns.forEach((btn, i) => {
      btn.classList.add("is-active");
      btn.dataset.status = STATUS_SLUG[SCENE_STATUSES[i]];
    });
    persistState(state);
    renderGrid();
    updateClearBtn();
  });

  function updateClearBtn() {
    clearBtn.style.display = isModified() ? "" : "none";
  }
  updateClearBtn();

  const filterBar = el("div", { class: "filter-bar" }, [
    searchInput,
    el("div", { class: "scene-status-toggles" }, statusBtns),
    clearBtn,
  ]);

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

  renderGrid();

  container.append(
    el("div", { class: "scenes-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New scene"]),
    ]),
    filterBar,
    grid,
  );
}
