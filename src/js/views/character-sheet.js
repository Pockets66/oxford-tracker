import { el } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";

const OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];

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

  // ── Factions (read-only until Slice 3) ──
  const factionsContent = character.factionIds?.length
    ? el("div", { class: "sheet-faction-chips" }, [
        ...character.factionIds.map(fId => el("span", { class: "faction-chip" }, [fId])),
      ])
    : el("p", { class: "sheet-empty-note" }, ["No factions assigned."]);

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
        factionsContent,
      ]),
    ])
  );
}
