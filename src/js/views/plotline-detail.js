import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { navigate } from "../router.js";
import { displayName } from "../schema.js";
import { formatFlexibleDate, parseFlexibleDate, flexibleDateSortKey } from "../dates.js";
import { createCombobox } from "../components/combobox.js";

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

function autoresize(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

function sectionLabel(text) {
  return el("div", { class: "pl-label" }, [text]);
}

function makeTextarea(cls, rows, placeholder, value, onChange) {
  const ta = el("textarea", { class: cls, rows: String(rows), placeholder });
  ta.value = value ?? "";
  ta.addEventListener("input", () => { autoresize(ta); onChange(ta.value); });
  return ta;
}

function parseDateInput(monthVal, dayVal) {
  if (!monthVal) return null;
  if (dayVal && dayVal !== "0") return `${monthVal}-${String(dayVal).padStart(2, "0")}`;
  return monthVal;
}

function makeDateInputs(existingDate) {
  const parsed = parseFlexibleDate(existingDate);
  const monthInput = el("input", { type: "month", class: "pl-month-input" });
  if (parsed) monthInput.value = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;

  const daySelect = el("select", { class: "pl-day-select" });
  daySelect.append(el("option", { value: "0" }, ["—"]));
  for (let d = 1; d <= 31; d++) {
    const opt = el("option", { value: String(d) }, [String(d)]);
    if (parsed?.day === d) opt.selected = true;
    daySelect.append(opt);
  }
  return { monthInput, daySelect, getValue: () => parseDateInput(monthInput.value, daySelect.value) };
}

// ── Item sort helpers ──────────────────────────────────────────────────────

function itemSortKey(item, scenes) {
  if (item.kind === "scene") {
    const s = (scenes ?? []).find(x => x.id === item.sceneId);
    return flexibleDateSortKey(s?.sceneDate) || s?.createdAt?.slice(0, 10) || "";
  }
  return flexibleDateSortKey(item.date) || "";
}

function sortItems(items, scenes) {
  return [...(items ?? [])].sort((a, b) => {
    const ka = itemSortKey(a, scenes);
    const kb = itemSortKey(b, scenes);
    if (!ka && !kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    return ka.localeCompare(kb);
  });
}

// ── Main export ────────────────────────────────────────────────────────────

export function mountPlotlineDetail(container, appData, pl, { onUpdate, onDelete }) {
  const persist = debounce(async () => {
    pl.updatedAt = new Date().toISOString();
    await save("plotlines", appData.plotlines);
    onUpdate();
  }, 400);

  async function persistNow() {
    pl.updatedAt = new Date().toISOString();
    await save("plotlines", appData.plotlines);
    onUpdate();
  }

  // ── Header row: title + color + secret ──
  const titleInput = el("input", { type: "text", class: "pl-title-input", placeholder: "Plotline title…" });
  titleInput.value = pl.title ?? "";
  titleInput.addEventListener("input", () => { pl.title = titleInput.value; persist(); });

  const colorInput = el("input", { type: "color", class: "pl-color-input", title: "Plotline color" });
  colorInput.value = pl.color ?? "#4a6b8a";
  colorInput.addEventListener("input", () => {
    pl.color = colorInput.value;
    accentLine.style.background = pl.color;
    persist();
  });

  const secretCheck = el("input", { type: "checkbox", id: `pl-secret-${pl.id}`, class: "pl-secret-check" });
  secretCheck.checked = !!pl.isSecret;
  secretCheck.addEventListener("change", () => { pl.isSecret = secretCheck.checked; persistNow(); });

  const accentLine = el("div", { class: "pl-accent-line" });
  accentLine.style.background = pl.color ?? "#4a6b8a";

  // ── Body fields ──
  const summaryTa = makeTextarea("pl-textarea pl-textarea--summary", 2, "Brief summary…", pl.summary, v => { pl.summary = v; persist(); });
  const bodyTa    = makeTextarea("pl-textarea pl-textarea--body", 8, "Notes, background, details…", pl.body, v => { pl.body = v; persist(); });
  const notesTa   = makeTextarea("pl-textarea", 3, "Notes…", pl.notes, v => { pl.notes = v; persist(); });

  // ── Character chips ──
  const charSectionEl = el("div", { class: "pl-chips-section" });

  function renderCharSection() {
    clear(charSectionEl);
    const chips = el("div", { class: "pl-chips" });
    for (const cId of pl.characterIds ?? []) {
      const c = appData.characters.find(x => x.id === cId);
      chips.append(el("span", { class: "pl-chip" }, [
        c ? displayName(c) : cId,
        el("button", { class: "pl-chip-remove", onclick: () => {
          pl.characterIds = pl.characterIds.filter(id => id !== cId);
          persistNow().then(renderCharSection);
        }}, ["×"]),
      ]));
    }

    const remaining = (appData.characters ?? [])
      .filter(c => !(pl.characterIds ?? []).includes(c.id))
      .map(c => {
        const dn  = displayName(c);
        const aka = c.aliases?.[0] && c.aliases[0] !== dn ? ` (${c.aliases[0]})` : "";
        return { value: c.id, label: dn + aka };
      });

    let pendingId = "";
    const cb = createCombobox({ items: remaining, value: "", placeholder: "Add character…", onChange: v => { pendingId = v; } });
    const addBtn = el("button", { class: "btn-small", onclick: () => {
      if (!pendingId || (pl.characterIds ?? []).includes(pendingId)) return;
      pl.characterIds = [...(pl.characterIds ?? []), pendingId];
      pendingId = "";
      persistNow().then(renderCharSection);
    }}, ["Add"]);

    charSectionEl.append(
      sectionLabel("Characters"),
      el("div", { class: "pl-add-row" }, [cb, addBtn]),
      chips,
    );
  }

  // ── Faction chips ──
  const factionSectionEl = el("div", { class: "pl-chips-section" });

  function renderFactionSection() {
    clear(factionSectionEl);
    const chips = el("div", { class: "pl-chips" });
    for (const fId of pl.factionIds ?? []) {
      const f = appData.factions.find(x => x.id === fId);
      const chip = el("span", { class: "pl-chip" }, [
        f ? f.name : fId,
        el("button", { class: "pl-chip-remove", onclick: () => {
          pl.factionIds = pl.factionIds.filter(id => id !== fId);
          persistNow().then(renderFactionSection);
        }}, ["×"]),
      ]);
      if (f?.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
      chips.append(chip);
    }

    const remaining = (appData.factions ?? [])
      .filter(f => !(pl.factionIds ?? []).includes(f.id))
      .map(f => ({ value: f.id, label: f.name }));

    let pendingId = "";
    const cb = createCombobox({ items: remaining, value: "", placeholder: "Add faction…", onChange: v => { pendingId = v; } });
    const addBtn = el("button", { class: "btn-small", onclick: () => {
      if (!pendingId || (pl.factionIds ?? []).includes(pendingId)) return;
      pl.factionIds = [...(pl.factionIds ?? []), pendingId];
      pendingId = "";
      persistNow().then(renderFactionSection);
    }}, ["Add"]);

    factionSectionEl.append(
      sectionLabel("Factions"),
      el("div", { class: "pl-add-row" }, [cb, addBtn]),
      chips,
    );
  }

  // ── Items section ──────────────────────────────────────────────────────

  const itemsEl   = el("div", { class: "pl-items" });
  let showAddEvent = false;

  function renderItemRow(item) {
    if (item.kind === "scene") {
      return renderSceneItemRow(item);
    }
    return renderEventItemRow(item);
  }

  function renderSceneItemRow(item) {
    const scene   = (appData.scenes ?? []).find(s => s.id === item.sceneId);
    const title   = scene ? (scene.title || "Untitled") : "(deleted scene)";
    const dateStr = scene?.sceneDate ? formatFlexibleDate(scene.sceneDate) : null;

    const check = el("input", { type: "checkbox", class: "pl-item-check" });
    check.checked = !!item.completed;
    check.addEventListener("change", () => { item.completed = check.checked; persistNow(); });

    const link = scene
      ? el("a", { class: "pl-item-title pl-item-title--link", href: `#/scenes/${scene.id}` }, [title])
      : el("span", { class: "pl-item-title pl-item-title--missing" }, [title]);

    const removeBtn = el("button", { class: "pl-item-remove", onclick: () => {
      pl.items = pl.items.filter(i => i.id !== item.id);
      persistNow().then(renderItems);
    }}, ["×"]);

    return el("div", { class: "pl-item-row" + (item.completed ? " pl-item-row--done" : "") }, [
      check,
      el("span", { class: "pl-item-kind" }, ["S"]),
      link,
      dateStr ? el("span", { class: "pl-item-date" }, [dateStr]) : null,
      removeBtn,
    ].filter(Boolean));
  }

  function renderEventItemRow(item, editing = false) {
    if (editing) {
      return renderEventEditForm(item);
    }

    const check = el("input", { type: "checkbox", class: "pl-item-check" });
    check.checked = !!item.completed;
    check.addEventListener("change", () => { item.completed = check.checked; persistNow(); });

    const dateStr = item.date ? formatFlexibleDate(item.date) : null;

    const editBtn = el("button", { class: "btn-small", onclick: () => {
      const rowEl = editBtn.closest(".pl-item-row");
      rowEl.replaceWith(renderEventEditForm(item));
    }}, ["Edit"]);

    const removeBtn = el("button", { class: "pl-item-remove", onclick: () => {
      pl.items = pl.items.filter(i => i.id !== item.id);
      persistNow().then(renderItems);
    }}, ["×"]);

    return el("div", { class: "pl-item-row" + (item.completed ? " pl-item-row--done" : "") }, [
      check,
      el("span", { class: "pl-item-kind" }, ["E"]),
      el("span", { class: "pl-item-title" }, [item.title || "(untitled event)"]),
      dateStr ? el("span", { class: "pl-item-date" }, [dateStr]) : null,
      editBtn,
      removeBtn,
    ].filter(Boolean));
  }

  function renderEventEditForm(item) {
    const titleInput = el("input", { type: "text", class: "pl-event-title-input", placeholder: "Event title…" });
    titleInput.value = item.title ?? "";

    const { monthInput, daySelect, getValue: getDate } = makeDateInputs(item.date);
    const bodyTa = el("textarea", { class: "pl-textarea pl-event-body", rows: "2", placeholder: "Details…" });
    bodyTa.value = item.body ?? "";

    const saveBtn = el("button", { class: "btn-small", onclick: () => {
      item.title = titleInput.value.trim();
      item.date  = getDate();
      item.body  = bodyTa.value.trim();
      persistNow().then(renderItems);
    }}, ["Save"]);
    const cancelBtn = el("button", { class: "btn-small", onclick: () => renderItems() }, ["Cancel"]);

    return el("div", { class: "pl-event-edit-form" }, [
      el("div", { class: "pl-event-edit-row" }, [
        titleInput,
        el("div", { class: "pl-date-inputs" }, [monthInput, daySelect]),
        saveBtn,
        cancelBtn,
      ]),
      bodyTa,
    ]);
  }

  function renderAddEventForm() {
    const titleInput = el("input", { type: "text", class: "pl-event-title-input", placeholder: "Event title…" });
    const { monthInput, daySelect, getValue: getDate } = makeDateInputs(null);
    const bodyTa = el("textarea", { class: "pl-textarea pl-event-body", rows: "2", placeholder: "Details…" });

    const addBtn = el("button", { class: "btn-small", onclick: () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      pl.items.push({
        id: crypto.randomUUID(),
        kind: "event",
        title,
        body: bodyTa.value.trim(),
        date: getDate(),
        completed: false,
      });
      showAddEvent = false;
      persistNow().then(renderItems);
    }}, ["Add"]);
    const cancelBtn = el("button", { class: "btn-small", onclick: () => {
      showAddEvent = false;
      renderItems();
    }}, ["Cancel"]);

    return el("div", { class: "pl-event-edit-form" }, [
      el("div", { class: "pl-event-edit-row" }, [
        titleInput,
        el("div", { class: "pl-date-inputs" }, [monthInput, daySelect]),
        addBtn,
        cancelBtn,
      ]),
      bodyTa,
    ]);
  }

  function renderItems() {
    clear(itemsEl);

    const sorted = sortItems(pl.items, appData.scenes);

    if (sorted.length) {
      const list = el("div", { class: "pl-items-list" });
      for (const item of sorted) list.append(renderItemRow(item));
      itemsEl.append(list);
    } else {
      itemsEl.append(el("p", { class: "pl-empty-note" }, ["No items yet."]));
    }

    // ── Add scene row ──
    const sceneAlready = new Set((pl.items ?? []).filter(i => i.kind === "scene").map(i => i.sceneId));
    const availableScenes = (appData.scenes ?? [])
      .filter(s => !sceneAlready.has(s.id))
      .map(s => ({ value: s.id, label: s.title || "Untitled" }));

    let pendingSceneId = "";
    const sceneCb = createCombobox({
      items: availableScenes,
      value: "",
      placeholder: "Add scene…",
      onChange: v => { pendingSceneId = v; },
    });
    const addSceneBtn = el("button", { class: "btn-small", onclick: () => {
      if (!pendingSceneId) return;
      pl.items.push({ id: crypto.randomUUID(), kind: "scene", sceneId: pendingSceneId, completed: false });
      pendingSceneId = "";
      persistNow().then(renderItems);
    }}, ["Add"]);

    const addEventBtn = el("button", { class: "btn-small", onclick: () => {
      showAddEvent = true;
      renderItems();
    }}, ["+ Add event"]);

    itemsEl.append(
      el("div", { class: "pl-add-controls" }, [
        el("div", { class: "pl-add-row" }, [sceneCb, addSceneBtn]),
        showAddEvent ? renderAddEventForm() : addEventBtn,
      ]),
    );
  }

  // ── Delete ──
  let deleteConfirm = false;
  const deleteBtn = el("button", { class: "btn-danger" }, ["Delete plotline"]);
  deleteBtn.addEventListener("click", async () => {
    if (!deleteConfirm) {
      deleteBtn.textContent = "Confirm delete";
      deleteConfirm = true;
      return;
    }
    appData.plotlines = appData.plotlines.filter(p => p.id !== pl.id);
    await save("plotlines", appData.plotlines);
    onDelete();
  });

  // Initial renders
  renderCharSection();
  renderFactionSection();
  renderItems();

  container.append(
    el("div", { class: "pl-detail" }, [
      accentLine,
      el("div", { class: "pl-detail-header" }, [
        titleInput,
        el("div", { class: "pl-detail-header-controls" }, [
          colorInput,
          el("label", { class: "pl-secret-label" }, [secretCheck, "Secret"]),
        ]),
      ]),
      el("div", { class: "pl-section" }, [sectionLabel("Summary"), summaryTa]),
      el("div", { class: "pl-section" }, [sectionLabel("Body"), bodyTa]),
      charSectionEl,
      factionSectionEl,
      el("div", { class: "pl-section" }, [sectionLabel("Items"), itemsEl]),
      el("div", { class: "pl-section" }, [sectionLabel("Notes"), notesTa]),
      el("div", { class: "pl-delete-row" }, [deleteBtn]),
    ]),
  );

  for (const ta of [summaryTa, bodyTa, notesTa]) autoresize(ta);
}
