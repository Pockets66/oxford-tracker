import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { syncFactionMembership, displayName, computeAge } from "../schema.js";
import { sunSignFromDate } from "../zodiac.js";
import { openRelationshipDialog } from "./relationship-dialog.js";

const OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];
const SIGNS  = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
                 "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

function debounce(fn, delay) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

function signSelect(value) {
  const sel = el("select", { class: "sheet-input" });
  sel.append(el("option", { value: "" }, ["—"]));
  for (const s of SIGNS) {
    const opt = el("option", { value: s }, [s]);
    if (s === value) opt.selected = true;
    sel.append(opt);
  }
  return sel;
}

function makeNameList(ch, key, label, onSave) {
  const summaryEl = el("summary", { class: "name-list-summary" });
  const chipsEl   = el("div",    { class: "name-chips" });
  const addInput  = el("input",  { type: "text", class: "sheet-input", placeholder: "Add…" });
  const addBtn    = el("button", { class: "btn-small", onclick: add }, ["Add"]);
  addInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });

  function render() {
    summaryEl.textContent = `${label} (${(ch[key] ?? []).length})`;
    clear(chipsEl);
    (ch[key] ?? []).forEach((v, i) => chipsEl.append(
      el("span", { class: "name-chip" }, [
        v,
        el("button", { class: "name-chip-remove", onclick: () => {
          ch[key].splice(i, 1); onSave(); render();
        }}, ["×"]),
      ])
    ));
  }

  function add() {
    const v = addInput.value.trim();
    if (!v) return;
    (ch[key] = ch[key] ?? []).push(v);
    addInput.value = "";
    onSave();
    render();
  }

  render();
  return el("details", { class: "name-list-details" }, [
    summaryEl,
    el("div", { class: "name-list-items" }, [
      chipsEl,
      el("div", { class: "name-list-add" }, [addInput, addBtn]),
    ]),
  ]);
}

