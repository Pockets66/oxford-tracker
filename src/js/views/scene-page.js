import { el } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { SCENE_STATUSES } from "../schema.js";
import { parseFlexibleDate } from "../dates.js";

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function autoresize(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

function sectionLabel(text) {
  return el("div", { class: "scene-page-label" }, [text]);
}

function makeTextarea(cls, rows, placeholder, value, onChange) {
  const ta = el("textarea", { class: cls, rows: String(rows), placeholder });
  ta.value = value ?? "";
  ta.addEventListener("input", () => { autoresize(ta); onChange(ta.value); });
  return ta;
}

function parseDateInput(monthVal, dayVal) {
  if (!monthVal) return null;
  if (dayVal && dayVal !== "0") {
    return `${monthVal}-${String(dayVal).padStart(2, "0")}`;
  }
  return monthVal;
}

function section(labelText, ...children) {
  return el("div", { class: "scene-page-section" }, [
    sectionLabel(labelText),
    ...children,
  ]);
}

export function mountScenePage(container, appData, id) {
  appData.scenes ??= [];
  const scene = appData.scenes.find(s => s.id === id);
  if (!scene) {
    container.append(el("p", {}, ["Scene not found."]));
    return;
  }

  const persist = debounce(async () => {
    scene.updatedAt = new Date().toISOString();
    await save("scenes", appData.scenes);
  }, 400);

  // ── Title ──
  const titleInput = el("input", {
    type: "text",
    class: "scene-page-title-input",
    placeholder: "Scene title…",
  });
  titleInput.value = scene.title ?? "";
  titleInput.addEventListener("input", () => { scene.title = titleInput.value; persist(); });

  // ── Status ──
  const statusSel = el("select", { class: "scene-page-status-select" });
  for (const s of SCENE_STATUSES) {
    const opt = el("option", { value: s }, [s]);
    if (s === (scene.status ?? "Draft")) opt.selected = true;
    statusSel.append(opt);
  }
  statusSel.addEventListener("change", () => { scene.status = statusSel.value; persist(); });

  // ── Scene date ──
  const parsed = parseFlexibleDate(scene.sceneDate);

  const monthInput = el("input", { type: "month", class: "scene-page-month-input" });
  if (parsed) {
    monthInput.value = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
  }

  const daySelect = el("select", { class: "scene-page-day-select" });
  daySelect.append(el("option", { value: "0" }, ["—"]));
  for (let d = 1; d <= 31; d++) {
    const opt = el("option", { value: String(d) }, [String(d)]);
    if (parsed?.day === d) opt.selected = true;
    daySelect.append(opt);
  }

  function updateDate() {
    scene.sceneDate = parseDateInput(monthInput.value, daySelect.value);
    persist();
  }
  monthInput.addEventListener("change", updateDate);
  daySelect.addEventListener("change", updateDate);

  // ── Location ──
  const locationInput = el("input", {
    type: "text",
    class: "scene-page-location-input",
    placeholder: "Location…",
  });
  locationInput.value = scene.location ?? "";
  locationInput.addEventListener("input", () => { scene.location = locationInput.value; persist(); });

  // ── Body sections ──
  const beatsTa   = makeTextarea("scene-page-textarea", 4, "What needs to happen?",               scene.storyBeats, v => { scene.storyBeats = v; persist(); });
  const goalsTa   = makeTextarea("scene-page-textarea", 3, "What do we want out of this scene?",  scene.goals,      v => { scene.goals      = v; persist(); });
  const summaryTa = makeTextarea("scene-page-textarea scene-page-textarea--summary", 3, "A brief summary…", scene.summary, v => { scene.summary = v; persist(); });
  const bodyTa    = makeTextarea("scene-page-textarea scene-page-textarea--body",   10, "Scene content…",   scene.body,    v => { scene.body    = v; persist(); });
  const notesTa   = makeTextarea("scene-page-textarea", 3, "Notes…",                              scene.notes,     v => { scene.notes    = v; persist(); });

  // ── Delete ──
  let deleteConfirm = false;
  const deleteBtn = el("button", { class: "btn-danger" }, ["Delete scene"]);
  deleteBtn.addEventListener("click", async () => {
    if (!deleteConfirm) {
      deleteBtn.textContent = "Confirm delete";
      deleteConfirm = true;
      return;
    }
    appData.scenes = appData.scenes.filter(s => s.id !== scene.id);
    await save("scenes", appData.scenes);
    navigate("scenes");
  });

  container.append(
    el("div", { class: "scene-page" }, [
      el("div", { class: "scene-page-header" }, [
        titleInput,
        el("div", { class: "scene-page-header-controls" }, [statusSel]),
      ]),
      el("div", { class: "scene-page-meta-row" }, [
        el("div", { class: "scene-page-date-wrap" }, [
          sectionLabel("Date"),
          el("div", { class: "scene-page-date-inputs" }, [monthInput, daySelect]),
        ]),
        el("div", { class: "scene-page-location-wrap" }, [
          sectionLabel("Location"),
          locationInput,
        ]),
      ]),
      section("Story beats", beatsTa),
      section("Goals", goalsTa),
      section("Summary", summaryTa),
      section("Body", bodyTa),
      section("Notes", notesTa),
      el("div", { class: "scene-page-delete-row" }, [deleteBtn]),
    ]),
  );

  for (const ta of [beatsTa, goalsTa, summaryTa, bodyTa, notesTa]) autoresize(ta);
}
