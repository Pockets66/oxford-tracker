import { el, clear } from "../dom.js";
import { displayName } from "../schema.js";
import { formatFlexibleDate } from "../dates.js";
import { navigate } from "../router.js";
import { openTimelineEventDialog } from "./timeline-event-dialog.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

function toJsDate(s) {
  if (!s) return null;
  const parts = s.split("-").map(Number);
  if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  if (parts.length === 2) return new Date(parts[0], parts[1] - 1, 1);
  if (parts.length === 1 && parts[0]) return new Date(parts[0], 0, 1);
  return null;
}

function toVisItem(item) {
  return {
    id:        item.id,
    content:   item.content,
    title:     item.tooltip,
    start:     item.start,
    type:      item.type,
    className: item.className,
    style:     item.style,
  };
}

// ── Item collection ───────────────────────────────────────────────────────────

function buildAllItems(appData) {
  const items = [];

  // Index: character id → factionIds
  const charFactionIds = new Map();
  for (const c of appData.characters ?? []) charFactionIds.set(c.id, c.factionIds ?? []);

  function effectiveFactions(characterIds, directFactionIds) {
    const ids = new Set(directFactionIds);
    for (const cId of characterIds) for (const fid of charFactionIds.get(cId) ?? []) ids.add(fid);
    return [...ids];
  }

  // Scenes
  for (const sc of appData.scenes ?? []) {
    if (!sc.sceneDate) continue;
    const d = toJsDate(sc.sceneDate);
    if (!d) continue;

    const plotline = (appData.plotlines ?? []).find(pl => (sc.plotlineIds ?? []).includes(pl.id));

    let className, style;
    if (plotline) {
      className = "gtl-scene-plotline";
      style     = `background-color: ${plotline.color}; border-color: ${plotline.color}; color: ${chipTextColor(plotline.color)};`;
    } else if (sc.status === "Complete") {
      className = "gtl-scene-complete";
      style     = "";
    } else if (sc.status === "In progress") {
      className = "gtl-scene-inprogress";
      style     = "";
    } else {
      className = "gtl-scene-draft";
      style     = "";
    }

    const charIds   = (sc.characters ?? []).map(r => r.characterId);
    const charNames = charIds.slice(0, 3).map(cId => {
      const c = (appData.characters ?? []).find(x => x.id === cId);
      return c ? displayName(c) : null;
    }).filter(Boolean);

    items.push({
      id:           `scene:${sc.id}`,
      content:      sc.title || "(untitled scene)",
      tooltip:      [
        `<b>${sc.title || "(untitled scene)"}</b>`,
        formatFlexibleDate(sc.sceneDate),
        sc.status,
        charNames.length ? charNames.join(", ") : null,
      ].filter(Boolean).join("<br>"),
      start:        d,
      type:         "box",
      className,
      style,
      kind:         "scene",
      status:       sc.status ?? "Draft",
      sceneId:      sc.id,
      characterIds: charIds,
      factionIds:   effectiveFactions(charIds, sc.factionIds ?? []),
      plotlineIds:  sc.plotlineIds ?? [],
    });
  }

  // Timeline events
  for (const ev of appData.timelineEvents ?? []) {
    const d = toJsDate(ev.date);
    if (!d) continue;
    const charNames = (ev.characterIds ?? []).slice(0, 3).map(cId => {
      const c = (appData.characters ?? []).find(x => x.id === cId);
      return c ? displayName(c) : null;
    }).filter(Boolean);

    items.push({
      id:           `event:${ev.id}`,
      content:      ev.title || "(untitled event)",
      tooltip:      [
        `<b>${ev.title || "(untitled event)"}</b>`,
        ev.date ? formatFlexibleDate(ev.date) : null,
        charNames.length ? charNames.join(", ") : null,
      ].filter(Boolean).join("<br>"),
      start:        d,
      type:         "box",
      className:    "gtl-event",
      style:        "",
      kind:         "event",
      eventId:      ev.id,
      characterIds: ev.characterIds ?? [],
      factionIds:   effectiveFactions(ev.characterIds ?? [], ev.factionIds ?? []),
      plotlineIds:  ev.plotlineIds ?? [],
    });
  }

  // Births
  for (const ch of appData.characters ?? []) {
    if (!ch.birthday) continue;
    const d = toJsDate(ch.birthday);
    if (!d) continue;
    items.push({
      id:           `birth:${ch.id}`,
      content:      `${displayName(ch)} born`,
      tooltip:      `<b>${displayName(ch)}</b><br>${formatFlexibleDate(ch.birthday)}<br>Born`,
      start:        d,
      type:         "point",
      className:    "gtl-birth",
      style:        "",
      kind:         "birth",
      characterId:  ch.id,
      characterIds: [ch.id],
      factionIds:   effectiveFactions([ch.id], []),
      plotlineIds:  [],
    });
  }

  // Deaths
  for (const ch of appData.characters ?? []) {
    if (!ch.deathDate) continue;
    const d = toJsDate(ch.deathDate);
    if (!d) continue;
    items.push({
      id:           `death:${ch.id}`,
      content:      `${displayName(ch)} died`,
      tooltip:      `<b>${displayName(ch)}</b><br>${formatFlexibleDate(ch.deathDate)}<br>Died`,
      start:        d,
      type:         "point",
      className:    "gtl-death",
      style:        "",
      kind:         "death",
      characterId:  ch.id,
      characterIds: [ch.id],
      factionIds:   effectiveFactions([ch.id], []),
      plotlineIds:  [],
    });
  }

  return items;
}