export function mountCharacterSheet(container, appData, id) {
  const character = appData.characters.find(c => c.id === id);
  if (!character) {
    container.append(el("p", { class: "placeholder-view" }, ["Character not found."]));
    return;
  }

  let savedPill = null;

  function showSavedPill() {
    if (savedPill) savedPill.remove();
    savedPill = el("span", { class: "saved-pill" }, ["Saved"]);
    container.append(savedPill);
    setTimeout(() => { savedPill?.remove(); savedPill = null; }, 2000);
  }

  function persist() {
    character.updatedAt = new Date().toISOString();
    save("characters", appData.characters).then(showSavedPill);
  }
  const debouncedSave = debounce(persist, 400);

  function persistMembership() {
    Promise.all([save("characters", appData.characters), save("factions", appData.factions)])
      .then(showSavedPill);
  }

  function handleDelete() {
    if (!confirm(`Delete "${displayName(character)}"? This cannot be undone.`)) return;
    const idx = appData.characters.findIndex(c => c.id === id);
    if (idx !== -1) appData.characters.splice(idx, 1);
    save("characters", appData.characters).then(() => navigate("characters"));
  }

  // ── Death date (defined early so deceasedCheck listener can reference it) ──
  const deathDateInput = el("input", { type: "date", class: "sheet-input" });
  deathDateInput.value = character.deathDate ?? "";
  deathDateInput.addEventListener("input", () => {
    character.deathDate = deathDateInput.value || null;
    renderAgeField();
    debouncedSave();
  });

  const deathDateRow = el("div", { class: "sheet-row" }, [
    el("label", { class: "sheet-label" }, ["Death date", deathDateInput]),
  ]);
  deathDateRow.hidden = !character.deceased;

  // ── Header: name inputs ──
  const firstInput  = el("input", { type: "text", class: "sheet-name-part name-part--first",  placeholder: "First name" });
  const middleInput = el("input", { type: "text", class: "sheet-name-part name-part--middle", placeholder: "Middle" });
  const lastInput   = el("input", { type: "text", class: "sheet-name-part name-part--last",   placeholder: "Last name" });
  firstInput.value  = character.firstName  ?? "";
  middleInput.value = character.middleName ?? "";
  lastInput.value   = character.lastName   ?? "";
  firstInput.addEventListener("input",  () => { character.firstName  = firstInput.value;  debouncedSave(); });
  middleInput.addEventListener("input", () => { character.middleName = middleInput.value; debouncedSave(); });
  lastInput.addEventListener("input",   () => { character.lastName   = lastInput.value;   debouncedSave(); });

  const ownerSelect = el("select", { class: "sheet-owner-select" });
  for (const o of OWNERS) {
    const opt = el("option", { value: o }, [o]);
    if (character.owner === o) opt.selected = true;
    ownerSelect.append(opt);
  }
  ownerSelect.addEventListener("change", () => { character.owner = ownerSelect.value; debouncedSave(); });

  const deceasedCheck = el("input", { type: "checkbox", id: "sheet-deceased", class: "sheet-checkbox" });
  deceasedCheck.checked = !!character.deceased;
  deceasedCheck.addEventListener("change", () => {
    character.deceased = deceasedCheck.checked;
    if (!character.deceased) {
      character.deathDate = null;
      deathDateInput.value = "";
    }
    deathDateRow.hidden = !character.deceased;
    renderAgeField();
    debouncedSave();
  });

  const header = el("div", { class: "sheet-header" }, [
    el("a", { class: "sheet-back", href: "#/characters" }, ["← Characters"]),
    el("div", { class: "sheet-name-group" }, [firstInput, middleInput, lastInput]),
    el("div", { class: "sheet-header-controls" }, [
      ownerSelect,
      el("label", { class: "sheet-deceased-label", for: "sheet-deceased" }, [deceasedCheck, "Deceased"]),
      el("button", { class: "btn-danger", onclick: handleDelete }, ["Delete"]),
    ]),
  ]);

  // ── Age: mode-aware wrapper ──
  const ageWrapper = el("label", { class: "sheet-label" }, ["Age"]);

  function renderAgeField() {
    // Remove all children except the label text node (first child).
    while (ageWrapper.childNodes.length > 1) ageWrapper.removeChild(ageWrapper.lastChild);

    if (character.birthday) {
      const age = computeAge(character, appData.meta?.currentDate);
      const caption = character.deathDate ? "Frozen at death" : "Auto-calculated from birthday";
      ageWrapper.append(
        el("span", { class: "sheet-age-computed" }, [age !== null ? String(age) : "?"]),
        el("span", { class: "sheet-age-caption" }, [caption]),
      );
    } else {
      const inp = el("input", { type: "number", class: "sheet-input sheet-input--narrow", placeholder: "Age", min: "0", max: "999" });
      inp.value = character.age ?? "";
      inp.addEventListener("input", () => {
        character.age = inp.value !== "" ? Number(inp.value) : null;
        debouncedSave();
      });
      ageWrapper.append(inp);
    }
  }

  renderAgeField();

  // ── Birthday ──
  const birthdayInput = el("input", { type: "date", class: "sheet-input" });
  birthdayInput.value = character.birthday ?? "";

  const sunDisplay = el("span", { class: "sheet-sun-display" }, [character.zodiac.sun ?? "—"]);
  birthdayInput.addEventListener("input", () => {
    character.birthday   = birthdayInput.value || null;
    character.zodiac.sun = sunSignFromDate(character.birthday);
    sunDisplay.textContent = character.zodiac.sun ?? "—";
    renderAgeField();
    debouncedSave();
  });

  const birthTimeInput = el("input", { type: "time", class: "sheet-input" });
  birthTimeInput.value = character.birthTime ?? "";
  birthTimeInput.addEventListener("input", () => { character.birthTime = birthTimeInput.value || null; debouncedSave(); });

  const placeInput = el("input", { type: "text", class: "sheet-input sheet-input--wide", placeholder: "Place of birth" });
  placeInput.value = character.placeOfBirth ?? "";
  placeInput.addEventListener("input", () => { character.placeOfBirth = placeInput.value; debouncedSave(); });

  const moonSel = signSelect(character.zodiac.moon);
  moonSel.addEventListener("change", () => { character.zodiac.moon = moonSel.value || null; debouncedSave(); });
  const risingSel = signSelect(character.zodiac.rising);
  risingSel.addEventListener("change", () => { character.zodiac.rising = risingSel.value || null; debouncedSave(); });

  const identitySection = el("section", { class: "sheet-section" }, [
    el("h3", { class: "sheet-section-title" }, ["Identity"]),
    el("div", { class: "sheet-row" }, [
      ageWrapper,
      el("label", { class: "sheet-label" }, ["Birthday", birthdayInput]),
      el("label", { class: "sheet-label" }, ["Birth time", birthTimeInput]),
      el("label", { class: "sheet-label" }, ["Place of birth", placeInput]),
    ]),
    deathDateRow,
    el("div", { class: "sheet-row" }, [
      el("label", { class: "sheet-label" }, ["Sun ☀", sunDisplay]),
      el("label", { class: "sheet-label" }, ["Moon ☽", moonSel]),
      el("label", { class: "sheet-label" }, ["Rising ↑", risingSel]),
    ]),
  ]);

  // ── Subscribe to campaign date changes ──
  function onDateChange() {
    if (!container.isConnected) { window.removeEventListener("current-date-change", onDateChange); return; }
    renderAgeField();
  }
  window.addEventListener("current-date-change", onDateChange);

  // ── Summary ──
  const summaryTa = el("textarea", { class: "sheet-textarea", rows: "2", placeholder: "Short description shown on the card" });
  summaryTa.value = character.summary ?? "";
  summaryTa.addEventListener("input", () => { character.summary = summaryTa.value; debouncedSave(); });

  // ── Background ──
  const bgTa = el("textarea", { class: "sheet-textarea sheet-textarea--bg", placeholder: "Freeform background and story" });
  bgTa.value = character.background ?? "";
  bgTa.addEventListener("input", () => {
    character.background = bgTa.value;
    bgTa.style.height = "auto";
    bgTa.style.height = bgTa.scrollHeight + "px";
    debouncedSave();
  });

  // ── Faction picker ──
  const factionPickerEl = el("div", { class: "faction-picker" });

  function renderFactionPicker() {
    clear(factionPickerEl);
    const chipRow = el("div", { class: "sheet-faction-chips" });
    if (character.factionIds?.length) {
      for (const fId of character.factionIds) {
        const f    = appData.factions.find(f2 => f2.id === fId);
        const chip = el("span", { class: "faction-chip faction-chip--removable" }, [
          el("a", { class: "faction-chip-name", href: `#/factions/${fId}` }, [f?.name ?? "Unknown"]),
          el("button", { class: "faction-chip-remove", onclick: () => removeFaction(fId) }, ["×"]),
        ]);
        if (f?.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
        chipRow.append(chip);
      }
    } else {
      chipRow.append(el("span", { class: "sheet-empty-note" }, ["No factions assigned."]));
    }
    const available = appData.factions.filter(f => !character.factionIds?.includes(f.id));
    const addSelect = el("select", { class: "sheet-add-faction-select" });
    addSelect.append(el("option", { value: "" }, ["Add faction…"]));
    for (const f of available) addSelect.append(el("option", { value: f.id }, [f.name]));
    addSelect.addEventListener("change", () => { if (addSelect.value) addFaction(addSelect.value); });
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

  // ── Relationships ──
  const relsEl = el("div", { class: "rels-list" });

  function renderRelationships() {
    clear(relsEl);
    const mine = (appData.relationships ?? []).filter(r => r.from === character.id);
    if (!mine.length) {
      relsEl.append(el("p", { class: "sheet-empty-note" }, ["No relationships yet."]));
      return;
    }
    for (const rel of mine) {
      const other = appData.characters.find(c => c.id === rel.to);
      relsEl.append(el("div", { class: "rel-row" }, [
        el("a", { class: "rel-other-name", href: `#/characters/${rel.to}` }, [other ? displayName(other) : "Unknown"]),
        el("span", { class: "rel-type" }, [` — ${rel.type} (${rel.closeness})`]),
        el("button", { class: "btn-small", onclick: () => {
          openRelationshipDialog(appData, character.id, rel.id, renderRelationships);
        }}, ["Edit"]),
        el("button", { class: "btn-small btn-small--danger", onclick: () => removeRel(rel) }, ["×"]),
      ]));
    }
  }

  function removeRel(rel) {
    const other = appData.characters.find(c => c.id === rel.to);
    const name  = other ? displayName(other) : "Unknown";
    if (!confirm(`Remove relationship with ${name}?`)) return;
    const recip = (appData.relationships ?? []).find(r => r.from === rel.to && r.to === rel.from);
    let removeRecip = false;
    if (recip) removeRecip = confirm(`Also remove the reciprocal from ${name}?`);
    appData.relationships = appData.relationships.filter(r => {
      if (r.id === rel.id) return false;
      if (removeRecip && r.id === recip.id) return false;
      return true;
    });
    save("relationships", appData.relationships);
    renderRelationships();
  }

  renderRelationships();

  function makeCard(title, content) {
    return el("div", { class: "sheet-card" }, [
      el("h3", { class: "sheet-card-title" }, [title]),
      content,
    ]);
  }

  function cardTa(key) {
    const ta = el("textarea", { class: "sheet-textarea" });
    ta.value = character.cards?.[key] ?? "";
    ta.addEventListener("input", () => { character.cards[key] = ta.value; debouncedSave(); });
    return ta;
  }

  container.append(
    header,
    el("div", { class: "sheet-layout" }, [
      el("div", { class: "sheet-main" }, [
        makeNameList(character, "previousNames", "Previous names", debouncedSave),
        makeNameList(character, "aliases", "Aliases / codenames", debouncedSave),
        identitySection,
        el("section", { class: "sheet-section" }, [
          el("h3", { class: "sheet-section-title" }, ["Summary"]),
          summaryTa,
        ]),
        el("section", { class: "sheet-section" }, [
          el("h3", { class: "sheet-section-title" }, ["Background"]),
          bgTa,
        ]),
        el("section", { class: "sheet-section" }, [
          el("h3", { class: "sheet-section-title" }, ["Factions"]),
          factionPickerEl,
        ]),
        el("section", { class: "sheet-section" }, [
          el("div", { class: "sheet-section-header" }, [
            el("h3", { class: "sheet-section-title" }, ["Relationships"]),
            el("button", { class: "btn-small", onclick: () => {
              openRelationshipDialog(appData, character.id, null, renderRelationships);
            }}, ["+ Add"]),
          ]),
          relsEl,
        ]),
      ]),
      el("div", { class: "sheet-cards" }, [
        makeCard("Current Plots", el("p", { class: "sheet-empty-note" }, ["No current plots."])),
        makeCard("Skills",  cardTa("skills")),
        makeCard("Secrets", cardTa("secrets")),
        makeCard("Notes",   cardTa("notes")),
      ]),
    ])
  );

  bgTa.style.height = "auto";
  bgTa.style.height = (bgTa.scrollHeight || 320) + "px";
}
