import { el, clear } from "../dom.js";
import { formatFlexibleDate } from "../dates.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { SYMBOLS, getTypeSettings } from "../util/timeline-settings.js";
import { SCENE_STATUSES, ANOMALY_STATUSES } from "../schema.js";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function parseDateField(s) {
  if (!s) return { precision: "year", year: "", month: 1 };
  const parts = s.split("-");
  if (parts.length === 3) return { precision: "day", year: parts[0], month: Number(parts[1]), fullDate: s };
  if (parts.length === 2) return { precision: "month", year: parts[0], month: Number(parts[1]) };
  return { precision: "year", year: parts[0], month: 1 };
}

// Open a detail/edit panel for any timeline item.
// containerEl should be listPaneEl (position: relative, overflow: hidden).
export function openTimelineItemPanel({ item, appData, containerEl, onSave, onDelete }) {
  containerEl.querySelector(".gtl-item-panel")?.remove();

  const panel = el("div", { class: "gtl-item-panel" });
  const close = () => panel.remove();

  const ts   = getTypeSettings(appData);
  const tset = ts[item.kind];

  const symEl = el("span", { class: "gtl-panel-sym" }, [tset.symbol]);
  symEl.style.color = tset.color;

  const closeBtn = el("button", { class: "gtl-panel-close" }, ["×"]);
  closeBtn.addEventListener("click", close);

  panel.append(
    el("div", { class: "gtl-panel-header" }, [
      symEl,
      el("div", { class: "gtl-panel-htext" }, [
        el("div", { class: "gtl-panel-htitle" }, [item.label]),
        el("div", { class: "gtl-panel-hdate" }, [item.dateRaw ? formatFlexibleDate(item.dateRaw) : ""]),
      ]),
      closeBtn,
    ]),
  );

  const body = el("div", { class: "gtl-panel-body" });
  panel.append(body);

  if (item.kind === "events") {
    const ev = (appData.timelineEvents ?? []).find(e => e.id === item.eventId);
    if (ev) buildEventForm(body, ev, appData, ts, close, onSave, onDelete);
    else body.append(el("p", { class: "gtl-panel-muted" }, ["Event not found."]));

  } else if (item.kind === "scenes") {
    const sc = (appData.scenes ?? []).find(s => s.id === item.sceneId);
    buildSceneForm(body, sc, item, appData, ts, close, onSave);

  } else if (item.kind === "anomalies") {
    const a = (appData.anomalies ?? []).find(x => x.id === item.anomalyId);
    buildAnomalyForm(body, a, item, appData, ts, close, onSave);

  } else {
    const ch = (appData.characters ?? []).find(x => x.id === item.characterId);
    buildCharForm(body, ch, item, appData, ts, close, onSave);
  }

  containerEl.append(panel);
}

function buildSceneForm(body, sc, item, appData, ts, close, onSave) {
  if (!sc) { body.append(el("p", { class: "gtl-panel-muted" }, ["Scene not found."])); return; }

  const titleInput = el("input", { type: "text", class: "sheet-input", placeholder: "Title…" });
  titleInput.value = sc.title ?? "";

  const dateInput = el("input", { type: "date", class: "sheet-input" });
  if (sc.sceneDate) dateInput.value = sc.sceneDate;

  const statusSel = el("select", { class: "sheet-input" });
  for (const s of SCENE_STATUSES) {
    const opt = el("option", { value: s }, [s]);
    if (s === sc.status) opt.selected = true;
    statusSel.append(opt);
  }

  const { symbolSel, colorInput, colorResetBtn, getColor, useDefault } =
    colorSymbolFields(sc.symbol, sc.color, ts.scenes.color);

  body.append(
    pfield("Title",  titleInput),
    pfield("Date",   dateInput),
    pfield("Status", statusSel),
    pfield("Symbol", symbolSel),
    colorField(colorInput, colorResetBtn),
  );

  const saveBtn = el("button", { class: "btn-primary" }, ["Save"]);
  saveBtn.addEventListener("click", async () => {
    sc.title     = titleInput.value.trim();
    sc.sceneDate = dateInput.value || null;
    sc.status    = statusSel.value;
    sc.symbol    = symbolSel.value || null;
    sc.color     = useDefault() ? null : getColor();
    sc.updatedAt = new Date().toISOString();
    const idx = appData.scenes.findIndex(s => s.id === sc.id);
    if (idx >= 0) appData.scenes[idx] = sc;
    await save("scenes", appData.scenes);
    close(); onSave?.();
  });

  const navBtn = el("button", { class: "btn-secondary" }, ["Open Scene →"]);
  navBtn.addEventListener("click", () => { close(); navigate(`scenes/${sc.id}`); });
  body.append(el("div", { class: "gtl-panel-footer" }, [saveBtn, navBtn]));
}

