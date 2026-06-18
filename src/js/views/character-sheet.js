import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { syncFactionMembership, displayName, computeAge, LANGUAGE_LEVELS } from "../schema.js";
import { sunSignFromDate } from "../zodiac.js";
import { openRelationshipDialog } from "./relationship-dialog.js";
import { createCombobox } from "../components/combobox.js";
import { formatLongDate } from "../dates.js";

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

// opts.withPrimary: show "display as primary name" checkbox per chip
// opts.withAka: show "display as a.k.a." checkbox per chip
function makeNameList(ch, key, label, onSave, opts = {}) {
  const summaryEl = el("summary", { class: "name-list-summary" });
  const chipsEl   = el("div",    { class: "name-chips" });
  const addInput  = el("input",  { type: "text", class: "sheet-input", placeholder: "Add…" });
  const addBtn    = el("button", { class: "btn-small", onclick: add }, ["Add"]);
  addInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });

  function render() {
    summaryEl.textContent = `${label} (${(ch[key] ?? []).length})`;
    clear(chipsEl);
    (ch[key] ?? []).forEach((v, i) => {
      const removeBtn = el("button", { class: "name-chip-remove" }, ["×"]);
      removeBtn.addEventListener("click", () => {
        if (opts.withPrimary) {
          if (ch.displayAliasIndex === i) ch.displayAliasIndex = null;
          else if (ch.displayAliasIndex != null && ch.displayAliasIndex > i) ch.displayAliasIndex--;
        }
        if (opts.withAka) {
          ch.akaAliasIndices = (ch.akaAliasIndices ?? [])
            .filter(x => x !== i)
            .map(x => x > i ? x - 1 : x);
        }
        ch[key].splice(i, 1);
        onSave();
        render();
      });

      const chipChildren = [];
      if (opts.withPrimary) {
        const primaryCheck = el("input", { type: "checkbox", class: "alias-primary-check", title: "Display as primary name" });
        primaryCheck.checked = ch.displayAliasIndex === i;
        primaryCheck.addEventListener("change", () => {
          ch.displayAliasIndex = primaryCheck.checked ? i : null;
          onSave();
          render();
        });
        chipChildren.push(primaryCheck);
      }
      if (opts.withAka) {
        const akaCheck = el("input", { type: "checkbox", class: "alias-aka-check", title: "Show as a.k.a. on card" });
        akaCheck.checked = (ch.akaAliasIndices ?? []).includes(i);
        akaCheck.addEventListener("change", () => {
          ch.akaAliasIndices = ch.akaAliasIndices ?? [];
          if (akaCheck.checked) {
            if (!ch.akaAliasIndices.includes(i)) ch.akaAliasIndices.push(i);
          } else {
            ch.akaAliasIndices = ch.akaAliasIndices.filter(x => x !== i);
          }
          onSave();
        });
        chipChildren.push(akaCheck);
      }
      chipChildren.push(v, removeBtn);
      chipsEl.append(el("span", { class: "name-chip" }, chipChildren));
    });
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

// ── Printed view ─────────────────────────────────────────────────────────────

function renderPrintedSheet(container, character, appData, onEdit) {
  const name = displayName(character);
  const akas = (character.akaAliasIndices ?? [])
    .map(i => character.aliases?.[i]).filter(Boolean);

  const computedAge  = computeAge(character, appData.meta?.currentDate);
  const displayAge   = computedAge ?? character.age;
  const birthdayStr  = character.birthday ? formatLongDate(character.birthday) : null;
  const deathStr     = character.deathDate ? formatLongDate(character.deathDate) : null;

  const sun    = character.zodiac?.sun;
  const moon   = character.zodiac?.moon;
  const rising = character.zodiac?.rising;
  const moonRisingParts = [
    moon   ? `Moon in ${moon}`  : null,
    rising ? `Rising ${rising}` : null,
  ].filter(Boolean);

  const factions    = (character.factionIds ?? []).map(fId => appData.factions.find(f => f.id === fId)).filter(Boolean);
  const langs       = character.languages ?? [];
  const rels        = (appData.relationships ?? []).filter(r => r.from === character.id);
  const secretsKnown = (appData.secrets ?? []).filter(s => !s.archived && (s.knownToIds ?? []).includes(character.id));
  const hiddenFrom  = (appData.secrets ?? []).filter(s => !s.archived && (s.hiddenFromIds ?? []).includes(character.id));

  function psection(title, ...nodes) {
    const kids = nodes.filter(Boolean);
    if (!kids.length) return null;
    return el("section", { class: "printed-section" }, [
      el("div", { class: "printed-rule" }, [el("span", { class: "printed-rule-title" }, [title])]),
      ...kids,
    ]);
  }

  const editBtn = el("button", { class: "sheet-edit-btn", title: "Edit" });
  editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
  editBtn.addEventListener("click", onEdit);

  // Identity section
  const ageBornParts = [];
  if (displayAge !== null && displayAge !== undefined) ageBornParts.push(`Age ${displayAge}`);
  if (birthdayStr) ageBornParts.push(`Born ${birthdayStr}`);

  // Relationship rows
  const relsSorted = [...rels].sort((a, b) => {
    const ao = appData.characters.find(c => c.id === a.to);
    const bo = appData.characters.find(c => c.id === b.to);
    if ((ao?.deceased ? 1 : 0) !== (bo?.deceased ? 1 : 0)) return (ao?.deceased ? 1 : 0) - (bo?.deceased ? 1 : 0);
    return displayName(ao ?? {}).localeCompare(displayName(bo ?? {}));
  });

  const relRows = relsSorted.map(rel => {
    const other = appData.characters.find(c => c.id === rel.to);
    const typeParts = [];
    if (rel.structuralType) typeParts.push(rel.structuralType);
    if (rel.socialLabels?.length) typeParts.push(...rel.socialLabels);
    const typeStr  = typeParts.join(", ");
    const feelStr  = [rel.platonic, rel.romantic].filter(Boolean).join(" · ");
    return el("div", { class: "printed-rel-row" + (other?.deceased ? " printed-rel-row--deceased" : "") }, [
      el("div", { class: "printed-rel-main" }, [
        el("a", { href: `#/characters/${rel.to}`, class: "printed-rel-name" },
          [other ? displayName(other) : "Unknown"]),
        typeStr ? el("span", { class: "printed-rel-type" }, [` — ${typeStr}`]) : null,
      ]),
      feelStr ? el("div", { class: "printed-rel-feelings" }, [feelStr]) : null,
    ]);
  });

  const sheet = el("div", { class: "printed-sheet" }, [
    el("div", { class: "printed-sheet-topbar" }, [
      el("a", { class: "sheet-back", href: "#/characters" }, ["← Characters"]),
      editBtn,
    ]),

    el("div", { class: "printed-header" }, [
      el("h1", { class: "printed-name" }, [name]),
      akas.length ? el("p", { class: "printed-aka" }, [`a.k.a. ${akas.join(", ")}`]) : null,
      el("div", { class: "printed-flourish" }, ["❦"]),
    ]),

    el("p", { class: "printed-owner-line" }, [
      character.owner && character.owner !== "NPC" ? `${character.owner}'s character` : "NPC",
    ]),
    character.deceased
      ? el("p", { class: "printed-deceased-line" }, [
          deathStr ? `Deceased — died ${deathStr}` : "Deceased",
        ])
      : null,

    psection("Identity",
      ageBornParts.length ? el("p", { class: "printed-identity-line" }, [ageBornParts.join(" · ")]) : null,
      character.placeOfBirth ? el("p", { class: "printed-place" }, [character.placeOfBirth]) : null,
    ),

    psection("Astrology",
      sun ? el("p", { class: "printed-astro-sun" }, [sun]) : null,
      moonRisingParts.length ? el("p", { class: "printed-astro-extra" }, [moonRisingParts.join(" · ")]) : null,
    ),

    factions.length ? psection("Factions",
      el("div", { class: "printed-faction-chips" }, factions.map(f => {
        const chip = el("a", { class: "faction-chip faction-chip--link", href: `#/factions/${f.id}` }, [f.name]);
        if (f.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
        return chip;
      }))
    ) : null,

    character.summary    ? el("p",   { class: "printed-summary" },    [character.summary])    : null,
    character.background ? el("div", { class: "printed-background" }, [character.background]) : null,

    langs.length ? psection("Languages",
      el("p", { class: "printed-text" }, [langs.map(l => `${l.name} (${l.level})`).join(" · ")])
    ) : null,

    character.cards?.skills ? psection("Skills",
      el("div", { class: "printed-card-text" }, [character.cards.skills])
    ) : null,

    secretsKnown.length ? psection("Secrets known",
      el("ul", { class: "printed-secret-list" }, secretsKnown.map(s =>
        el("li", {}, [el("a", { href: `#/secrets/${s.id}` }, [s.title || "(untitled)"])])
      ))
    ) : null,

    hiddenFrom.length ? psection("Hidden from me",
      el("ul", { class: "printed-secret-list" }, hiddenFrom.map(s =>
        el("li", {}, [el("a", { href: `#/secrets/${s.id}` }, [s.title || "(untitled)"])])
      ))
    ) : null,

    relsSorted.length ? psection("Relationships",
      el("div", { class: "printed-rels" }, relRows)
    ) : null,

    character.cards?.notes ? psection("Notes",
      el("div", { class: "printed-card-text" }, [character.cards.notes])
    ) : null,
  ]);

  container.append(sheet);
}

// ── Editor (rendered into any container) ─────────────────────────────────────

function renderEditorInto(container, character, appData, onDelete) {
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
    const idx = appData.characters.findIndex(c => c.id === character.id);
    if (idx !== -1) appData.characters.splice(idx, 1);
    save("characters", appData.characters).then(() => {
      navigate("characters");
      onDelete();
    });
  }

  // ── Death date ──
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

  // ── Header inputs ──
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
    while (ageWrapper.childNodes.length > 1) ageWrapper.removeChild(ageWrapper.lastChild);
    if (character.birthday) {
      const age     = computeAge(character, appData.meta?.currentDate);
      const caption = character.deathDate ? "Frozen at death" : "Auto-calculated from birthday";
      ageWrapper.append(
        el("span", { class: "sheet-age-computed" }, [age !== null ? String(age) : "?"]),
        el("span", { class: "sheet-age-caption" }, [caption]),
      );
    } else {
      const inp = el("input", { type: "number", class: "sheet-input sheet-input--narrow", placeholder: "Age", min: "0", max: "999" });
      inp.value = character.age ?? "";
      inp.addEventListener("input", () => { character.age = inp.value !== "" ? Number(inp.value) : null; debouncedSave(); });
      ageWrapper.append(inp);
    }
  }

  renderAgeField();

  // ── Birthday & sun sign ──
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

  // ── Astrological details (collapsible) ──
  const placeInput = el("input", { type: "text", class: "sheet-input sheet-input--wide", placeholder: "Place of birth" });
  placeInput.value = character.placeOfBirth ?? "";
  placeInput.addEventListener("input", () => { character.placeOfBirth = placeInput.value; debouncedSave(); });

  const moonSel = signSelect(character.zodiac.moon);
  moonSel.addEventListener("change", () => { character.zodiac.moon = moonSel.value || null; debouncedSave(); });
  const risingSel = signSelect(character.zodiac.rising);
  risingSel.addEventListener("change", () => { character.zodiac.rising = risingSel.value || null; debouncedSave(); });

  const astroOpen = !!(character.zodiac?.moon || character.zodiac?.rising || character.placeOfBirth);
  const astroBody = el("div", { class: "sheet-astro-extra" }, [
    el("div", { class: "sheet-row" }, [
      el("label", { class: "sheet-label" }, ["Moon ☽", moonSel]),
      el("label", { class: "sheet-label" }, ["Rising ↑", risingSel]),
      el("label", { class: "sheet-label" }, ["Place of birth", placeInput]),
    ]),
  ]);
  if (!astroOpen) astroBody.hidden = true;

  const astroToggleBtn = el("button", { class: "btn-link sheet-astro-toggle" }, [
    astroOpen ? "▾ Astrological details" : "+ More astrological info",
  ]);
  astroToggleBtn.addEventListener("click", () => {
    astroBody.hidden = !astroBody.hidden;
    astroToggleBtn.textContent = astroBody.hidden
      ? "+ More astrological info"
      : "▾ Astrological details";
  });

  const identitySection = el("section", { class: "sheet-section" }, [
    el("h3", { class: "sheet-section-title" }, ["Identity"]),
    el("div", { class: "sheet-row" }, [
      ageWrapper,
      el("label", { class: "sheet-label" }, ["Birthday", birthdayInput]),
      el("label", { class: "sheet-label" }, ["Sun ☀", sunDisplay]),
    ]),
    deathDateRow,
    astroToggleBtn,
    astroBody,
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

  // ── Faction picker (combobox) ──
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
    factionPickerEl.append(chipRow);

    const available = appData.factions.filter(f => !character.factionIds?.includes(f.id));
    if (available.length) {
      const sorted = [...available].sort((a, b) => a.name.localeCompare(b.name));
      const cb = createCombobox({
        items: sorted.map(f => ({ value: f.id, label: f.name })),
        value: "",
        placeholder: "Add faction…",
        onChange: (fId) => { if (fId) addFaction(fId); },
      });
      factionPickerEl.append(cb);
    }
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

  // ── Languages card ──
  function makeLanguagesCard() {
    character.languages ??= [];
    const rowsEl = el("div", { class: "lang-rows" });

    function renderLangRows() {
      clear(rowsEl);
      for (let i = 0; i < character.languages.length; i++) {
        const entry = character.languages[i];
        const idx   = i;
        const removeBtn = el("button", { class: "name-chip-remove lang-remove", onclick: () => {
          character.languages.splice(idx, 1);
          persist();
          renderLangRows();
        }}, ["×"]);
        rowsEl.append(el("div", { class: "lang-row" }, [
          el("span", { class: "lang-name" }, [entry.name]),
          el("span", { class: "lang-sep" }, [" — "]),
          el("span", { class: "lang-level" }, [entry.level]),
          removeBtn,
        ]));
      }
    }

    let selectedLang = "";
    const comboboxWrap = el("div", { class: "lang-combobox-wrap" });

    const levelSel = el("select", { class: "sheet-input lang-level-sel" });
    for (const lv of LANGUAGE_LEVELS) {
      levelSel.append(el("option", { value: lv }, [lv]));
    }

    const addBtn = el("button", { class: "btn-small", onclick: () => {
      if (!selectedLang || selectedLang === "__new__") return;
      character.languages.push({ name: selectedLang, level: levelSel.value });
      selectedLang = "";
      persist();
      renderLangRows();
      rebuildCombobox();
    }}, ["Add"]);

    function rebuildCombobox() {
      clear(comboboxWrap);
      const items = [
        ...(appData.meta.knownLanguages ?? []).sort((a, b) => a.localeCompare(b)).map(l => ({ value: l, label: l })),
        { value: "__new__", label: "+ Add new language…" },
      ];
      comboboxWrap.append(createCombobox({
        items,
        value: "",
        placeholder: "Select language…",
        onChange: (val) => {
          if (val === "__new__") {
            const name = prompt("New language name:")?.trim();
            if (!name) return;
            appData.meta.knownLanguages ??= [];
            if (!appData.meta.knownLanguages.includes(name)) {
              appData.meta.knownLanguages.push(name);
              appData.meta.knownLanguages.sort((a, b) => a.localeCompare(b));
              save("meta", appData.meta);
            }
            selectedLang = name;
            rebuildCombobox();
          } else {
            selectedLang = val;
          }
        },
      }));
    }

    rebuildCombobox();
    renderLangRows();

    return el("div", { class: "lang-card-body" }, [
      rowsEl,
      el("div", { class: "lang-add-row" }, [comboboxWrap, levelSel, addBtn]),
    ]);
  }

  // ── Relationships ──
  const relsEl = el("div", { class: "rels-list" });

  function renderRelationships() {
    clear(relsEl);
    const mine = (appData.relationships ?? []).filter(r => r.from === character.id);

    mine.sort((a, b) => {
      const aOther    = appData.characters.find(c => c.id === a.to);
      const bOther    = appData.characters.find(c => c.id === b.to);
      const aDeceased = aOther?.deceased ? 1 : 0;
      const bDeceased = bOther?.deceased ? 1 : 0;
      if (aDeceased !== bDeceased) return aDeceased - bDeceased;
      return displayName(aOther ?? {}).localeCompare(displayName(bOther ?? {}));
    });

    if (!mine.length) {
      relsEl.append(el("p", { class: "sheet-empty-note" }, ["No relationships yet."]));
      return;
    }

    for (const rel of mine) {
      const other  = appData.characters.find(c => c.id === rel.to);
      const frozen = !!other?.deceased;

      const typeParts = [];
      if (rel.structuralType) typeParts.push(rel.structuralType);
      if (rel.socialLabels?.length) typeParts.push(...rel.socialLabels);
      const typeStr = typeParts.length ? ` — ${typeParts.join(", ")}` : "";

      const feelParts = [rel.platonic, rel.romantic].filter(Boolean);
      const feelStr   = feelParts.join(" · ");

      const editBtn = el("button", { class: "btn-small" }, ["Edit"]);
      editBtn.addEventListener("click", () => {
        openRelationshipDialog(appData, character.id, rel.id, renderRelationships);
      });

      const deleteBtn = el("button", { class: "btn-small btn-small--danger" });
      deleteBtn.addEventListener("click", () => removeRel(rel));
      deleteBtn.textContent = "×";

      const row = el("div", {
        class: "rel-row" + (frozen ? " rel-row--frozen" : ""),
        title: frozen ? "This character is deceased." : "",
      }, [
        el("div", { class: "rel-row-main" }, [
          el("a", { class: "rel-other-name", href: `#/characters/${rel.to}` },
            [other ? displayName(other) : "Unknown"]),
          el("span", { class: "rel-type" }, [typeStr]),
          editBtn,
          deleteBtn,
        ]),
        feelStr ? el("div", { class: "rel-row-feelings" }, [feelStr]) : null,
      ].filter(Boolean));

      relsEl.append(row);
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

  function makeSecretsKnownCard() {
    const secrets = (appData.secrets ?? []).filter(s => !s.archived && (s.knownToIds ?? []).includes(character.id));
    if (!secrets.length) return el("p", { class: "sheet-empty-note" }, ["No known secrets."]);
    const list = el("div", { class: "secret-link-list" });
    for (const s of secrets) {
      list.append(el("a", { class: "secret-link-row", href: `#/secrets/${s.id}` }, [s.title || "(untitled)"]));
    }
    return list;
  }

  function makeHiddenFromCard() {
    const secrets = (appData.secrets ?? []).filter(s => !s.archived && (s.hiddenFromIds ?? []).includes(character.id));
    if (!secrets.length) return el("p", { class: "sheet-empty-note" }, ["Nothing hidden from this character."]);
    const list = el("div", { class: "secret-link-list" });
    for (const s of secrets) {
      list.append(el("a", { class: "secret-link-row", href: `#/secrets/${s.id}` }, [s.title || "(untitled)"]));
    }
    return list;
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
        makeNameList(character, "aliases", "Aliases / codenames", debouncedSave, { withPrimary: true, withAka: true }),
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
            el("button", { class: "btn-small", onclick: async () => {
              const { openRelationshipWeb } = await import("./relationship-web.js");
              openRelationshipWeb(character.id, appData);
            }}, ["Web"]),
            el("button", { class: "btn-small", onclick: () => {
              openRelationshipDialog(appData, character.id, null, renderRelationships);
            }}, ["+ Add"]),
          ]),
          relsEl,
        ]),
      ]),
      el("div", { class: "sheet-cards" }, [
        makeCard("Current Plots", el("p", { class: "sheet-empty-note" }, ["No current plots."])),
        makeCard("Languages", makeLanguagesCard()),
        makeCard("Skills",  cardTa("skills")),
        makeCard("Secrets known", makeSecretsKnownCard()),
        makeCard("Hidden from me", makeHiddenFromCard()),
        makeCard("Notes",   cardTa("notes")),
      ]),
    ])
  );

  bgTa.style.height = "auto";
  bgTa.style.height = (bgTa.scrollHeight || 320) + "px";
}

