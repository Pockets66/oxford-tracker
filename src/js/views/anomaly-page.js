import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { ANOMALY_CATEGORIES, ANOMALY_CLASSES, ANOMALY_STATUSES, anomalyOverallClass, displayName } from "../schema.js";
import { createCombobox } from "../components/combobox.js";

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function classSlug(roman) { return roman.toLowerCase(); }

const PENCIL_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;

// ── Type row helper ───────────────────────────────────────────────────────────

function makeTypeRow(type, onRemove, onChange) {
  const catSel = el("select", { class: "sheet-input" });
  catSel.append(el("option", { value: "" }, ["Category…"]));
  for (const cat of ANOMALY_CATEGORIES) {
    const opt = el("option", { value: cat.name }, [cat.name]);
    if (cat.name === type.category) opt.selected = true;
    catSel.append(opt);
  }

  const clsSel = el("select", { class: "sheet-input" });
  clsSel.append(el("option", { value: "" }, ["Class…"]));
  for (const cls of ANOMALY_CLASSES) {
    const opt = el("option", { value: cls.roman }, [`${cls.roman} — ${cls.label}`]);
    if (cls.roman === type.class) opt.selected = true;
    clsSel.append(opt);
  }

  catSel.addEventListener("change", () => { type.category = catSel.value || null; onChange(); });
  clsSel.addEventListener("change", () => { type.class    = clsSel.value || null; onChange(); });

  const removeBtn = el("button", { class: "btn-small btn-small--danger" }, ["×"]);
  removeBtn.addEventListener("click", onRemove);

  return el("div", { class: "anomaly-type-row" }, [catSel, clsSel, removeBtn]);
}

// ── Generic entity picker (combobox + chips) ──────────────────────────────────

function makeEntityPicker(getIds, getName, getItems, onSave) {
  const chipsEl  = el("div", { class: "secret-picker-chips" });
  const comboWrap = el("div", { class: "secret-picker-add" });

  function renderChips() {
    clear(chipsEl);
    for (const id of getIds()) {
      chipsEl.append(el("span", { class: "secret-picker-chip" }, [
        getName(id),
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          const arr = getIds();
          const idx = arr.indexOf(id);
          if (idx !== -1) arr.splice(idx, 1);
          renderChips();
          rebuildCombo();
          onSave();
        }}, ["×"]),
      ]));
    }
  }

  function rebuildCombo() {
    clear(comboWrap);
    const available = getItems().filter(item => !getIds().includes(item.id));
    if (!available.length) return;
    comboWrap.append(createCombobox({
      items: available.map(item => ({ value: item.id, label: getName(item.id) })),
      value: "",
      placeholder: "Add…",
      onChange: (id) => {
        if (!id || getIds().includes(id)) return;
        getIds().push(id);
        renderChips();
        rebuildCombo();
        onSave();
      },
    }));
  }

  renderChips();
  rebuildCombo();

  return el("div", { class: "secret-section" }, [chipsEl, comboWrap]);
}

// ── Section helper ────────────────────────────────────────────────────────────

function section(title, ...children) {
  return el("div", { class: "secret-section" }, [
    el("div", { class: "secret-section-title" }, [title]),
    ...children,
  ]);
}

// ── Observations ─────────────────────────────────────────────────────────────

function makeObsForm(existing, onCancel, onSave) {
  const dateIn  = el("input", { type: "text",     class: "sheet-input", placeholder: "Date (YYYY, YYYY-MM, YYYY-MM-DD)" });
  const titleIn = el("input", { type: "text",     class: "sheet-input", placeholder: "Title…" });
  const bodyTa  = el("textarea", { class: "sheet-textarea", rows: "3", placeholder: "Body…" });

  if (existing) {
    dateIn.value  = existing.date  ?? "";
    titleIn.value = existing.title ?? "";
    bodyTa.value  = existing.body  ?? "";
  }

  const saveBtn   = el("button", { class: "btn-primary btn-small" }, ["Save"]);
  const cancelBtn = el("button", { class: "btn-small" }, ["Cancel"]);

  saveBtn.addEventListener("click", () => {
    onSave({
      id:    existing?.id ?? crypto.randomUUID(),
      date:  dateIn.value.trim()  || null,
      title: titleIn.value.trim() || "",
      body:  bodyTa.value.trim()  || "",
    });
  });
  cancelBtn.addEventListener("click", onCancel);

  return el("div", { class: "anomaly-obs-form" }, [
    el("div", { class: "anomaly-obs-form-row" }, [dateIn, titleIn]),
    bodyTa,
    el("div", { class: "anomaly-obs-form-btns" }, [saveBtn, cancelBtn]),
  ]);
}

