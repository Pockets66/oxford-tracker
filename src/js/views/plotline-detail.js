import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { navigate } from "../router.js";
import { displayName, createScene, createCharacter, createFaction } from "../schema.js";
import { openInlineCreateDialog } from "../components/inline-create-dialog.js";
import { formatFlexibleDate, parseFlexibleDate } from "../dates.js";
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

// ── Item helpers ───────────────────────────────────────────────────────────

function escapeHtml(s) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function itemEffectiveParsedDate(item, scenes) {
  if (item.kind === "scene") {
    const s = (scenes ?? []).find(x => x.id === item.sceneId);
    return s?.sceneDate ? parseFlexibleDate(s.sceneDate) : null;
  }
  return item.date ? parseFlexibleDate(item.date) : null;
}

function itemDisplayTitle(item, scenes) {
  if (item.kind === "scene") {
    const s = (scenes ?? []).find(x => x.id === item.sceneId);
    return s?.title || "Untitled scene";
  }
  return item.title || "Untitled event";
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

  let timelineTeardown = null;

  // ── Progress indicator ─────────────────────────────────────────────────────

  const progressEl = el("div", { class: "pl-progress-section" });

  function renderProgress() {
    clear(progressEl);
    const total = (pl.items ?? []).length;
    if (!total) return;
    const done = (pl.items ?? []).filter(i => i.completed).length;
    const pct  = Math.round((done / total) * 100);
    progressEl.append(
      el("p", { class: "pl-progress-label" }, [
        `${done} of ${total} item${total !== 1 ? "s" : ""} complete`,
      ]),
      el("div", { class: "pl-progress-bar-wrap" }, [
        el("div", {
          class: "pl-progress-bar-fill",
          style: `width: ${pct}%; background: ${pl.color ?? "#4a6b8a"};`,
        }),
      ]),
    );
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
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const remainingWithNew = [{ value: "__add_new__", label: "+ Add new character" }, ...remaining];

    let pendingId = "";
    const cb = createCombobox({
      items: remainingWithNew,
      value: "",
      placeholder: "Add character…",
      presorted: true,
      onChange: v => {
        if (v === "__add_new__") {
          pendingId = "";
          openInlineCreateDialog({
            title: "Create new character",
            fields: [
              { name: "firstName", label: "First name", type: "text", required: true, autofocus: true },
              { name: "lastName",  label: "Last name",  type: "text", required: false },
              { name: "owner",     label: "Owner",      type: "select",
                options: ["NPC", "Bree", "Jack", "Nicole", "Caiden"], default: "NPC" },
            ],
            onSubmit: async (values) => {
              const newChar = createCharacter();
              newChar.firstName = values.firstName;
              newChar.lastName  = values.lastName;
              newChar.owner     = values.owner;
              appData.characters.push(newChar);
              await save("characters", appData.characters);
              pl.characterIds = [...(pl.characterIds ?? []), newChar.id];
              await persistNow();
              renderCharSection();
            },
          });
          return;
        }
        pendingId = v;
      },
    });
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
      .map(f => ({ value: f.id, label: f.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const remainingWithNew = [{ value: "__add_new__", label: "+ Add new faction" }, ...remaining];

    let pendingId = "";
    const cb = createCombobox({
      items: remainingWithNew,
      value: "",
      placeholder: "Add faction…",
      presorted: true,
      onChange: v => {
        if (v === "__add_new__") {
          pendingId = "";
          openInlineCreateDialog({
            title: "Create new faction",
            fields: [
              { name: "name", label: "Name", type: "text", required: true, autofocus: true },
            ],
            onSubmit: async (values) => {
              const newFaction = createFaction();
              newFaction.name = values.name;
              (appData.factions ?? (appData.factions = [])).push(newFaction);
              await save("factions", appData.factions);
              pl.factionIds = [...(pl.factionIds ?? []), newFaction.id];
              await persistNow();
              renderFactionSection();
            },
          });
          return;
        }
        pendingId = v;
      },
    });
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

  function renderListRow(item, idx) {
    const isFirst  = idx === 0;
    const isLast   = idx === pl.items.length - 1;
    const isDone   = !!item.completed;
    const rowClass = "pl-item-row" + (isDone ? " pl-item-row--done" : "");

    const upBtn = el("button", { class: "pl-reorder-btn", title: "Move up" }, ["↑"]);
    if (isFirst) upBtn.disabled = true;
    upBtn.addEventListener("click", () => {
      [pl.items[idx - 1], pl.items[idx]] = [pl.items[idx], pl.items[idx - 1]];
      persistNow().then(() => renderItems());
    });

    const downBtn = el("button", { class: "pl-reorder-btn", title: "Move down" }, ["↓"]);
    if (isLast) downBtn.disabled = true;
    downBtn.addEventListener("click", () => {
      [pl.items[idx], pl.items[idx + 1]] = [pl.items[idx + 1], pl.items[idx]];
      persistNow().then(() => renderItems());
    });

    const check = el("input", { type: "checkbox", class: "pl-item-check" });
    check.checked = isDone;
    check.addEventListener("change", () => { item.completed = check.checked; persistNow(); renderProgress(); });

    if (item.kind === "scene") {
      const scene   = (appData.scenes ?? []).find(s => s.id === item.sceneId);
      const title   = scene ? (scene.title || "Untitled") : "(deleted scene)";
      const dateStr = scene?.sceneDate ? formatFlexibleDate(scene.sceneDate) : null;

      const link = scene
        ? el("a", { class: "pl-item-title pl-item-title--link", href: `#/scenes/${scene.id}` }, [title])
        : el("span", { class: "pl-item-title pl-item-title--missing" }, [title]);

      const removeBtn = el("button", { class: "pl-item-remove", onclick: () => {
        pl.items = pl.items.filter(i => i.id !== item.id);
        persistNow().then(() => renderItems());
      }}, ["×"]);

      return el("div", { class: rowClass }, [
        el("div", { class: "pl-reorder-btns" }, [upBtn, downBtn]),
        check,
        el("span", { class: "pl-item-kind" }, ["S"]),
        link,
        dateStr ? el("span", { class: "pl-item-date" }, [dateStr]) : null,
        removeBtn,
      ].filter(Boolean));
    }

    // Event row
    const dateStr = item.date ? formatFlexibleDate(item.date) : null;

    const editBtn = el("button", { class: "btn-small" }, ["Edit"]);
    editBtn.addEventListener("click", () => {
      const rowEl = editBtn.closest(".pl-item-row");
      rowEl.replaceWith(renderEventEditForm(item));
    });

    const removeBtn = el("button", { class: "pl-item-remove", onclick: () => {
      pl.items = pl.items.filter(i => i.id !== item.id);
      persistNow().then(() => renderItems());
    }}, ["×"]);

    return el("div", { class: rowClass }, [
      el("div", { class: "pl-reorder-btns" }, [upBtn, downBtn]),
      check,
      el("span", { class: "pl-item-kind" }, ["E"]),
      el("span", { class: "pl-item-title" }, [item.title || "(untitled event)"]),
      dateStr ? el("span", { class: "pl-item-date" }, [dateStr]) : null,
      editBtn,
      removeBtn,
    ].filter(Boolean));
  }

  function openEventEditDialog(item) {
    const backdrop = el("div", { class: "dialog-backdrop" });
    document.body.append(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener("keydown", onEsc);
    }

    function onEsc(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onEsc);
    backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });

    const titleInput2 = el("input", { type: "text", class: "pl-event-title-input", placeholder: "Event title…" });
    titleInput2.value = item.title ?? "";

    const { monthInput, daySelect, getValue: getDate } = makeDateInputs(item.date);
    const bodyTa2 = el("textarea", { class: "pl-textarea pl-event-body", rows: "3", placeholder: "Details…" });
    bodyTa2.value = item.body ?? "";

    const saveBtn = el("button", { class: "btn-primary" }, ["Save"]);
    saveBtn.addEventListener("click", () => {
      item.title = titleInput2.value.trim();
      item.date  = getDate();
      item.body  = bodyTa2.value.trim();
      persistNow().then(() => renderItems());
      close();
    });

    backdrop.append(el("div", { class: "dialog" }, [
      el("div", { class: "dialog-double-rule" }),
      el("h2", { class: "dialog-title" }, ["Edit event"]),
      el("div", { class: "dialog-double-rule" }),
      el("div", { class: "dialog-body" }, [
        el("div", { class: "dialog-field" }, [
          el("span", { class: "dialog-field-label" }, ["Title"]),
          titleInput2,
        ]),
        el("div", { class: "dialog-field" }, [
          el("span", { class: "dialog-field-label" }, ["Date"]),
          el("div", { class: "pl-date-inputs" }, [monthInput, daySelect]),
        ]),
        el("div", { class: "dialog-field" }, [
          el("span", { class: "dialog-field-label" }, ["Details"]),
          bodyTa2,
        ]),
      ]),
      el("div", { class: "dialog-footer" }, [
        saveBtn,
        el("button", { class: "btn-secondary", onclick: close }, ["Cancel"]),
      ]),
    ]));
  }

  async function initTimeline(container) {
    try {
      const visModule = await import("../../vendor/vis-timeline.esm.min.js");
      const Timeline  = visModule.Timeline;
      const DataSet   = visModule.DataSet;

      const tlItems = (pl.items ?? []).flatMap(item => {
        const parsed = itemEffectiveParsedDate(item, appData.scenes);
        if (!parsed) return [];
        const start = new Date(parsed.year, parsed.month - 1, parsed.day ?? 1);
        const title = escapeHtml(itemDisplayTitle(item, appData.scenes));
        return [{
          id:        item.id,
          content:   title,
          start,
          className: item.completed ? "plotline-item--complete" : "plotline-item",
          style:     `background-color: ${pl.color ?? "#4a6b8a"}; border-color: ${pl.color ?? "#4a6b8a"};`,
          type:      "box",
        }];
      });

      if (!tlItems.length) {
        container.append(el("p", { class: "pl-timeline-empty" }, [
          `No items with dates (${pl.items.length} item${pl.items.length !== 1 ? "s" : ""} in list, none with an effective date).`,
        ]));
        return () => {};
      }

      const dataset = new DataSet(tlItems);
      const options = {
        height:   "260px",
        stack:    true,
        editable: { add: false, updateTime: false, updateGroup: false, remove: false },
        zoomable: true,
        moveable: true,
        showCurrentTime: false,
        selectable: true,
      };

      const tl = new Timeline(container, dataset, options);

      if (appData.meta?.currentDate) {
        try { tl.addCustomTime(new Date(appData.meta.currentDate), "now"); } catch (_) {}
      }

      tl.on("click", props => {
        if (!props.item) return;
        const item = (pl.items ?? []).find(i => i.id === props.item);
        if (!item) return;
        if (item.kind === "scene") {
          navigate(`scenes/${item.sceneId}`);
        } else {
          openEventEditDialog(item);
        }
      });

      function onDateChange(e) {
        if (!container.isConnected) {
          window.removeEventListener("current-date-change", onDateChange);
          return;
        }
        try { tl.setCustomTime(new Date(e.detail.date), "now"); } catch (_) {}
      }
      window.addEventListener("current-date-change", onDateChange);

      return () => {
        window.removeEventListener("current-date-change", onDateChange);
        tl.destroy();
      };
    } catch (err) {
      container.append(el("p", { class: "pl-timeline-error" }, [`Timeline unavailable: ${err.message}`]));
      return () => {};
    }
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
    if (timelineTeardown) { timelineTeardown(); timelineTeardown = null; }
    clear(itemsEl);

    // ── Timeline ──
    const tlContainer = el("div", { class: "pl-timeline-container" });
    itemsEl.append(tlContainer);
    initTimeline(tlContainer).then(teardown => { timelineTeardown = teardown; });

    // ── Reorder list (stored array order, ↑/↓ to rearrange) ──
    if (pl.items.length) {
      const list = el("div", { class: "pl-items-list" });
      for (let i = 0; i < pl.items.length; i++) {
        list.append(renderListRow(pl.items[i], i));
      }
      itemsEl.append(list);
    } else {
      itemsEl.append(el("p", { class: "pl-empty-note" }, ["No items yet."]));
    }

    // ── Add controls ──
    const sceneAlready = new Set((pl.items ?? []).filter(i => i.kind === "scene").map(i => i.sceneId));
    const availableScenes = (appData.scenes ?? [])
      .filter(s => !sceneAlready.has(s.id))
      .map(s => ({ value: s.id, label: s.title || "Untitled" }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const availableScenesWithNew = [{ value: "__add_new__", label: "+ Add new scene" }, ...availableScenes];

    let pendingSceneId = "";
    const sceneCb = createCombobox({
      items: availableScenesWithNew,
      value: "",
      placeholder: "Add scene…",
      presorted: true,
      onChange: v => {
        if (v === "__add_new__") {
          pendingSceneId = "";
          openInlineCreateDialog({
            title: "Create new scene",
            fields: [
              { name: "title", label: "Title", type: "text", required: true, autofocus: true },
            ],
            onSubmit: async (values) => {
              const newScene = createScene();
              newScene.title = values.title;
              (appData.scenes ?? (appData.scenes = [])).push(newScene);
              await save("scenes", appData.scenes);
              pl.items.push({ id: crypto.randomUUID(), kind: "scene", sceneId: newScene.id, completed: false });
              await persistNow();
              renderItems();
            },
          });
          return;
        }
        pendingSceneId = v;
      },
    });
    const addSceneBtn = el("button", { class: "btn-small", onclick: () => {
      if (!pendingSceneId) return;
      pl.items.push({ id: crypto.randomUUID(), kind: "scene", sceneId: pendingSceneId, completed: false });
      pendingSceneId = "";
      persistNow().then(() => renderItems());
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

    renderProgress();
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
      progressEl,
      el("div", { class: "pl-section" }, [sectionLabel("Summary"), summaryTa]),
      el("div", { class: "pl-section" }, [sectionLabel("Body"), bodyTa]),
      charSectionEl,
      factionSectionEl,
      el("div", { class: "pl-section" }, [sectionLabel("Items"), itemsEl]),
      el("div", { class: "pl-section" }, [sectionLabel("Notes"), notesTa]),
      el("div", { class: "pl-delete-row" }, [deleteBtn]),
    ]),
  );

  requestAnimationFrame(() => {
    for (const ta of [summaryTa, bodyTa, notesTa]) autoresize(ta);
  });
}
