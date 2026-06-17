import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { syncFactionMembership } from "../schema.js";

const OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function textInput(value, attrs = {}) {
  const input = el("input", { type: "text", class: "sheet-input", ...attrs });
  input.value = value ?? "";
  return input;
}

function sheetTextarea(value) {
  const ta = el("textarea", { class: "sheet-textarea" });
  ta.value = value ?? "";
  return ta;
}

export function mountCharacterSheet(container, appData, id) {
  const character = appData.characters.find(c => c.id === id);
  if (!character) {
    container.append(el("p", { class: "placeholder-view" }, ["Character not found."]));
    return;
  }

  let savedPill = null;

  function persist() {
    character.updatedAt = new Date().toISOString();
    save("characters", appData.characters).then(() => {
      if (savedPill) savedPill.remove();
      savedPill = el("span", { class: "saved-pill" }, ["Saved"]);
      container.append(savedPill);
      setTimeout(() => { savedPill?.remove(); savedPill = null; }, 2000);
    });
  }

  const debouncedSave = debounce(persist, 400);

  function handleDelete() {
    if (!confirm(`Delete "${character.name}"? This cannot be undone.`)) return;
    const idx = appData.characters.findIndex(c => c.id === id);
    if (idx !== -1) appData.characters.splice(idx, 1);
    save("characters", appData.characters).then(() => navigate("characters"));
  }

  // ── Header ──
  const nameInput = el("input", {
    type: "text",
    class: "sheet-name-input",
    placeholder: "Character name",
  });
  nameInput.value = character.name;
  nameInput.addEventListener("input", () => {
    character.name = nameInput.value;
    debouncedSave();
  });

  const ownerSelect = el("select", { class: "sheet-owner-select" });
  for (const o of OWNERS) {
    const opt = el("option", { value: o }, [o]);
    if (character.owner === o) opt.selected = true;
    ownerSelect.append(opt);
  }
  ownerSelect.addEventListener("change", () => {
    character.owner = ownerSelect.value;
    debouncedSave();
  });

  const deceasedCheck = el("input", {
    type: "checkbox",
    id: "sheet-deceased",
    class: "sheet-checkbox",
  });
  deceasedCheck.checked = !!character.deceased;
  deceasedCheck.addEventListener("change", () => {
    character.deceased = deceasedCheck.checked;
    debouncedSave();
  });

  const header = el("div", { class: "sheet-header" }, [
    el("a", { class: "sheet-back", href: "#/characters" }, ["← Characters"]),
    nameInput,
    el("div", { class: "sheet-header-controls" }, [
      ownerSelect,
      el("label", { class: "sheet-deceased-label", for: "sheet-deceased" }, [
        deceasedCheck,
        "Deceased",
      ]),
      el("button", { class: "btn-danger", onclick: handleDelete }, ["Delete"]),
    ]),
  ]);

  // ── Identity ──
  const ageInput = el("input", {
    type: "number",
    class: "sheet-input sheet-input--narrow",
    placeholder: "Age",
    min: "0",
    max: "999",
  });
  ageInput.value = character.age ?? "";
  ageInput.addEventListener("input", () => {
    character.age = ageInput.value !== "" ? Number(ageInput.value) : null;
    debouncedSave();
  });

  const birthdayInput = textInput(character.birthday, { placeholder: "Birthday" });
  birthdayInput.addEventListener("input", () => {
    character.birthday = birthdayInput.value || null;
    debouncedSave();
  });

  const sunInput = textInput(character.zodiac.sun, { placeholder: "Sun" });
  sunInput.addEventListener("input", () => {
    character.zodiac.sun = sunInput.value || null;
    debouncedSave();
  });

  const moonInput = textInput(character.zodiac.moon, { placeholder: "Moon" });
  moonInput.addEventListener("input", () => {
    character.zodiac.moon = moonInput.value || null;
    debouncedSave();
  });

  const risingInput = textInput(character.zodiac.rising, { placeholder: "Rising" });
  risingInput.addEventListener("input", () => {
    character.zodiac.rising = risingInput.value || null;
    debouncedSave();
  });

  const identityBlock = el("section", { class: "sheet-section" }, [
    el("h3", { class: "sheet-section-title" }, ["Identity"]),
    el("div", { class: "sheet-row" }, [
      el("label", { class: "sheet-label" }, ["Age", ageInput]),
      el("label", { class: "sheet-label" }, ["Birthday", birthdayInput]),
    ]),
    el("div", { class: "sheet-row" }, [
      el("label", { class: "sheet-label" }, ["Sun", sunInput]),
      el("label", { class: "sheet-label" }, ["Moon", moonInput]),
      el("label", { class: "sheet-label" }, ["Rising", risingInput]),
    ]),
  ]);

  // ── Summary ──
  const summaryTa = sheetTextarea(character.summary);
  summaryTa.addEventListener("input", () => {
    character.summary = summaryTa.value;
    debouncedSave();
  });

  // ── Sheet sections ──
  function makeSheetSection(key, label) {
    const ta = sheetTextarea(character.sheet[key]);
    ta.addEventListener("input", () => {
      character.sheet[key] = ta.value;
      debouncedSave();
    });
    return el("section", { class: "sheet-section" }, [
      el("h3", { class: "sheet-section-title" }, [label]),
      ta,
    ]);
  }

  // ── Faction picker ──
  const factionPickerEl = el("div", { class: "faction-picker" });

  function persistMembership() {
    Promise.all([
      save("characters", appData.characters),
      save("factions", appData.factions),
    ]).then(() => {
      if (savedPill) savedPill.remove();
      savedPill = el("span", { class: "saved-pill" }, ["Saved"]);
      container.append(savedPill);
      setTimeout(() => { savedPill?.remove(); savedPill = null; }, 2000);
    });
  }

  function renderFactionPicker() {
    clear(factionPickerEl);
    const chipRow = el("div", { class: "sheet-faction-chips" });
    if (character.factionIds?.length) {
      for (const fId of character.factionIds) {
        const f = appData.factions.find(f2 => f2.id === fId);
        const chip = el("span", { class: "faction-chip faction-chip--removable" }, [
          el("a", { class: "faction-chip-name", href: `#/factions/${fId}` },
            [f?.name ?? "Unknown"]),
          el("button", { class: "faction-chip-remove", onclick: () => removeFaction(fId) }, ["×"]),
        ]);
        if (f?.color) {
          chip.style.background = f.color;
          chip.style.color = chipTextColor(f.color);
        }
        chipRow.append(chip);
      }
    } else {
      chipRow.append(el("span", { class: "sheet-empty-note" }, ["No factions assigned."]));
    }

    const available = appData.factions.filter(f => !character.factionIds?.includes(f.id));
    const addSelect = el("select", { class: "sheet-add-faction-select" });
    addSelect.append(el("option", { value: "" }, ["Add faction…"]));
    for (const f of available) {
      addSelect.append(el("option", { value: f.id }, [f.name]));
    }
    addSelect.addEventListener("change", () => {
      if (!addSelect.value) return;
      addFaction(addSelect.value);
    });

    factionPickerEl.append(chipRow);
    if (available.length) factionPickerEl.append(addSelect);
  }

  function addFaction(fId) {
    const f = appData.factions.find(f2 => f2.id === fId);
    if (!f || f.memberIds.includes(character.id)) return;
    f.memberIds.push(character.id);
    syncFactionMembership(appData.characters, appData.factions);
    persistMembership();
    renderFactionPicker();
  }

  function removeFaction(fId) {
    const f = appData.factions.find(f2 => f2.id === fId);
    if (!f) return;
    const idx = f.memberIds.indexOf(character.id);
    if (idx !== -1) f.memberIds.splice(idx, 1);
    syncFactionMembership(appData.characters, appData.factions);
    persistMembership();
    renderFactionPicker();
  }

  renderFactionPicker();

  container.append(
    header,
    el("div", { class: "sheet-body" }, [
      identityBlock,
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Summary"]),
        summaryTa,
      ]),
      makeSheetSection("secrets", "Secrets"),
      makeSheetSection("family", "Family"),
      makeSheetSection("skills", "Skills"),
      makeSheetSection("fears", "Fears"),
      makeSheetSection("weaknesses", "Weaknesses"),
      makeSheetSection("notes", "Notes"),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Factions"]),
        factionPickerEl,
      ]),
    ])
  );
}
