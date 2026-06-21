import { el, clear } from "../dom.js";
import { displayName, anomalyOverallClass } from "../schema.js";
import { formatFlexibleDate } from "../dates.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { openTimelineEventDialog } from "./timeline-event-dialog.js";
import { openTimelineItemPanel } from "./timeline-item-panel.js";
import {
  ALL_TIMELINE_KINDS, SYMBOLS, getTypeSettings, itemContent,
} from "../util/timeline-settings.js";

export const ALL_KINDS = ALL_TIMELINE_KINDS;

const KIND_LABELS = {
  scenes: "Scenes", events: "Events", births: "Births",
  deaths: "Deaths", anomalies: "Anomalies",
};

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
    type:      "box",
    className: "gtl-item-base",
    style:     "",
    group:     item.kind,
  };
}

// ── Item collection ───────────────────────────────────────────────────────────

function buildAllItems(appData) {
  const items = [];
  const ts    = getTypeSettings(appData);

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
    const color  = sc.color  || ts.scenes.color;
    const symbol = sc.symbol || ts.scenes.symbol;
    const charIds   = (sc.characters ?? []).map(r => r.characterId);
    const charNames = charIds.slice(0, 3).map(cId => {
      const c = (appData.characters ?? []).find(x => x.id === cId);
      return c ? displayName(c) : null;
    }).filter(Boolean);
    items.push({
      id:           `scene:${sc.id}`,
      label:        sc.title || "(untitled scene)",
      content:      itemContent(symbol, color, sc.title || "(untitled scene)"),
      tooltip:      [
        `<b>${sc.title || "(untitled scene)"}</b>`,
        formatFlexibleDate(sc.sceneDate),
        sc.status,
        charNames.length ? charNames.join(", ") : null,
      ].filter(Boolean).join("<br>"),
      start:        d,
      dateRaw:      sc.sceneDate,
      kind:         "scenes",
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
    const color  = ev.color || ts.events.color;
    const symbol = ev.symbol || ts.events.symbol;
    const charNames = (ev.characterIds ?? []).slice(0, 3).map(cId => {
      const c = (appData.characters ?? []).find(x => x.id === cId);
      return c ? displayName(c) : null;
    }).filter(Boolean);
    items.push({
      id:           `event:${ev.id}`,
      label:        ev.title || "(untitled event)",
      content:      itemContent(symbol, color, ev.title || "(untitled event)"),
      tooltip:      [
        `<b>${ev.title || "(untitled event)"}</b>`,
        ev.date ? formatFlexibleDate(ev.date) : null,
        charNames.length ? charNames.join(", ") : null,
      ].filter(Boolean).join("<br>"),
      start:        d,
      dateRaw:      ev.date,
      kind:         "events",
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
    const color  = ch.birthColor  || ts.births.color;
    const symbol = ch.birthSymbol || ts.births.symbol;
    items.push({
      id:           `birth:${ch.id}`,
      label:        `${displayName(ch)} born`,
      content:      itemContent(symbol, color, `${displayName(ch)} born`),
      tooltip:      `<b>${displayName(ch)}</b><br>${formatFlexibleDate(ch.birthday)}<br>Born`,
      start:        d,
      dateRaw:      ch.birthday,
      kind:         "births",
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
    const color  = ch.deathColor  || ts.deaths.color;
    const symbol = ch.deathSymbol || ts.deaths.symbol;
    items.push({
      id:           `death:${ch.id}`,
      label:        `${displayName(ch)} died`,
      content:      itemContent(symbol, color, `${displayName(ch)} died`),
      tooltip:      `<b>${displayName(ch)}</b><br>${formatFlexibleDate(ch.deathDate)}<br>Died`,
      start:        d,
      dateRaw:      ch.deathDate,
      kind:         "deaths",
      characterId:  ch.id,
      characterIds: [ch.id],
      factionIds:   effectiveFactions([ch.id], []),
      plotlineIds:  [],
    });
  }

  // Anomalies
  for (const a of appData.anomalies ?? []) {
    if (a.archived) continue;
    const color  = a.color  || ts.anomalies.color;
    const symbol = a.symbol || ts.anomalies.symbol;
    const aCharIds = a.characterIds ?? [];
    const aPl      = a.plotlineIds  ?? [];
    const overall  = anomalyOverallClass(a);

    if (a.discoveryDate) {
      const d = toJsDate(a.discoveryDate);
      if (d) {
        items.push({
          id:           `anomaly:${a.id}`,
          label:        a.title || "(unnamed anomaly)",
          content:      itemContent(symbol, color, a.title || "(unnamed anomaly)"),
          tooltip:      [
            `<b>${a.title || "(unnamed anomaly)"}</b>`,
            `Discovered: ${formatFlexibleDate(a.discoveryDate)}`,
            overall ? `Class ${overall}` : null,
            a.status || null,
          ].filter(Boolean).join("<br>"),
          start:        d,
          dateRaw:      a.discoveryDate,
          kind:         "anomalies",
          anomalyId:    a.id,
          characterIds: aCharIds,
          factionIds:   effectiveFactions(aCharIds, []),
          plotlineIds:  aPl,
        });
      }
    }

    for (const obs of a.observations ?? []) {
      if (!obs.date) continue;
      const d = toJsDate(obs.date);
      if (!d) continue;
      items.push({
        id:           `anomaly-obs:${a.id}:${obs.id}`,
        label:        `${a.title || "(unnamed)"}: ${obs.title || "(observation)"}`,
        content:      itemContent(symbol, color, `${a.title || "(unnamed)"}: ${obs.title || "(observation)"}`),
        tooltip:      [
          `<b>${a.title || "(unnamed)"}</b>`,
          obs.date ? formatFlexibleDate(obs.date) : null,
          obs.title || null,
          obs.body  || null,
        ].filter(Boolean).join("<br>"),
        start:        d,
        dateRaw:      obs.date,
        kind:         "anomalies",
        anomalyId:    a.id,
        characterIds: aCharIds,
        factionIds:   effectiveFactions(aCharIds, []),
        plotlineIds:  aPl,
      });
    }
  }

  return items;
}

// ── State ─────────────────────────────────────────────────────────────────────

const PERSIST_KEY = "global-timeline";

export function defaultState() {
  return {
    kinds:      [...ALL_KINDS],
    characters: [],
    factions:   [],
    plotlines:  [],
    dateFrom:   "",
    dateTo:     "",
    collapsed:  [],
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if (s) {
      return {
        kinds:      Array.isArray(s.kinds)      ? s.kinds      : [...ALL_KINDS],
        characters: Array.isArray(s.characters) ? s.characters : [],
        factions:   Array.isArray(s.factions)   ? s.factions   : [],
        plotlines:  Array.isArray(s.plotlines)  ? s.plotlines  : [],
        dateFrom:   s.dateFrom  ?? "",
        dateTo:     s.dateTo    ?? "",
        collapsed:  Array.isArray(s.collapsed)  ? s.collapsed  : [],
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
  return state.kinds.length    < def.kinds.length
    || state.characters.length > 0
    || state.factions.length   > 0
    || state.plotlines.length  > 0
    || state.dateFrom          !== ""
    || state.dateTo            !== "";
}

function applyFilters(items, state) {
  const collapsedSet = new Set(state.collapsed);
  let r = items;
  if (state.kinds.length < ALL_KINDS.length) r = r.filter(i => state.kinds.includes(i.kind));
  r = r.filter(i => !collapsedSet.has(i.kind));
  if (state.characters.length) r = r.filter(i => state.characters.some(c => i.characterIds.includes(c)));
  if (state.factions.length)   r = r.filter(i => state.factions.some(f => i.factionIds.includes(f)));
  if (state.plotlines.length)  r = r.filter(i => state.plotlines.some(p => i.plotlineIds.includes(p)));
  if (state.dateFrom) { const d = toJsDate(state.dateFrom); if (d) r = r.filter(i => i.start >= d); }
  if (state.dateTo)   { const d = toJsDate(state.dateTo);   if (d) r = r.filter(i => i.start <= d); }
  return r;
}

// List version: same but ignores collapsed (list always shows all enabled types)
function applyListFilters(items, state) {
  let r = items;
  if (state.kinds.length < ALL_KINDS.length) r = r.filter(i => state.kinds.includes(i.kind));
  if (state.characters.length) r = r.filter(i => state.characters.some(c => i.characterIds.includes(c)));
  if (state.factions.length)   r = r.filter(i => state.factions.some(f => i.factionIds.includes(f)));
  if (state.plotlines.length)  r = r.filter(i => state.plotlines.some(p => i.plotlineIds.includes(p)));
  if (state.dateFrom) { const d = toJsDate(state.dateFrom); if (d) r = r.filter(i => i.start >= d); }
  if (state.dateTo)   { const d = toJsDate(state.dateTo);   if (d) r = r.filter(i => i.start <= d); }
  return r;
}

function groupContent(kind, isCollapsed) {
  const arrow = isCollapsed ? "▸" : "▾";
  return `<span class="gtl-grp-toggle" data-group-id="${kind}">${arrow} ${KIND_LABELS[kind]}</span>`;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export async function mountGlobalTimeline(container, appData) {
  const mainEl = document.querySelector("#main");
  mainEl.classList.add("gtl-main");

  let tlInstance = null;
  let dataset    = null;
  let groupsDS   = null;
  let allItems   = buildAllItems(appData);
  let state      = loadState();
  let listSearch = "";

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

  // ── DOM skeleton ──────────────────────────────────────────────────────────────

  const topbarEl      = el("div", { class: "gtl-topbar" });
  const visSectionEl  = el("div", { class: "gtl-vis-section" });
  const canvasEl      = el("div", { class: "gtl-canvas" });
  const sidebarEl     = el("div", { class: "gtl-sidebar" });
  const listPaneEl    = el("div", { class: "gtl-list-pane" });
  const listBodyEl    = el("div", { class: "gtl-list-body" });
  const popoverEl     = el("div", { class: "filter-popover gtl-popover" });
  const settingsPopEl = el("div", { class: "filter-popover gtl-settings-pop" });

  visSectionEl.append(canvasEl, popoverEl, settingsPopEl);
  const bottomEl = el("div", { class: "gtl-bottom" }, [sidebarEl, listPaneEl]);
  container.append(el("div", { class: "gtl-container" }, [topbarEl, visSectionEl, bottomEl]));

  // ── Vis / dataset helpers ─────────────────────────────────────────────────────

  let clearBtn = null;

  function refreshDataset() {
    if (!dataset) return;
    dataset.clear();
    dataset.add(applyFilters(allItems, state).map(toVisItem));
    if (clearBtn) clearBtn.style.display = isModified(state) ? "" : "none";
    renderEventList();
  }

  function refreshGroups() {
    if (!groupsDS) return;
    const collapsedSet = new Set(state.collapsed);
    for (const kind of ALL_KINDS) {
      groupsDS.update({
        id:      kind,
        content: groupContent(kind, collapsedSet.has(kind)),
        visible: state.kinds.includes(kind),
      });
    }
    refreshKindBtns();
  }

  function rebuildItems() {
    allItems = buildAllItems(appData);
    refreshDataset();
  }

  function toggleCollapse(kind) {
    const collapsedSet = new Set(state.collapsed);
    if (collapsedSet.has(kind)) collapsedSet.delete(kind);
    else collapsedSet.add(kind);
    state.collapsed = [...collapsedSet];
    persistState(state);
    refreshGroups();
    refreshDataset();
  }

  // ── Event list ────────────────────────────────────────────────────────────────

  function renderEventList() {
    clear(listBodyEl);
    const q = listSearch.toLowerCase().trim();
    let items = applyListFilters(allItems, state);
    if (q) items = items.filter(i => i.label.toLowerCase().includes(q));
    items = [...items].sort((a, b) => a.start - b.start);

    const ts = getTypeSettings(appData);

    if (!items.length) {
      listBodyEl.append(el("div", { class: "gtl-list-empty" }, [
        q ? "No events match your search." : "No events to show.",
      ]));
      return;
    }

    for (const item of items) {
      const typeSettings = ts[item.kind];
      const dateStr = item.dateRaw ? formatFlexibleDate(item.dateRaw) : "";

      const symEl = el("span", { class: "gtl-list-sym" }, [typeSettings.symbol]);
      symEl.style.color = typeSettings.color;

      const rowChildren = [
        symEl,
        el("span", { class: "gtl-list-title" }, [item.label]),
        el("span", { class: "gtl-list-date" }, [dateStr]),
        el("span", { class: "gtl-list-kind" }, [KIND_LABELS[item.kind]]),
      ];

      // Events get an "Edit" button that opens the edit panel.
      // Other types get a "↗" navigate button; their card opens on row click.
      if (item.kind === "events") {
        const editBtn = el("button", { class: "btn-small gtl-list-edit" }, ["Edit"]);
        editBtn.addEventListener("click", e => {
          e.stopPropagation();
          openTimelineItemPanel({
            item,
            appData,
            containerEl: listPaneEl,
            onSave:   rebuildItems,
            onDelete: rebuildItems,
          });
        });
        rowChildren.push(editBtn);
      } else {
        let navRoute = null;
        if (item.kind === "scenes")                                 navRoute = `scenes/${item.sceneId}`;
        else if (item.kind === "anomalies")                        navRoute = `anomalies/${item.anomalyId}`;
        else if (item.kind === "births" || item.kind === "deaths") navRoute = `characters/${item.characterId}`;
        if (navRoute) {
          const navBtn = el("button", { class: "btn-small gtl-list-nav" }, ["↗"]);
          navBtn.title = "Open page";
          navBtn.addEventListener("click", e => {
            e.stopPropagation();
            navigate(navRoute);
          });
          rowChildren.push(navBtn);
        }
      }

      const row = el("div", { class: "gtl-list-row" }, rowChildren);
      row.addEventListener("click", () => {
        // Zoom the timeline to this item
        if (tlInstance) {
          if (!state.kinds.includes(item.kind)) {
            state.kinds = [...state.kinds, item.kind];
            persistState(state);
            refreshGroups();
            refreshDataset();
          }
          const DAY = 24 * 60 * 60 * 1000;
          tlInstance.setWindow(
            new Date(item.start.getTime() - 45 * DAY),
            new Date(item.start.getTime() + 45 * DAY),
            { animation: { duration: 400, easingFunction: "easeInOutQuad" } },
          );
        }
        // Also open the card panel for non-event items (events use the Edit button)
        if (item.kind !== "events") {
          openTimelineItemPanel({
            item,
            appData,
            containerEl: listPaneEl,
            onSave:   rebuildItems,
            onDelete: rebuildItems,
          });
        }
      });

      listBodyEl.append(row);
    }
  }

  // ── Time range presets ────────────────────────────────────────────────────────

  const currentDate = appData.meta?.currentDate;

  function setTimeWindow(preset) {
    if (!tlInstance) return;
    if (preset === "all") { tlInstance.fit(); return; }
    const center = currentDate ? new Date(currentDate) : new Date();
    const DAY = 24 * 60 * 60 * 1000;
    const OFFSETS = { "1M": 15, "3M": 45, "6M": 91, "1Y": 182, "5Y": 912 };
    const offset = (OFFSETS[preset] ?? 91) * DAY;
    tlInstance.setWindow(
      new Date(center.getTime() - offset),
      new Date(center.getTime() + offset),
      { animation: false },
    );
  }

  // ── Build vis-timeline ────────────────────────────────────────────────────────

  if (!allItems.length) {
    canvasEl.append(el("div", { class: "placeholder-view" }, [
      "No dated items yet. Add scene dates, character birthdays, or events to populate the timeline.",
    ]));
  } else {
    try {
      const { Timeline, DataSet } = await import("../../vendor/vis-timeline.esm.min.js");

      const collapsedSet = new Set(state.collapsed);

      groupsDS = new DataSet(ALL_KINDS.map((kind, idx) => ({
        id:      kind,
        content: groupContent(kind, collapsedSet.has(kind)),
        visible: state.kinds.includes(kind),
        order:   idx,
      })));

      dataset = new DataSet(applyFilters(allItems, state).map(toVisItem));

      tlInstance = new Timeline(canvasEl, dataset, groupsDS, {
        height:          "100%",
        stack:           true,
        editable:        { add: false, updateTime: false, updateGroup: false, remove: false },
        zoomable:        true,
        moveable:        true,
        showCurrentTime: false,
        selectable:      true,
        groupOrder:      "order",
      });

      if (currentDate) {
        const center    = new Date(currentDate);
        const ninetyDay = 91 * 24 * 60 * 60 * 1000;
        tlInstance.setWindow(
          new Date(center.getTime() - ninetyDay),
          new Date(center.getTime() + ninetyDay),
        );
        try { tlInstance.addCustomTime(center, "now"); } catch (_) {}
      }

      // Capture phase fires before vis-timeline's own bubble-phase handlers,
      // ensuring our collapse toggle always fires even if vis stops propagation.
      canvasEl.addEventListener("click", e => {
        const toggle = e.target.closest("[data-group-id]");
        if (!toggle) return;
        toggleCollapse(toggle.dataset.groupId);
      }, true);

      tlInstance.on("click", props => {
        if (!props.item) return;
        const raw  = String(props.item);
        const item = allItems.find(i => String(i.id) === raw);
        if (!item) return;
        openTimelineItemPanel({
          item,
          appData,
          containerEl: listPaneEl,
          onSave:   rebuildItems,
          onDelete: rebuildItems,
        });
      });
    } catch (err) {
      canvasEl.append(el("p", { class: "gtl-error" }, [`Timeline unavailable: ${err.message}`]));
    }
  }

  // ── Type settings popover ─────────────────────────────────────────────────────

  function renderSettingsPop() {
    clear(settingsPopEl);
    const ts = getTypeSettings(appData);
    settingsPopEl.append(el("div", { class: "gtl-settings-header" }, ["Event type appearance"]));

    for (const kind of ALL_KINDS) {
      const { color, symbol } = ts[kind];

      const colorInput = el("input", { type: "color", class: "gtl-type-color", value: color });
      colorInput.addEventListener("change", () => {
        appData.meta.timelineTypeSettings ??= {};
        appData.meta.timelineTypeSettings[kind] = {
          ...(appData.meta.timelineTypeSettings[kind] ?? {}),
          color: colorInput.value,
        };
        save("meta", appData.meta);
        rebuildItems();
        refreshKindBtns();
      });

      const symbolSel = el("select", { class: "gtl-type-symbol sheet-input" });
      for (const sym of SYMBOLS) {
        const opt = el("option", { value: sym.value }, [sym.label]);
        if (sym.value === symbol) opt.selected = true;
        symbolSel.append(opt);
      }
      symbolSel.addEventListener("change", () => {
        appData.meta.timelineTypeSettings ??= {};
        appData.meta.timelineTypeSettings[kind] = {
          ...(appData.meta.timelineTypeSettings[kind] ?? {}),
          symbol: symbolSel.value,
        };
        save("meta", appData.meta);
        rebuildItems();
        refreshKindBtns();
      });

      settingsPopEl.append(el("div", { class: "gtl-type-row" }, [
        el("span", { class: "gtl-type-name" }, [KIND_LABELS[kind]]),
        colorInput,
        symbolSel,
      ]));
    }

    const resetBtn = el("button", { class: "btn-small gtl-type-reset" }, ["Reset defaults"]);
    resetBtn.addEventListener("click", () => {
      appData.meta.timelineTypeSettings = {};
      save("meta", appData.meta);
      rebuildItems();
      renderSettingsPop();
      refreshKindBtns();
    });
    settingsPopEl.append(resetBtn);
  }

  // ── Filter popover ────────────────────────────────────────────────────────────

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

  const dateFromInput = el("input", { type: "date", class: "gtl-date-input", title: "From date" });
  dateFromInput.value = state.dateFrom;
  dateFromInput.addEventListener("change", () => {
    state.dateFrom = dateFromInput.value;
    persistState(state); refreshDataset();
  });

  const dateToInput = el("input", { type: "date", class: "gtl-date-input", title: "To date" });
  dateToInput.value = state.dateTo;
  dateToInput.addEventListener("change", () => {
    state.dateTo = dateToInput.value;
    persistState(state); refreshDataset();
  });

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

  // ── Sidebar ───────────────────────────────────────────────────────────────────

  const kindBtnMap = {};

  function refreshKindBtns() {
    const ts = getTypeSettings(appData);
    for (const kind of ALL_KINDS) {
      const btn = kindBtnMap[kind];
      if (!btn) continue;
      const { color, symbol } = ts[kind];
      const isActive = state.kinds.includes(kind);
      btn.className = "gtl-kind-toggle" + (isActive ? " is-active" : "");
      btn.style.background  = isActive ? color : "";
      btn.style.borderColor = isActive ? color : "";
      btn.style.color       = isActive ? chipTextColor(color) : "";
      const symEl = btn.querySelector(".gtl-kind-sym");
      if (symEl) symEl.style.color = isActive ? chipTextColor(color) : color;
      const lblEl = btn.querySelector(".gtl-kind-label");
      if (lblEl) lblEl.textContent = symbol + " " + KIND_LABELS[kind];
    }
  }

  const kindListEl = el("div", { class: "gtl-kind-list" });
  for (const kind of ALL_KINDS) {
    const ts = getTypeSettings(appData);
    const { color, symbol } = ts[kind];
    const isActive = state.kinds.includes(kind);
    const btn = el("button", { class: "gtl-kind-toggle" + (isActive ? " is-active" : "") }, [
      el("span", { class: "gtl-kind-sym" }, [""]),
      el("span", { class: "gtl-kind-label" }, [symbol + " " + KIND_LABELS[kind]]),
    ]);
    if (isActive) {
      btn.style.background  = color;
      btn.style.borderColor = color;
      btn.style.color       = chipTextColor(color);
    }
    const symEl = btn.querySelector(".gtl-kind-sym");
    symEl.style.color = isActive ? chipTextColor(color) : color;

    btn.addEventListener("click", () => {
      if (state.kinds.includes(kind)) {
        if (state.kinds.length === 1) return;
        state.kinds = state.kinds.filter(k => k !== kind);
      } else {
        state.kinds = [...state.kinds, kind];
      }
      persistState(state);
      refreshGroups();
      refreshDataset();
    });
    kindBtnMap[kind] = btn;
    kindListEl.append(btn);
  }

  const addEvtBtn = el("button", { class: "btn-primary gtl-sidebar-add" }, ["+ Add Event"]);
  addEvtBtn.addEventListener("click", () => {
    openTimelineEventDialog({
      existingEvent: null,
      characterId:   null,
      appData,
      onSave:  rebuildItems,
      onClose: () => {},
    });
  });

  const settingsBtn = el("button", { class: "btn-small gtl-settings-btn" }, ["⚙ Types"]);
  settingsBtn.addEventListener("click", () => {
    popoverEl.classList.remove("is-open");
    filterByBtn.classList.remove("is-active");
    filterByBtn.textContent = "Filter ▾";
    const open = settingsPopEl.classList.toggle("is-open");
    settingsBtn.classList.toggle("is-active", open);
    if (open) renderSettingsPop();
  });

  sidebarEl.append(
    addEvtBtn,
    settingsBtn,
    el("div", { class: "gtl-sidebar-divider" }),
    el("div", { class: "gtl-sidebar-label" }, ["Show / Hide"]),
    kindListEl,
  );

  // ── Topbar ────────────────────────────────────────────────────────────────────

  const PRESETS = ["1M", "3M", "6M", "1Y", "5Y", "All"];
  const presetBtns = PRESETS.map((p, pi) => {
    const btn = el("button", {
      class: "gtl-preset-btn" + (pi === 2 ? " is-active" : ""),
      title: p === "All" ? "Fit all events" : `Show ±${p} from current date`,
    }, [p]);
    btn.addEventListener("click", () => {
      presetBtns.forEach((b, i) => b.classList.toggle("is-active", i === pi));
      setTimeWindow(p === "All" ? "all" : p);
    });
    return btn;
  });

  clearBtn = el("button", { class: "btn-link filter-clear-btn" }, ["Clear filters"]);
  clearBtn.style.display = isModified(state) ? "" : "none";

  const filterByBtn = el("button", { class: "btn-small filter-by-btn" }, ["Filter ▾"]);
  filterByBtn.addEventListener("click", () => {
    settingsPopEl.classList.remove("is-open");
    settingsBtn.classList.remove("is-active");
    const open = popoverEl.classList.toggle("is-open");
    filterByBtn.classList.toggle("is-active", open);
    filterByBtn.textContent = open ? "Filter ▴" : "Filter ▾";
  });

  clearBtn.addEventListener("click", () => {
    state = defaultState();
    persistState(state);
    charSelect.value = ""; factionSelect.value = ""; plotlineSelect.value = "";
    dateFromInput.value = ""; dateToInput.value = "";
    renderCharChips(); renderFactionChips(); renderPlotlineChips();
    refreshGroups();
    refreshDataset();
  });

  topbarEl.append(
    el("div", { class: "gtl-topbar-left" }, [
      el("div", { class: "gtl-presets" }, presetBtns),
    ]),
    el("div", { class: "gtl-topbar-right" }, [filterByBtn, clearBtn]),
  );

  // ── List pane ─────────────────────────────────────────────────────────────────

  const searchInput = el("input", {
    type:        "text",
    class:       "gtl-list-search",
    placeholder: "Search events…",
  });
  searchInput.addEventListener("input", () => {
    listSearch = searchInput.value;
    renderEventList();
  });

  listPaneEl.append(
    el("div", { class: "gtl-list-searchbar" }, [searchInput]),
    listBodyEl,
  );

  renderEventList();
}