function buildAnomalyForm(body, a, item, appData, ts, close, onSave) {
  if (!a) { body.append(el("p", { class: "gtl-panel-muted" }, ["Anomaly not found."])); return; }

  const isObs = String(item.id).startsWith("anomaly-obs:");

  const titleInput = el("input", { type: "text", class: "sheet-input", placeholder: "Name…" });
  titleInput.value = a.title ?? "";

  const statusSel = el("select", { class: "sheet-input" });
  for (const s of ANOMALY_STATUSES) {
    const opt = el("option", { value: s }, [s]);
    if (s === a.status) opt.selected = true;
    statusSel.append(opt);
  }

  const { symbolSel, colorInput, colorResetBtn, getColor, useDefault } =
    colorSymbolFields(a.symbol, a.color, ts.anomalies.color);

  body.append(pfield("Name", titleInput), pfield("Status", statusSel));

  if (!isObs) {
    const dateInput = el("input", { type: "date", class: "sheet-input" });
    if (a.discoveryDate) dateInput.value = a.discoveryDate;
    body.append(pfield("Discovery date", dateInput));

    const saveBtn = el("button", { class: "btn-primary" }, ["Save"]);
    saveBtn.addEventListener("click", async () => {
      a.title         = titleInput.value.trim();
      a.status        = statusSel.value;
      a.discoveryDate = dateInput.value || null;
      a.symbol        = symbolSel.value || null;
      a.color         = useDefault() ? null : getColor();
      a.updatedAt     = new Date().toISOString();
      const idx = appData.anomalies.findIndex(x => x.id === a.id);
      if (idx >= 0) appData.anomalies[idx] = a;
      await save("anomalies", appData.anomalies);
      close(); onSave?.();
    });
    body.append(pfield("Symbol", symbolSel), colorField(colorInput, colorResetBtn));
    const navBtn = el("button", { class: "btn-secondary" }, ["Open Anomaly →"]);
    navBtn.addEventListener("click", () => { close(); navigate(`anomalies/${a.id}`); });
    body.append(el("div", { class: "gtl-panel-footer" }, [saveBtn, navBtn]));
  } else {
    // Observation: symbol/color apply to the parent anomaly; date is read-only
    body.append(
      pfield("Observation date", el("span", { class: "gtl-panel-field-value" }, [
        item.dateRaw ? formatFlexibleDate(item.dateRaw) : "",
      ])),
      pfield("Symbol", symbolSel),
      colorField(colorInput, colorResetBtn),
    );
    const saveBtn = el("button", { class: "btn-primary" }, ["Save"]);
    saveBtn.addEventListener("click", async () => {
      a.title    = titleInput.value.trim();
      a.status   = statusSel.value;
      a.symbol   = symbolSel.value || null;
      a.color    = useDefault() ? null : getColor();
      a.updatedAt = new Date().toISOString();
      const idx = appData.anomalies.findIndex(x => x.id === a.id);
      if (idx >= 0) appData.anomalies[idx] = a;
      await save("anomalies", appData.anomalies);
      close(); onSave?.();
    });
    const navBtn = el("button", { class: "btn-secondary" }, ["Open Anomaly →"]);
    navBtn.addEventListener("click", () => { close(); navigate(`anomalies/${a.id}`); });
    body.append(el("div", { class: "gtl-panel-footer" }, [saveBtn, navBtn]));
  }
}

