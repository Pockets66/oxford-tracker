import { el, clear } from "../dom.js";
import {
  createTimelineEvent, createScene, createAnomaly,
  SCENE_STATUSES, ANOMALY_STATUSES,
} from "../schema.js";
import { save } from "../storage.js";
import { SYMBOLS } from "../util/timeline-settings.js";

const MONTHS_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CREATE_TYPES = [
  { value: "event",   label: "Timeline Event" },
  { value: "scene",   label: "Scene" },
  { value: "anomaly", label: "Anomaly" },
];

// opts: { existingEvent, characterId, appData, onSave, onDelete, onClose }
export function openTimelineEventDialog(opts) {
  const { existingEvent, characterId, appData, onSave, onDelete, onClose } = opts;

  const isEdit = !!existingEvent;
  const ev = isEdit
    ? { ...existingEvent, characterIds: [...(existingEvent.characterIds ?? [])] }
    : createTimelineEvent();

  if (!isEdit && characterId != null && !ev.characterIds.includes(characterId)) {
    ev.characterIds = [characterId, ...ev.characterIds];
  }

  let createType = "event";

  function closeDialog() {
    document.removeEventListener("keydown", onDialogEsc);
    dialogBackdrop.remove();
    onClose?.();
  }

  function onDialogEsc(e) { if (e.key === "Escape") closeDialog(); }
  document.addEventListener("keydown", onDialogEsc);

  // ── Shared date helpers ─────────────────────────────────────────────────────

  function parseDateField(s) {
    if (!s) return { precision: "year", year: "", month: 1 };
    const parts = s.split("-");
    if (parts.length === 3) return { precision: "day", year: parts[0], month: Number(parts[1]), fullDate: s };
    if (parts.length === 2) return { precision: "month", year: parts[0], month: Number(parts[1]) };
    return { precision: "year", year: parts[0], month: 1 };
  }

  // ── Event fields ─────────────────────────────────────────────────────────────

  const dp = parseDateField(ev.date);

  const evPrecisionSel = el("select", { class: "sheet-input ptl-precision-sel" });
  for (const [val, label] of [["year", "Year"], ["month", "Month"], ["day", "Day"]]) {
    const opt = el("option", { value: val }, [label]);
    if (val === dp.precision) opt.selected = true;
    evPrecisionSel.append(opt);
  }

  const evYearInput = el("input", {
    type: "number", class: "sheet-input ptl-year-input",
    placeholder: "Year…", min: "1", max: "9999",
  });
  evYearInput.value = dp.year;

  const evMonthSel = el("select", { class: "sheet-input" });
  for (let i = 1; i <= 12; i++) {
    const opt = el("option", { value: String(i).padStart(2, "0") }, [MONTHS_LIST[i - 1]]);
    if (i === dp.month) opt.selected = true;
    evMonthSel.append(opt);
  }

  const evDayInput = el("input", { type: "date", class: "sheet-input" });
  if (dp.precision === "day" && dp.fullDate) evDayInput.value = dp.fullDate;

  const evDateFieldsWrap = el("div", { class: "ptl-date-fields" });

  function renderEvDateFields() {
    clear(evDateFieldsWrap);
    const p = evPrecisionSel.value;
    if (p === "year")       evDateFieldsWrap.append(evYearInput);
    else if (p === "month") evDateFieldsWrap.append(evYearInput, evMonthSel);
    else                    evDateFieldsWrap.append(evDayInput);
  }
  renderEvDateFields();
  evPrecisionSel.addEventListener("change", renderEvDateFields);

  function buildEvDateString() {
    const p = evPrecisionSel.value;
    if (p === "year")  { const y = evYearInput.value.trim(); return y || null; }
    if (p === "month") { const y = evYearInput.value.trim(); return y ? `${y}-${evMonthSel.value}` : null; }
    return evDayInput.value || null;
  }

  const evTitleInput = el("input", {
    type: "text", class: "sheet-input", placeholder: "Event title…",
  });
  evTitleInput.value = ev.title ?? "";

  const evBodyTextarea = el("textarea", {
    class: "sheet-input ptl-body-textarea", placeholder: "Notes… (optional)", rows: "3",
  });
  evBodyTextarea.value = ev.body ?? "";

  const symbolSel = el("select", { class: "sheet-input" });
  symbolSel.append(el("option", { value: "" }, ["— Type default —"]));
  for (const sym of SYMBOLS) {
    const opt = el("option", { value: sym.value }, [sym.label]);
    if (sym.value === ev.symbol) opt.selected = true;
    symbolSel.append(opt);
  }
  if (!ev.symbol) symbolSel.value = "";

  const eventFieldsEl = el("div", {}, [
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Title"]),
      evTitleInput,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Date precision"]),
      evPrecisionSel,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Date"]),
      evDateFieldsWrap,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Symbol override"]),
      symbolSel,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Notes"]),
      evBodyTextarea,
    ]),
  ]);

  // ── Scene fields ─────────────────────────────────────────────────────────────

  const sceneTitleInput = el("input", {
    type: "text", class: "sheet-input", placeholder: "Scene title…",
  });

  const sceneDateInput = el("input", { type: "date", class: "sheet-input" });

  const sceneStatusSel = el("select", { class: "sheet-input" });
  for (const s of SCENE_STATUSES) {
    const opt = el("option", { value: s }, [s]);
    if (s === "Draft") opt.selected = true;
    sceneStatusSel.append(opt);
  }

  const sceneFieldsEl = el("div", { hidden: true }, [
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Title"]),
      sceneTitleInput,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Date"]),
      sceneDateInput,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Status"]),
      sceneStatusSel,
    ]),
  ]);

  // ── Anomaly fields ────────────────────────────────────────────────────────────

  const anomalyTitleInput = el("input", {
    type: "text", class: "sheet-input", placeholder: "Anomaly name…",
  });

  const anomalyDateInput = el("input", { type: "date", class: "sheet-input" });

  const anomalyStatusSel = el("select", { class: "sheet-input" });
  for (const s of ANOMALY_STATUSES) {
    const opt = el("option", { value: s }, [s]);
    if (s === "Unknown") opt.selected = true;
    anomalyStatusSel.append(opt);
  }

  const anomalyFieldsEl = el("div", { hidden: true }, [
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Name"]),
      anomalyTitleInput,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Discovery date"]),
      anomalyDateInput,
    ]),
    el("div", { class: "dialog-field" }, [
      el("div", { class: "dialog-field-label" }, ["Status"]),
      anomalyStatusSel,
    ]),
  ]);

  // ── Type selector (create mode only) ─────────────────────────────────────────

  const typeSel = el("select", { class: "sheet-input" });
  for (const { value, label } of CREATE_TYPES) {
    typeSel.append(el("option", { value }, [label]));
  }

  const typeFieldEl = el("div", { class: "dialog-field" }, [
    el("div", { class: "dialog-field-label" }, ["Type"]),
    typeSel,
  ]);
  if (isEdit) typeFieldEl.hidden = true;

  const saveBtn = el("button", { class: "btn-primary" }, [isEdit ? "Save" : "Add Event"]);

  function switchType() {
    createType = typeSel.value;
    eventFieldsEl.hidden   = createType !== "event";
    sceneFieldsEl.hidden   = createType !== "scene";
    anomalyFieldsEl.hidden = createType !== "anomaly";
    const labels = { event: "Add Event", scene: "Add Scene", anomaly: "Add Anomaly" };
    if (!isEdit) saveBtn.textContent = labels[createType] ?? "Add";
  }
  typeSel.addEventListener("change", switchType);

  // ── Save handler ─────────────────────────────────────────────────────────────

  saveBtn.addEventListener("click", async () => {
    const type = isEdit ? "event" : createType;

    if (type === "event") {
      ev.title     = evTitleInput.value.trim();
      ev.body      = evBodyTextarea.value;
      ev.date      = buildEvDateString();
      ev.symbol    = symbolSel.value || null;
      ev.updatedAt = new Date().toISOString();

      if (characterId != null && !ev.characterIds.includes(characterId)) {
        ev.characterIds = [characterId, ...ev.characterIds];
      }

      const idx = appData.timelineEvents.findIndex(e => e.id === ev.id);
      if (idx >= 0) appData.timelineEvents[idx] = ev;
      else          appData.timelineEvents.push(ev);
      await save("timelineEvents", appData.timelineEvents);

    } else if (type === "scene") {
      const scene      = createScene();
      scene.title      = sceneTitleInput.value.trim();
      scene.sceneDate  = sceneDateInput.value || null;
      scene.status     = sceneStatusSel.value;
      appData.scenes ??= [];
      appData.scenes.push(scene);
      await save("scenes", appData.scenes);

    } else if (type === "anomaly") {
      const anomaly          = createAnomaly();
      anomaly.title          = anomalyTitleInput.value.trim();
      anomaly.discoveryDate  = anomalyDateInput.value || null;
      anomaly.status         = anomalyStatusSel.value;
      appData.anomalies ??= [];
      appData.anomalies.push(anomaly);
      await save("anomalies", appData.anomalies);
    }

    closeDialog();
    onSave?.();
  });

  const cancelBtn = el("button", { class: "btn-secondary" }, ["Cancel"]);
  cancelBtn.addEventListener("click", closeDialog);

  const footer = el("div", { class: "dialog-footer" }, [saveBtn, cancelBtn]);

  if (isEdit) {
    const deleteBtn = el("button", { class: "btn-danger" }, ["Delete"]);
    deleteBtn.addEventListener("click", async () => {
      appData.timelineEvents = appData.timelineEvents.filter(e => e.id !== ev.id);
      await save("timelineEvents", appData.timelineEvents);
      closeDialog();
      onDelete?.();
    });
    footer.append(deleteBtn);
  }

  // ── Dialog DOM ────────────────────────────────────────────────────────────────

  const dialogTitle = isEdit ? "Edit Event" : "Add to Timeline";
  const dialog = el("div", { class: "dialog" }, [
    el("h2", { class: "dialog-title" }, [dialogTitle]),
    el("div", { class: "dialog-body" }, [
      typeFieldEl,
      eventFieldsEl,
      sceneFieldsEl,
      anomalyFieldsEl,
    ]),
    footer,
  ]);

  const dialogBackdrop = el("div", { class: "dialog-backdrop" });
  dialogBackdrop.append(dialog);
  dialogBackdrop.addEventListener("click", e => { if (e.target === dialogBackdrop) closeDialog(); });
  document.body.append(dialogBackdrop);

  (isEdit ? evTitleInput : typeSel).focus();
}