// ── Filter state ──────────────────────────────────────────────────────────────

export const ALL_KINDS    = ["scenes", "events", "births", "deaths"];
export const ALL_STATUSES = ["Draft", "In progress", "Complete"];
const PERSIST_KEY         = "global-timeline";

export function defaultState() {
  return {
    kinds:      [...ALL_KINDS],
    statuses:   [...ALL_STATUSES],
    characters: [],
    factions:   [],
    plotlines:  [],
    dateFrom:   "",
    dateTo:     "",
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if (s) {
      return {
        kinds:      Array.isArray(s.kinds)      ? s.kinds      : [...ALL_KINDS],
        statuses:   Array.isArray(s.statuses)   ? s.statuses   : [...ALL_STATUSES],
        characters: Array.isArray(s.characters) ? s.characters : [],
        factions:   Array.isArray(s.factions)   ? s.factions   : [],
        plotlines:  Array.isArray(s.plotlines)  ? s.plotlines  : [],
        dateFrom:   s.dateFrom ?? "",
        dateTo:     s.dateTo   ?? "",
      };
    }
  } catch {}
  return defaultState();
}

function persistState(state) {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(state)); } catch {}
}

function isModified(state) {
  const def = defaultState();
  return state.kinds.length      < def.kinds.length
    || state.statuses.length     < def.statuses.length
    || state.characters.length   > 0
    || state.factions.length     > 0
    || state.plotlines.length    > 0
    || state.dateFrom            !== ""
    || state.dateTo              !== "";
}