function buildObsSection(anomaly, persistNow) {
  const obsListEl = el("div", { class: "anomaly-obs-list" });

  function renderObservations() {
    clear(obsListEl);
    anomaly.observations ??= [];

    for (let i = 0; i < anomaly.observations.length; i++) {
      const obs = anomaly.observations[i];
      const idx = i;

      const metaEl = el("div", { class: "anomaly-obs-meta" }, [
        obs.date  ? el("em",     { class: "anomaly-obs-date"  }, [obs.date])  : null,
        obs.title ? el("strong", { class: "anomaly-obs-title" }, [obs.title]) : null,
      ].filter(Boolean));
      const bodyEl     = obs.body ? el("p", { class: "anomaly-obs-body" }, [obs.body]) : null;
      const contentEl  = el("div", { class: "anomaly-obs-content" }, [metaEl, bodyEl].filter(Boolean));

      const editBtn = el("button", { class: "anomaly-obs-edit-btn", title: "Edit" });
      editBtn.innerHTML = PENCIL_SVG;

      const delBtn = el("button", { class: "anomaly-obs-delete-btn btn-small btn-small--danger" }, ["×"]);
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this observation?")) return;
        anomaly.observations.splice(idx, 1);
        await persistNow();
        renderObservations();
      });

      const actionsEl = el("div", { class: "anomaly-obs-actions" }, [editBtn, delBtn]);
      const rowEl     = el("div", { class: "anomaly-obs-row" }, [contentEl, actionsEl]);

      editBtn.addEventListener("click", () => {
        clear(rowEl);
        const form = makeObsForm(
          obs,
          () => { clear(rowEl); rowEl.append(contentEl, actionsEl); },
          async (updated) => { Object.assign(obs, updated); await persistNow(); renderObservations(); },
        );
        rowEl.append(form);
      });

      obsListEl.append(rowEl);
    }

    const addBtn = el("button", { class: "btn-small anomaly-obs-add-btn" }, ["+ Add observation"]);
    let formOpen = false;
    addBtn.addEventListener("click", () => {
      if (formOpen) return;
      formOpen = true;
      const form = makeObsForm(
        null,
        () => { form.remove(); formOpen = false; },
        async (newObs) => {
          anomaly.observations.push(newObs);
          await persistNow();
          renderObservations();
        },
      );
      obsListEl.insertBefore(form, addBtn);
    });
    obsListEl.append(addBtn);
  }

  renderObservations();
  return obsListEl;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function mountAnomalyPage(container, appData, id) {
  const anomaly = (appData.anomalies ?? []).find(a => a.id === id);
  if (!anomaly) {
    container.append(el("p", { class: "sheet-empty-note" }, ["Anomaly not found."]));
    return;
  }

  const persist = debounce(async () => {
    anomaly.updatedAt = new Date().toISOString();
    await save("anomalies", appData.anomalies);
  }, 400);

  function persistNow() {
    anomaly.updatedAt = new Date().toISOString();
    return save("anomalies", appData.anomalies);
  }

  // ── Back ──
  const backBtn = el("button", { class: "btn-link secret-page-back" }, ["← All anomalies"]);
  backBtn.addEventListener("click", () => navigate("anomalies"));

  // ── Archive / Delete ──
  const archiveBtn = el("button", { class: "btn-small" }, [anomaly.archived ? "Unarchive" : "Archive"]);
  archiveBtn.addEventListener("click", async () => {
    anomaly.archived = !anomaly.archived;
    archiveBtn.textContent = anomaly.archived ? "Unarchive" : "Archive";
    archivedNote.style.display = anomaly.archived ? "" : "none";
    await persistNow();
  });

  const deleteBtn = el("button", { class: "btn-small btn-small--danger" }, ["Delete"]);
  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${anomaly.title || "(unnamed)"}"? This cannot be undone.`)) return;
    appData.anomalies = appData.anomalies.filter(a => a.id !== id);
    await save("anomalies", appData.anomalies);
    navigate("anomalies");
  });

  const archivedNote = el("div", { class: "secret-archived-note" }, ["This anomaly is archived."]);
  archivedNote.style.display = anomaly.archived ? "" : "none";

  // ── Title ──
  const titleInput = el("input", { type: "text", class: "secret-page-title", placeholder: "Anomaly name…" });
  titleInput.value = anomaly.title ?? "";
  titleInput.addEventListener("input", () => { anomaly.title = titleInput.value; persist(); });

  // ── Overall class chip ──
  const overallChipEl = el("span", { class: "class-chip" });
  function refreshOverallChip() {
    const overall = anomalyOverallClass(anomaly);
    if (overall) {
      overallChipEl.textContent = `Class ${overall}`;
      overallChipEl.className   = `class-chip class-chip--${classSlug(overall)}`;
      overallChipEl.style.display = "";
    } else {
      overallChipEl.style.display = "none";
    }
  }
  refreshOverallChip();

  // ──────────────── LEFT COLUMN ────────────────────────────────────────────────

  const loreTa = el("textarea", {
    class: "sheet-textarea sheet-textarea--bg",
    placeholder: "Lore and description…",
    rows: "8",
  });
  loreTa.value = anomaly.lore ?? "";
  loreTa.addEventListener("input", () => { anomaly.lore = loreTa.value; persist(); });

  const obsSection = buildObsSection(anomaly, persistNow);

  // ──────────────── RIGHT COLUMN ───────────────────────────────────────────────

  // Primary type
  const primaryCatSel = el("select", { class: "sheet-input" });
  primaryCatSel.append(el("option", { value: "" }, ["Primary type…"]));
  for (const cat of ANOMALY_CATEGORIES) {
    const opt = el("option", { value: cat.name }, [cat.name]);
    if (cat.name === anomaly.primaryCategory) opt.selected = true;
    primaryCatSel.append(opt);
  }
  primaryCatSel.addEventListener("change", () => {
    anomaly.primaryCategory = primaryCatSel.value || null;
    refreshOverallChip();
    persist();
  });

  const primaryClsSel = el("select", { class: "sheet-input" });
  primaryClsSel.append(el("option", { value: "" }, ["Class…"]));
  for (const cls of ANOMALY_CLASSES) {
    const opt = el("option", { value: cls.roman }, [`${cls.roman} — ${cls.label}`]);
    if (cls.roman === anomaly.primaryClass) opt.selected = true;
    primaryClsSel.append(opt);
  }
  primaryClsSel.addEventListener("change", () => {
    anomaly.primaryClass = primaryClsSel.value || null;
    refreshOverallChip();
    persist();
  });

  // Secondary types
  const secondaryEl = el("div", { class: "anomaly-secondary-editor" });
  function renderSecondaryTypes() {
    clear(secondaryEl);
    for (let i = 0; i < (anomaly.secondaryTypes ?? []).length; i++) {
      const idx  = i;
      const type = anomaly.secondaryTypes[i];
      secondaryEl.append(makeTypeRow(
        type,
        () => { anomaly.secondaryTypes.splice(idx, 1); refreshOverallChip(); persist(); renderSecondaryTypes(); },
        () => { refreshOverallChip(); persist(); },
      ));
    }
    const addBtn = el("button", { class: "btn-small" }, ["+ Add secondary type"]);
    addBtn.addEventListener("click", () => {
      (anomaly.secondaryTypes ??= []).push({ category: null, class: null });
      persist();
      renderSecondaryTypes();
    });
    secondaryEl.append(addBtn);
  }
  renderSecondaryTypes();

  // Status
  const statusSel = el("select", { class: "sheet-input" });
  for (const st of ANOMALY_STATUSES) {
    const opt = el("option", { value: st }, [st]);
    if (st === (anomaly.status ?? "Unknown")) opt.selected = true;
    statusSel.append(opt);
  }
  statusSel.addEventListener("change", () => { anomaly.status = statusSel.value; persist(); });

  // Location
  const locationIn = el("input", { type: "text", class: "sheet-input sheet-input--wide", placeholder: "Location…" });
  locationIn.value = anomaly.location ?? "";
  locationIn.addEventListener("input", () => { anomaly.location = locationIn.value; persist(); });

  // Discovery date
  const discoveryIn = el("input", {
    type: "text", class: "sheet-input",
    placeholder: "YYYY, YYYY-MM, or YYYY-MM-DD",
  });
  discoveryIn.value = anomaly.discoveryDate ?? "";
  discoveryIn.addEventListener("input", () => { anomaly.discoveryDate = discoveryIn.value.trim() || null; persist(); });

  // Related characters
  const charPicker = makeEntityPicker(
    () => (anomaly.characterIds ??= []),
    (cid) => {
      const c = (appData.characters ?? []).find(ch => ch.id === cid);
      return c ? displayName(c) : cid;
    },
    () => [...(appData.characters ?? [])].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    persistNow,
  );

  // Related scenes
  const scenePicker = makeEntityPicker(
    () => (anomaly.sceneIds ??= []),
    (sid) => {
      const s = (appData.scenes ?? []).find(sc => sc.id === sid);
      return s ? (s.title || "Untitled scene") : sid;
    },
    () => [...(appData.scenes ?? [])].sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    persistNow,
  );

  // Related plotlines
  const plotlinePicker = makeEntityPicker(
    () => (anomaly.plotlineIds ??= []),
    (pid) => {
      const p = (appData.plotlines ?? []).find(pl => pl.id === pid);
      return p ? (p.title || "Untitled plotline") : pid;
    },
    () => [...(appData.plotlines ?? [])].sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    persistNow,
  );

  // Related secrets
  const secretPicker = makeEntityPicker(
    () => (anomaly.secretIds ??= []),
    (sid) => {
      const s = (appData.secrets ?? []).find(sc => sc.id === sid);
      return s ? (s.title || "(untitled secret)") : sid;
    },
    () => [...(appData.secrets ?? [])].sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    persistNow,
  );

  // Tags
  const tagsChipsEl = el("div", { class: "secret-tags-chips" });
  function renderTagChips() {
    clear(tagsChipsEl);
    for (const tag of anomaly.tags ?? []) {
      tagsChipsEl.append(el("span", { class: "secret-tag-chip" }, [
        tag,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          anomaly.tags = anomaly.tags.filter(t => t !== tag);
          renderTagChips();
          persist();
        }}, ["×"]),
      ]));
    }
  }
  renderTagChips();

  const tagInput  = el("input", { type: "text", class: "sheet-input", placeholder: "Add tag…", style: "width:140px" });
  const tagAddBtn = el("button", { class: "btn-small" }, ["Add"]);
  function addTag() {
    const val = tagInput.value.trim();
    if (!val || (anomaly.tags ?? []).includes(val)) { tagInput.value = ""; return; }
    (anomaly.tags ??= []).push(val);
    tagInput.value = "";
    renderTagChips();
    persist();
  }
  tagAddBtn.addEventListener("click", addTag);
  tagInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } });

  // Notes
  const notesTa = el("textarea", { class: "sheet-textarea", placeholder: "Notes…", rows: "4" });
  notesTa.value = anomaly.notes ?? "";
  notesTa.addEventListener("input", () => { anomaly.notes = notesTa.value; persist(); });

  // ── Layout ────────────────────────────────────────────────────────────────────

  const leftCol = el("div", { class: "sheet-main" }, [
    section("Lore", loreTa),
    section("Observations", obsSection),
  ]);

  const rightCol = el("div", { class: "sheet-cards" }, [
    section("Primary type",
      el("div", { class: "anomaly-type-row" }, [primaryCatSel, primaryClsSel]),
    ),
    section("Secondary types", secondaryEl),
    section("Status",          statusSel),
    section("Location",        locationIn),
    section("Discovery date",  discoveryIn),
    section("Related characters", charPicker),
    section("Related scenes",     scenePicker),
    section("Related plotlines",  plotlinePicker),
    section("Related secrets",    secretPicker),
    section("Tags",
      tagsChipsEl,
      el("div", { class: "secret-tag-input-row" }, [tagInput, tagAddBtn]),
    ),
    section("Notes", notesTa),
  ]);

  container.append(
    backBtn,
    el("div", { class: "secret-page-header" }, [
      titleInput,
      el("div", { class: "secret-page-controls" }, [overallChipEl, archiveBtn, deleteBtn]),
    ]),
    archivedNote,
    el("div", { class: "anomaly-page-body" }, [
      el("div", { class: "sheet-layout" }, [leftCol, rightCol]),
    ]),
  );
}
