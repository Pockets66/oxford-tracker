import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { SCENE_STATUSES, SCENE_ROLES, displayName } from "../schema.js";
import { parseFlexibleDate } from "../dates.js";
import { createCombobox } from "../components/combobox.js";

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function autoresize(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
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

// ── Smart character ordering ────────────────────────────────────────────────

function buildCharItems(scene, appData) {
  const already = new Set(scene.characters.map(s => s.characterId));
  const candidates = appData.characters.filter(c => !already.has(c.id));

  const sceneFactionMembers = new Set();
  for (const fid of scene.factionIds) {
    const f = appData.factions.find(x => x.id === fid);
    if (f) for (const cid of f.memberIds) sceneFactionMembers.add(cid);
  }

  const sceneCharIds = new Set(scene.characters.map(s => s.characterId));
  const connectedToSceneChars = new Set();
  for (const r of appData.relationships) {
    if (sceneCharIds.has(r.from)) connectedToSceneChars.add(r.to);
    if (sceneCharIds.has(r.to))   connectedToSceneChars.add(r.from);
  }

  function priority(c) {
    if (sceneFactionMembers.has(c.id)) return 0;
    if (connectedToSceneChars.has(c.id)) return 1;
    return 2;
  }

  const withPriority = candidates
    .map(c => ({ c, p: priority(c) }))
    .sort((a, b) => a.p !== b.p ? a.p - b.p : displayName(a.c).localeCompare(displayName(b.c)));

  const items = [];
  let lastP = -1;
  for (const { c, p } of withPriority) {
    if (items.length > 0 && p !== lastP) items.push({ divider: true });
    lastP = p;
    const dn  = displayName(c);
    const aka = c.aliases?.[0] && c.aliases[0] !== dn ? ` (${c.aliases[0]})` : "";
    items.push({ value: c.id, label: dn + aka });
  }
  return items;
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

  // ── Faction section ──
  const factionSectionEl = el("div", { class: "scene-page-section" });

  function renderFactionSection() {
    clear(factionSectionEl);

    const chips = el("div", { class: "scene-page-chips" });
    for (const fid of scene.factionIds) {
      const f = appData.factions.find(x => x.id === fid);
      const chip = el("span", { class: "scene-page-faction-chip" }, [
        f ? f.name : fid,
        el("button", { class: "scene-page-chip-remove", onclick: () => {
          scene.factionIds = scene.factionIds.filter(id => id !== fid);
          persist();
          renderFactionSection();
          renderCharSection();
        }}, ["×"]),
      ]);
      if (f?.color) {
        chip.style.background = f.color;
        chip.style.color = chipTextColor(f.color);
      }
      chips.append(chip);
    }

    const remaining = appData.factions
      .filter(f => !scene.factionIds.includes(f.id))
      .map(f => ({ value: f.id, label: f.name }));

    let pendingFactionId = "";
    const factionCb = createCombobox({
      items: remaining,
      value: "",
      placeholder: "Add faction…",
      onChange: (val) => { pendingFactionId = val; },
    });

    const addBtn = el("button", { class: "btn-small", onclick: () => {
      if (!pendingFactionId || scene.factionIds.includes(pendingFactionId)) return;
      scene.factionIds.push(pendingFactionId);
      pendingFactionId = "";
      persist();
      renderFactionSection();
      renderCharSection();
    }}, ["Add"]);

    factionSectionEl.append(
      sectionLabel("Factions"),
      el("div", { class: "scene-page-add-row" }, [factionCb, addBtn]),
      chips,
    );
  }

  // ── Characters section ──
  const charSectionEl = el("div", { class: "scene-page-section" });

  function renderCharSection() {
    clear(charSectionEl);

    // Current characters list
    const listEl = el("div", { class: "scene-page-char-list" });
    for (const sc of scene.characters) {
      const c = appData.characters.find(x => x.id === sc.characterId);
      const name = c ? displayName(c) : sc.characterId;

      const roleEl = el("select", { class: "scene-page-char-role" });
      for (const r of SCENE_ROLES) {
        const opt = el("option", { value: r }, [r]);
        if (r === sc.role) opt.selected = true;
        roleEl.append(opt);
      }
      roleEl.addEventListener("change", () => { sc.role = roleEl.value; persist(); });

      const removeBtn = el("button", { class: "scene-page-char-remove", onclick: () => {
        scene.characters = scene.characters.filter(x => x.characterId !== sc.characterId);
        persist();
        renderCharSection();
      }}, ["×"]);

      listEl.append(el("div", { class: "scene-page-char-row" }, [
        el("span", { class: "scene-page-char-name" }, [name]),
        el("span", { class: "scene-page-char-sep" }, [" — "]),
        roleEl,
        removeBtn,
      ]));
    }

    // Add row with smart-sorted combobox + role select + Add button
    const charItems = buildCharItems(scene, appData);
    let pendingCharId = "";

    const charCb = createCombobox({
      items: charItems,
      value: "",
      placeholder: "Add character…",
      presorted: true,
      onChange: (val) => { pendingCharId = val; },
    });

    const roleSel = el("select", { class: "scene-page-role-select" });
    for (const r of SCENE_ROLES) {
      roleSel.append(el("option", { value: r }, [r]));
    }

    const addBtn = el("button", { class: "btn-small", onclick: () => {
      if (!pendingCharId) return;
      if (scene.characters.some(sc => sc.characterId === pendingCharId)) return;
      scene.characters.push({ characterId: pendingCharId, role: roleSel.value });
      pendingCharId = "";
      persist();
      renderCharSection();
    }}, ["Add"]);

    charSectionEl.append(
      sectionLabel("Characters"),
      el("div", { class: "scene-page-add-row" }, [charCb, roleSel, addBtn]),
      listEl,
    );
  }

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

  // Initial renders
  renderFactionSection();
  renderCharSection();

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
      factionSectionEl,
      charSectionEl,
      section("Notes", notesTa),
      el("div", { class: "scene-page-delete-row" }, [deleteBtn]),
    ]),
  );

  for (const ta of [beatsTa, goalsTa, summaryTa, bodyTa, notesTa]) autoresize(ta);
}