// ── Edit modal ───────────────────────────────────────────────────────────────

function openCharacterEditor(character, appData, onClose) {
  let closed = false;
  const backdrop = el("div", { class: "ced-backdrop" });
  const modal    = el("div", { class: "ced-modal" });
  const body     = el("div", { class: "ced-body" });

  function detach() {
    document.removeEventListener("keydown", onEsc);
    window.removeEventListener("route-change", onRouteChange);
    backdrop.remove();
  }

  function closeModal() {
    if (closed) return;
    closed = true;
    detach();
    onClose();
  }

  // If navigation happens inside the modal (e.g. clicking a relationship link),
  // the route handler has already rendered the new view — just remove the backdrop.
  function onRouteChange() {
    if (closed) return;
    closed = true;
    detach();
  }

  function onEsc(e) { if (e.key === "Escape") closeModal(); }
  document.addEventListener("keydown", onEsc);
  window.addEventListener("route-change", onRouteChange);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });

  const closeBtn = el("button", { class: "ced-close" }, ["✕"]);
  closeBtn.addEventListener("click", closeModal);

  modal.append(
    el("div", { class: "ced-topbar" }, [
      el("span", { class: "ced-title" }, [`Editing ${displayName(character)}`]),
      closeBtn,
    ]),
    body,
  );
  backdrop.append(modal);
  document.body.append(backdrop);

  renderEditorInto(body, character, appData, () => {
    // handleDelete navigated away — just remove the modal.
    if (closed) return;
    closed = true;
    detach();
  });
}

// ── Main export ──────────────────────────────────────────────────────────────

export function mountCharacterSheet(container, appData, id) {
  const character = appData.characters.find(c => c.id === id);
  if (!character) {
    container.append(el("p", { class: "placeholder-view" }, ["Character not found."]));
    return;
  }

  function show() {
    clear(container);
    renderPrintedSheet(container, character, appData, openEdit);
  }

  function openEdit() {
    openCharacterEditor(character, appData, show);
  }

  show();
}