function applyFilters(items, state) {
  let r = items;
  if (state.kinds.length < ALL_KINDS.length) r = r.filter(i => state.kinds.includes(i.kind));
  if (state.statuses.length < ALL_STATUSES.length) r = r.filter(i => i.kind !== "scene" || state.statuses.includes(i.status));
  if (state.characters.length) r = r.filter(i => state.characters.some(c => i.characterIds.includes(c)));
  if (state.factions.length)   r = r.filter(i => state.factions.some(f => i.factionIds.includes(f)));
  if (state.plotlines.length)  r = r.filter(i => state.plotlines.some(p => i.plotlineIds.includes(p)));
  if (state.dateFrom) { const d = toJsDate(state.dateFrom); if (d) r = r.filter(i => i.start >= d); }
  if (state.dateTo)   { const d = toJsDate(state.dateTo);   if (d) r = r.filter(i => i.start <= d); }
  return r;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export async function mountGlobalTimeline(container, appData) {
  const mainEl = document.querySelector("#main");
  mainEl.classList.add("gtl-main");

  let tlInstance  = null;
  let dataset     = null;
  let allItems    = buildAllItems(appData);
  let state       = loadState();

  function onDateChange(e) {
    if (!tlInstance) return;
    try { tlInstance.setCustomTime(new Date(e.detail.date), "now"); } catch (_) {}
  }
  window.addEventListener("current-date-change", onDateChange);

  window.addEventListener("route-change", function onLeave() {
    window.removeEventListener("route-change", onLeave);
    window.removeEventListener("current-date-change", onDateChange);
    if (tlInstance) { tlInstance.destroy(); tlInstance = null; }
    mainEl.classList.remove("gtl-main");
  });

  // ── DOM ───────────────────────────────────────────────────────────────────────

  const toolbarEl = el("div", { class: "gtl-toolbar" });
  const canvasEl  = el("div", { class: "gtl-canvas" });
  const popoverEl = el("div", { class: "filter-popover gtl-popover" });
  container.append(el("div", { class: "gtl-container" }, [toolbarEl, canvasEl, popoverEl]));

  // ── Dataset helpers ───────────────────────────────────────────────────────────

  function refreshDataset() {
    if (!dataset) return;
    dataset.clear();
    dataset.add(applyFilters(allItems, state).map(toVisItem));
    if (clearBtn) clearBtn.style.display = isModified(state) ? "" : "none";
  }

  function rebuildItems() {
    allItems = buildAllItems(appData);
    refreshDataset();
  }

  // ── Build vis-timeline ────────────────────────────────────────────────────────

  if (!allItems.length) {
    canvasEl.append(el("div", { class: "placeholder-view" }, [
      "No dated items yet. Add scene dates, character birthdays, or events from other tabs to populate the timeline.",
    ]));
  } else {
    try {
      const { Timeline, DataSet } = await import("../../vendor/vis-timeline.esm.min.js");

      dataset = new DataSet(applyFilters(allItems, state).map(toVisItem));

      tlInstance = new Timeline(canvasEl, dataset, {
        height:          "100%",
        stack:           true,
        editable:        { add: false, updateTime: false, updateGroup: false, remove: false },
        zoomable:        true,
        moveable:        true,
        showCurrentTime: false,
        selectable:      true,
      });

      const currentDate = appData.meta?.currentDate;
      if (currentDate) {
        const center     = new Date(currentDate);
        const sixMonths  = 180 * 24 * 60 * 60 * 1000;
        tlInstance.setWindow(new Date(center.getTime() - sixMonths), new Date(center.getTime() + sixMonths));
        try { tlInstance.addCustomTime(center, "now"); } catch (_) {}
      }

      tlInstance.on("click", props => {
        if (!props.item) return;
        const raw  = String(props.item);
        const item = allItems.find(i => String(i.id) === raw);
        if (!item) return;

        if (item.kind === "scene") {
          navigate(`scenes/${item.sceneId}`);
        } else if (item.kind === "birth" || item.kind === "death") {
          navigate(`characters/${item.characterId}`);
        } else if (item.kind === "event") {
          const ev = (appData.timelineEvents ?? []).find(e => e.id === item.eventId);
          if (!ev) return;
          openTimelineEventDialog({
            existingEvent: ev,
            characterId:   null,
            appData,
            onSave:   rebuildItems,
            onDelete: rebuildItems,
            onClose:  () => {},
          });
        }
      });
    } catch (err) {
      canvasEl.append(el("p", { class: "gtl-error" }, [`Timeline unavailable: ${err.message}`]));
    }
  }

  // ── Toolbar (CP2) ─────────────────────────────────────────────────────────────

  // "Add event" button
  const addEvtBtn = el("button", { class: "btn-small gtl-add-btn" }, ["+ Add event"]);
  addEvtBtn.addEventListener("click", () => {
    openTimelineEventDialog({
      existingEvent: null,
      characterId:   null,
      appData,
      onSave:  rebuildItems,
      onClose: () => {},
    });
  });

  // "Clear filters" link
  let clearBtn = null;
  clearBtn = el("button", { class: "btn-link filter-clear-btn" }, ["Clear filters"]);
  clearBtn.style.display = isModified(state) ? "" : "none";

  // Kind toggle chips
  const KIND_LABELS = { scenes: "Scenes", events: "Events", births: "Births", deaths: "Deaths" };
  const kindBtns = ALL_KINDS.map(kind => {
    const btn = el("button", { class: "gtl-kind-toggle" }, [KIND_LABELS[kind]]);
    btn.classList.toggle("is-active", state.kinds.includes(kind));
    btn.addEventListener("click", () => {
      if (state.kinds.includes(kind)) {
        if (state.kinds.length === 1) return;
        state.kinds = state.kinds.filter(k => k !== kind);
      } else {
        state.kinds = [...state.kinds, kind];
      }
      btn.classList.toggle("is-active", state.kinds.includes(kind));
      persistState(state);
      refreshDataset();
    });
    return btn;
  });

  // Status toggle chips
  const statusBtns = ALL_STATUSES.map(status => {
    const slug = status === "In progress" ? "inprogress" : status.toLowerCase();
    const btn  = el("button", { class: `gtl-status-toggle gtl-status--${slug}` }, [status]);
    btn.classList.toggle("is-active", state.statuses.includes(status));
    btn.addEventListener("click", () => {
      if (state.statuses.includes(status)) {
        if (state.statuses.length === 1) return;
        state.statuses = state.statuses.filter(s => s !== status);
      } else {
        state.statuses = [...state.statuses, status];
      }
      btn.classList.toggle("is-active", state.statuses.includes(status));
      persistState(state);
      refreshDataset();
    });
    return btn;
  });

  // Character filter
  const charChipsEl = el("div", { class: "filter-faction-chips" });
  function renderCharChips() {
    clear(charChipsEl);
    for (const cId of state.characters) {
      const c = (appData.characters ?? []).find(x => x.id === cId);
      charChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        c ? displayName(c) : cId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.characters = state.characters.filter(id => id !== cId);
          renderCharChips(); persistState(state); refreshDataset();
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
    renderCharChips(); persistState(state); refreshDataset();
  });
  renderCharChips();

  // Faction filter
  const factionChipsEl = el("div", { class: "filter-faction-chips" });
  function renderFactionChips() {
    clear(factionChipsEl);
    for (const fId of state.factions) {
      const f    = (appData.factions ?? []).find(x => x.id === fId);
      const chip = el("span", { class: "filter-faction-active-chip" }, [
        f?.name ?? fId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.factions = state.factions.filter(id => id !== fId);
          renderFactionChips(); persistState(state); refreshDataset();
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
    renderFactionChips(); persistState(state); refreshDataset();
  });
  renderFactionChips();

  // Plotline filter
  const plotlineChipsEl = el("div", { class: "filter-faction-chips" });
  function renderPlotlineChips() {
    clear(plotlineChipsEl);
    for (const pId of state.plotlines) {
      const pl   = (appData.plotlines ?? []).find(x => x.id === pId);
      const chip = el("span", { class: "filter-faction-active-chip" }, [
        pl?.title ?? pId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          state.plotlines = state.plotlines.filter(id => id !== pId);
          renderPlotlineChips(); persistState(state); refreshDataset();
        }}, ["×"]),
      ]);
      if (pl?.color) { chip.style.background = pl.color; chip.style.color = chipTextColor(pl.color); }
      plotlineChipsEl.append(chip);
    }
  }
  const plotlineSelect = el("select", { class: "filter-faction-select" });
  plotlineSelect.append(el("option", { value: "" }, ["Filter by plotline…"]));
  for (const pl of [...(appData.plotlines ?? [])].sort((a, b) => (a.title || "").localeCompare(b.title || ""))) {
    plotlineSelect.append(el("option", { value: pl.id }, [pl.title || "(untitled)"]));
  }
  plotlineSelect.addEventListener("change", () => {
    const val = plotlineSelect.value;
    if (!val || state.plotlines.includes(val)) { plotlineSelect.value = ""; return; }
    state.plotlines = [...state.plotlines, val];
    plotlineSelect.value = "";
    renderPlotlineChips(); persistState(state); refreshDataset();
  });
  renderPlotlineChips();

  // Date range
  const dateFromInput = el("input", { type: "date", class: "gtl-date-input", title: "From date" });
  dateFromInput.value = state.dateFrom;
  dateFromInput.addEventListener("change", () => { state.dateFrom = dateFromInput.value; persistState(state); refreshDataset(); });

  const dateToInput = el("input", { type: "date", class: "gtl-date-input", title: "To date" });
  dateToInput.value = state.dateTo;
  dateToInput.addEventListener("change", () => { state.dateTo = dateToInput.value; persistState(state); refreshDataset(); });

  // Popover
  popoverEl.append(
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Character"]),
      el("div", { class: "filter-faction-wrap" }, [charSelect, charChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Faction"]),
      el("div", { class: "filter-faction-wrap" }, [factionSelect, factionChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Plotline"]),
      el("div", { class: "filter-faction-wrap" }, [plotlineSelect, plotlineChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Date range"]),
      el("div", { class: "gtl-date-range" }, [
        el("span", { class: "gtl-date-label" }, ["From"]),
        dateFromInput,
        el("span", { class: "gtl-date-label" }, ["To"]),
        dateToInput,
      ]),
    ]),
  );

  const filterByBtn = el("button", { class: "btn-small filter-by-btn" }, ["Filter by ▾"]);
  filterByBtn.addEventListener("click", () => {
    const open = popoverEl.classList.toggle("is-open");
    filterByBtn.classList.toggle("is-active", open);
    filterByBtn.textContent = open ? "Filter by ▴" : "Filter by ▾";
  });

  clearBtn.addEventListener("click", () => {
    state = defaultState();
    kindBtns.forEach((btn, i) => btn.classList.toggle("is-active", state.kinds.includes(ALL_KINDS[i])));
    statusBtns.forEach((btn, i) => btn.classList.toggle("is-active", state.statuses.includes(ALL_STATUSES[i])));
    charSelect.value = ""; factionSelect.value = ""; plotlineSelect.value = "";
    dateFromInput.value = ""; dateToInput.value = "";
    renderCharChips(); renderFactionChips(); renderPlotlineChips();
    try { localStorage.removeItem(PERSIST_KEY); } catch {}
    refreshDataset();
  });

  // Fill toolbar
  toolbarEl.append(
    el("div", { class: "gtl-toolbar-left" }, [
      el("div", { class: "gtl-kind-toggles" }, kindBtns),
      el("div", { class: "gtl-status-toggles" }, statusBtns),
      clearBtn,
      filterByBtn,
    ]),
    el("div", { class: "gtl-toolbar-right" }, [addEvtBtn]),
  );
}