function buildCharForm(body, ch, item, appData, ts, close, onSave) {
  if (!ch) { body.append(el("p", { class: "gtl-panel-muted" }, ["Character not found."])); return; }

  const isBirth  = item.kind === "births";
  const dateKey  = isBirth ? "birthday"    : "deathDate";
  const symKey   = isBirth ? "birthSymbol" : "deathSymbol";
  const colKey   = isBirth ? "birthColor"  : "deathColor";
  const typeKey  = isBirth ? "births"      : "deaths";

  const dateInput = el("input", {
    type: "text", class: "sheet-input",
    placeholder: "YYYY, YYYY-MM, or YYYY-MM-DD",
  });
  dateInput.value = ch[dateKey] ?? "";

  const { symbolSel, colorInput, colorResetBtn, getColor, useDefault } =
    colorSymbolFields(ch[symKey], ch[colKey], ts[typeKey].color);

  body.append(
    pfield(isBirth ? "Birth date" : "Death date", dateInput),
    pfield("Symbol", symbolSel),
    colorField(colorInput, colorResetBtn),
  );

  const saveBtn = el("button", { class: "btn-primary" }, ["Save"]);
  saveBtn.addEventListener("click", async () => {
    ch[dateKey]  = dateInput.value.trim() || null;
    ch[symKey]   = symbolSel.value || null;
    ch[colKey]   = useDefault() ? null : getColor();
    ch.updatedAt = new Date().toISOString();
    const idx = appData.characters.findIndex(c => c.id === ch.id);
    if (idx >= 0) appData.characters[idx] = ch;
    await save("characters", appData.characters);
    close(); onSave?.();
  });

  const navBtn = el("button", { class: "btn-secondary" }, ["Open Character →"]);
  navBtn.addEventListener("click", () => { close(); navigate(`characters/${ch.id}`); });
  body.append(el("div", { class: "gtl-panel-footer" }, [saveBtn, navBtn]));
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function colorSymbolFields(currentSymbol, currentColor, defaultColor) {
  const symbolSel = el("select", { class: "sheet-input" });
  symbolSel.append(el("option", { value: "" }, ["— Type default —"]));
  for (const sym of SYMBOLS) {
    const opt = el("option", { value: sym.value }, [sym.label]);
    if (sym.value === currentSymbol) opt.selected = true;
    symbolSel.append(opt);
  }
  if (!currentSymbol) symbolSel.value = "";

  let _useDefault = !currentColor;
  const colorInput = el("input", { type: "color", class: "gtl-panel-color-input" });
  colorInput.value = currentColor || defaultColor;
  colorInput.addEventListener("input", () => { _useDefault = false; });

  const colorResetBtn = el("button", { class: "btn-link gtl-panel-color-reset" }, ["Reset to default"]);
  colorResetBtn.addEventListener("click", () => { _useDefault = true; colorInput.value = defaultColor; });

  return {
    symbolSel,
    colorInput,
    colorResetBtn,
    getColor:   () => colorInput.value,
    useDefault: () => _useDefault,
  };
}

function colorField(colorInput, colorResetBtn) {
  return el("div", { class: "gtl-panel-field" }, [
    el("span", { class: "gtl-panel-field-label" }, ["Color"]),
    el("div", { class: "gtl-panel-color-wrap" }, [colorInput, colorResetBtn]),
  ]);
}

function buildEventForm(body, ev, appData, ts, close, onSave, onDelete) {
  const dp = parseDateField(ev.date);

  const titleInput = el("input", { type: "text", class: "sheet-input", placeholder: "Title…" });
  titleInput.value = ev.title ?? "";

  const precSel = el("select", { class: "sheet-input" });
  for (const [v, l] of [["year","Year"],["month","Month"],["day","Day"]]) {
    const opt = el("option", { value: v }, [l]);
    if (v === dp.precision) opt.selected = true;
    precSel.append(opt);
  }

  const yearInput = el("input", { type: "number", class: "sheet-input", placeholder: "Year…", min: "1", max: "9999" });
  yearInput.value = dp.year;

  const monthSel = el("select", { class: "sheet-input" });
  for (let i = 1; i <= 12; i++) {
    const opt = el("option", { value: String(i).padStart(2, "0") }, [MONTHS[i - 1]]);
    if (i === dp.month) opt.selected = true;
    monthSel.append(opt);
  }

  const dayInput = el("input", { type: "date", class: "sheet-input" });
  if (dp.precision === "day" && dp.fullDate) dayInput.value = dp.fullDate;

  const dateWrap = el("div", { class: "ptl-date-fields" });
  function renderDateFields() {
    clear(dateWrap);
    const p = precSel.value;
    if (p === "year")       dateWrap.append(yearInput);
    else if (p === "month") dateWrap.append(yearInput, monthSel);
    else                    dateWrap.append(dayInput);
  }
  renderDateFields();
  precSel.addEventListener("change", renderDateFields);

  function buildDateString() {
    const p = precSel.value;
    if (p === "year")  { const y = yearInput.value.trim(); return y || null; }
    if (p === "month") { const y = yearInput.value.trim(); return y ? `${y}-${monthSel.value}` : null; }
    return dayInput.value || null;
  }

  const symbolSel = el("select", { class: "sheet-input" });
  symbolSel.append(el("option", { value: "" }, ["— Type default —"]));
  for (const sym of SYMBOLS) {
    const opt = el("option", { value: sym.value }, [sym.label]);
    if (sym.value === ev.symbol) opt.selected = true;
    symbolSel.append(opt);
  }
  if (!ev.symbol) symbolSel.value = "";

  let useCustomColor = !!ev.color;
  const defaultColor = ts.events.color;

  const colorInput = el("input", { type: "color", class: "gtl-panel-color-input" });
  colorInput.value = ev.color || defaultColor;
  colorInput.addEventListener("input", () => { useCustomColor = true; });

  const colorResetBtn = el("button", { class: "btn-link gtl-panel-color-reset" }, ["Reset to default"]);
  colorResetBtn.addEventListener("click", () => {
    useCustomColor = false;
    colorInput.value = defaultColor;
  });

  const notesTA = el("textarea", { class: "sheet-input gtl-panel-notes", placeholder: "Notes…", rows: "3" });
  notesTA.value = ev.body ?? "";

  body.append(
    pfield("Title",     titleInput),
    pfield("Precision", precSel),
    pfield("Date",      dateWrap),
    pfield("Symbol",    symbolSel),
    el("div", { class: "gtl-panel-field" }, [
      el("span", { class: "gtl-panel-field-label" }, ["Color"]),
      el("div", { class: "gtl-panel-color-wrap" }, [colorInput, colorResetBtn]),
    ]),
    pfield("Notes", notesTA),
  );

  const saveBtn   = el("button", { class: "btn-primary" }, ["Save"]);
  const deleteBtn = el("button", { class: "btn-danger" }, ["Delete"]);

  saveBtn.addEventListener("click", async () => {
    ev.title     = titleInput.value.trim();
    ev.date      = buildDateString();
    ev.symbol    = symbolSel.value || null;
    ev.color     = useCustomColor ? colorInput.value : null;
    ev.body      = notesTA.value;
    ev.updatedAt = new Date().toISOString();

    const idx = appData.timelineEvents.findIndex(e => e.id === ev.id);
    if (idx >= 0) appData.timelineEvents[idx] = ev;
    await save("timelineEvents", appData.timelineEvents);
    close();
    onSave?.();
  });

  deleteBtn.addEventListener("click", async () => {
    appData.timelineEvents = appData.timelineEvents.filter(e => e.id !== ev.id);
    await save("timelineEvents", appData.timelineEvents);
    close();
    onDelete?.();
  });

  body.append(el("div", { class: "gtl-panel-footer" }, [saveBtn, deleteBtn]));
}

function pfield(label, control) {
  return el("div", { class: "gtl-panel-field" }, [
    el("span", { class: "gtl-panel-field-label" }, [label]),
    control,
  ]);
}
