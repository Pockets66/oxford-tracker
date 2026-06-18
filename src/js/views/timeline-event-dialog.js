import { el, clear } from "../dom.js";
import { createTimelineEvent } from "../schema.js";
import { save } from "../storage.js";

const MONTHS_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// opts: { existingEvent, characterId, appData, onSave, onDelete, onClose }
export function openTimelineEventDialog(opts) {
  const { existingEvent, characterId, appData, onSave, onDelete, onClose } = opts;

  const isEdit = !!existingEvent;
  const ev = isEdit ? { ...existingEvent, characterIds: [...(existingEvent.characterIds ?? [])] } : createTimelineEvent();
  if (!isEdit && !ev.characterIds.includes(characterId)) {
    ev.characterIds = [characterId, ...ev.characterIds];
  }

  function closeDialog() {
    document.removeEventListener("keydown", onDialogEsc);
    dialogBackdrop.remove();
    onClose?.();
  }

  function onDialogEsc(e) { if (e.key === "Escape") closeDialog(); }
  document.addEventListener("keydown", onDialogEsc);

  // ── Date precision helpers ──────────────────────────────────────────────────
  function parseDateField(s) {
    if (!s) return { precision: "year", year: "", month: 1 };
    const parts = s.split("-");
    if (parts.length === 3) return { precision: "day", year: parts[0], month: Number(parts[1]), fullDate: s };
    if (parts.length === 2) return { precision: "month", year: parts[0], month: Number(parts[1]) };
    return { precision: "year", year: parts[0], month: 1 };
  }

  const dp = parseDateField(ev.date);

  const precisionSel = el("select", { class: "sheet-input ptl-precision-sel" });
  for (const [val, label] of [["year", "Year"], ["month", "Month"], ["day", "Day"]]) {
    const opt = el("option", { value: val }, [label]);
    if (val === dp.precision) opt.selected = true;
    precisionSel.append(opt);
  }

  const yearInput = el("input", {
    type: "number",
    class: "sheet-input ptl-year-input",
    placeholder: "Year…",
    min: "1",
    max: "9999",
  });
  yearInput.value = dp.year;

  const monthSel = el("select", { class: "sheet-input" });
  for (let i = 1; i <= 12; i++) {
    const opt = el("option", { value: String(i).padStart(2, "0") }, [MONTHS_LIST[i - 1]]);
    if (i === dp.month) opt.selected = true;
    monthSel.append(opt);
  }

  const dayInput = el("input", { type: "date", class: "sheet-input" });
  if (dp.precision === "day" && dp.fullDate) dayInput.value = dp.fullDate;

  const dateFieldsWrap = el("div", { class: "ptl-date-fields" });

  function renderDateFields() {
    clear(dateFieldsWrap);
    const p = precisionSel.value;
    if (p === "year") {
      dateFieldsWrap.append(yearInput);
    } else if (p === "month") {
      dateFieldsWrap.append(yearInput, monthSel);
    } else {
      dateFieldsWrap.append(dayInput);
    }
  }
  renderDateFields();
  precisionSel.addEventListener("change", renderDateFields);

  function buildDateString() {
    const p = precisionSel.value;
    if (p === "year") {
      const y = yearInput.value.trim();
      return y || null;
    }
    if (p === "month") {
      const y = yearInput.value.trim();
      if (!y) return null;
      return `${y}-${monthSel.value}`;
    }
    return dayInput.value || null;
  }

  // ── Form fields ─────────────────────────────────────────────────────────────
  const titleInput = el("input", {
    type: "text",
    class: "sheet-input",
    placeholder: "Event title…",
  });
  titleInput.value = ev.title ?? "";

  const bodyTextarea = el("textarea", {
    class: "sheet-input ptl-body-textarea",
    placeholder: "Notes… (optional)",
    rows: "3",
  });
  bodyTextarea.value = ev.body ?? "";

  // ── Buttons ─────────────────────────────────────────────────────────────────
  const saveBtn = el("button", { class: "btn-primary" }, [isEdit ? "Save" : "Add"]);
  saveBtn.addEventListener("click", async () => {
    ev.title     = titleInput.value.trim();
    ev.body      = bodyTextarea.value;
    ev.date      = buildDateString();
    ev.updatedAt = new Date().toISOString();

    if (!ev.characterIds.includes(characterId)) {
      ev.characterIds = [characterId, ...ev.characterIds];
    }

    const idx = appData.timelineEvents.findIndex(e => e.id === ev.id);
    if (idx >= 0) {
      appData.timelineEvents[idx] = ev;
    } else {
      appData.timelineEvents.push(ev);
    }
    await save("timelineEvents", appData.timelineEvents);
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

  // ── Dialog DOM ───────────────────────────────────────────────────────────────
  const dialog = el("div", { class: "dialog" }, [
    el("h2", { class: "dialog-title" }, [isEdit ? "Edit Event" : "Add Event"]),
    el("div", { class: "dialog-body" }, [
      el("div", { class: "dialog-field" }, [
        el("div", { class: "dialog-field-label" }, ["Title"]),
        titleInput,
      ]),
      el("div", { class: "dialog-field" }, [
        el("div", { class: "dialog-field-label" }, ["Date precision"]),
        precisionSel,
      ]),
      el("div", { class: "dialog-field" }, [
        el("div", { class: "dialog-field-label" }, ["Date"]),
        dateFieldsWrap,
      ]),
      el("div", { class: "dialog-field" }, [
        el("div", { class: "dialog-field-label" }, ["Notes"]),
        bodyTextarea,
      ]),
    ]),
    footer,
  ]);

  const dialogBackdrop = el("div", { class: "dialog-backdrop" });
  dialogBackdrop.append(dialog);
  dialogBackdrop.addEventListener("click", e => { if (e.target === dialogBackdrop) closeDialog(); });
  document.body.append(dialogBackdrop);

  titleInput.focus();
}
