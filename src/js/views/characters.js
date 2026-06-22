import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createCharacter, displayName, computeAge } from "../schema.js";

function chipTextColor(hex) {
  if (!hex || hex.length < 7) return "#f4ecd8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#2a1f15" : "#f4ecd8";
}

const OWNER_VARS = {
  Bree:   "var(--owner-bree)",
  Jack:   "var(--owner-jack)",
  Nicole: "var(--owner-nicole)",
  Caiden: "var(--owner-caiden)",
  NPC:    "var(--owner-npc)",
};

function ownerBorderStyle(ownerStr) {
  const owners = (ownerStr || "NPC").split(",").map(s => s.trim()).filter(Boolean);
  if (owners.length <= 1) {
    return OWNER_VARS[owners[0]] ?? "var(--owner-npc)";
  }
  const stops = owners.flatMap((o, i) => {
    const pct  = (i / owners.length) * 100;
    const next = ((i + 1) / owners.length) * 100;
    const color = OWNER_VARS[o] ?? "var(--owner-npc)";
    return [`${color} ${pct}%`, `${color} ${next}%`];
  });
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

const ALL_OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];
const PERSIST_KEY = "oxford-filters-characters";

const DEFAULT_STATE = {
  search:       "",
  owner:        [...ALL_OWNERS],
  faction:      [],
  language:     [],
  showDeceased: false,
  secret:       [],
};

function loadFilterState() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        search:       s.search       ?? "",
        owner:        Array.isArray(s.owner)    ? s.owner    : [...ALL_OWNERS],
        faction:      Array.isArray(s.faction)  ? s.faction  : [],
        language:     Array.isArray(s.language) ? s.language : [],
        showDeceased: s.showDeceased !== undefined ? s.showDeceased : false,
        secret:       Array.isArray(s.secret)   ? s.secret   : [],
      };
    }
  } catch {}
  return { ...DEFAULT_STATE, owner: [...ALL_OWNERS] };
}

function saveFilterState(state) {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(state)); } catch {}
}

function isFilterModified(state) {
  return !!(
    state.search ||
    state.owner.length < ALL_OWNERS.length ||
    state.faction.length ||
    state.language.length ||
    state.showDeceased ||
    state.secret.length
  );
}

function applyFilters(characters, state, secrets) {
  let result = characters;

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(c =>
      displayName(c).toLowerCase().includes(q) ||
      (c.aliases ?? []).some(a => a.toLowerCase().includes(q)) ||
      (c.previousNames ?? []).some(n => n.toLowerCase().includes(q)) ||
      c.summary.toLowerCase().includes(q)
    );
  }

  if (state.owner.length < ALL_OWNERS.length) {
    result = result.filter(c => {
      const owners = (c.owner || "NPC").split(",").map(s => s.trim());
      return state.owner.some(o => owners.includes(o));
    });
  }

  if (state.faction.length) {
    result = result.filter(c =>
      state.faction.some(fId => (c.factionIds ?? []).includes(fId))
    );
  }

  if (state.language.length) {
    result = result.filter(c =>
      state.language.some(lang =>
        (c.languages ?? []).some(l => l.name.toLowerCase() === lang.toLowerCase())
      )
    );
  }

  if (!state.showDeceased) {
    result = result.filter(c => !c.deceased);
  }

  if (state.secret.length) {
    result = result.filter(c =>
      state.secret.some(sId => {
        const s = (secrets ?? []).find(s2 => s2.id === sId);
        return s?.knownToIds?.includes(c.id);
      })
    );
  }

  return result;
}

function renderCard(character, factions, currentDate) {
  const zodiacParts = [
    character.zodiac?.sun,
    character.zodiac?.moon,
    character.zodiac?.rising,
  ].filter(Boolean);

  const computed   = computeAge(character, currentDate);
  const displayAge = computed ?? (character.birthday ? null : character.age);
  const ageLabel   = character.deceased && character.deathDate ? "Age at death" : "Age";

  const akas = (character.akaAliasIndices ?? [])
    .map(i => character.aliases?.[i])
    .filter(Boolean);

  const card = el("article", {
    class: "character-card" + (character.deceased ? " character-card--deceased" : ""),
    "data-owner": character.owner || "NPC",
  }, [
    character.deceased ? el("span", { class: "character-deceased-tag" }, ["Deceased"]) : null,
    el("h2", { class: "character-name" }, [displayName(character)]),
    akas.length ? el("p", { class: "character-aka" }, [`a.k.a. ${akas.join(", ")}`]) : null,
    displayAge !== null ? el("p", { class: "character-meta" }, [`${ageLabel}: ${displayAge}`]) : null,
    zodiacParts.length ? el("p", { class: "character-zodiac" }, [zodiacParts.join(" / ")]) : null,
    el("span", { class: "character-owner-badge" }, [character.owner || "NPC"]),
    character.summary ? el("p", { class: "character-summary" }, [character.summary]) : null,
    character.factionIds?.length ? el("div", { class: "character-factions" }, [
      ...character.factionIds.map(fId => {
        const f = factions?.find(f2 => f2.id === fId);
        const chip = el("a", {
          class: "faction-chip faction-chip--link",
          href: `#/factions/${fId}`,
        }, [f?.name ?? "Unknown"]);
        if (f?.color) {
          chip.style.background = f.color;
          chip.style.color = chipTextColor(f.color);
        }
        chip.addEventListener("click", e => e.stopPropagation());
        return chip;
      }),
    ]) : null,
  ]);

  card.style.setProperty("--owner-border", ownerBorderStyle(character.owner));
  card.addEventListener("click", () => navigate(`characters/${character.id}`));
  return card;
}

export function mountCharacters(container, appData) {
  let filterState = loadFilterState();

  // ── Grid ──
  const grid = el("div", { class: "character-grid" });

  function renderGrid() {
    clear(grid);
    const currentDate = appData.meta?.currentDate ?? null;
    const visible = applyFilters(appData.characters, filterState, appData.secrets ?? []);
    if (!visible.length) {
      grid.append(el("p", { class: "character-empty" }, ["No characters match."]));
    } else {
      for (const c of visible) grid.append(renderCard(c, appData.factions, currentDate));
    }
  }

  function onDateChange() {
    if (!grid.isConnected) { window.removeEventListener("current-date-change", onDateChange); return; }
    renderGrid();
  }
  window.addEventListener("current-date-change", onDateChange);

  // ── Filter change handler ──
  function onChange() {
    saveFilterState(filterState);
    clearBtn.style.display = isFilterModified(filterState) ? "" : "none";
    renderGrid();
  }

  // ── Search ──
  const searchInput = el("input", {
    type: "text", placeholder: "Search characters", class: "filter-search",
  });
  searchInput.value = filterState.search;
  searchInput.addEventListener("input", () => { filterState.search = searchInput.value; onChange(); });

  // ── Owner toggles ──
  const ownerBtnMap = {};
  const ownerToggleEl = el("div", { class: "filter-owner-toggles" });
  for (const owner of ALL_OWNERS) {
    const isOn = filterState.owner.includes(owner);
    const btn = el("button", {
      class: "owner-toggle " + (isOn ? "owner-toggle--on" : "owner-toggle--off"),
      title: owner,
    }, [owner[0]]);
    btn.style.setProperty("--chip-color", OWNER_VARS[owner]);
    btn.addEventListener("click", () => {
      const idx = filterState.owner.indexOf(owner);
      if (idx === -1) {
        filterState.owner.push(owner);
        btn.classList.add("owner-toggle--on");
        btn.classList.remove("owner-toggle--off");
      } else {
        filterState.owner.splice(idx, 1);
        btn.classList.remove("owner-toggle--on");
        btn.classList.add("owner-toggle--off");
      }
      onChange();
    });
    ownerBtnMap[owner] = btn;
    ownerToggleEl.append(btn);
  }

  // ── Faction filter ──
  const factionChipsEl = el("div", { class: "filter-faction-chips" });

  function renderFactionChips() {
    clear(factionChipsEl);
    for (const fId of filterState.faction) {
      const f = (appData.factions ?? []).find(f2 => f2.id === fId);
      const chip = el("span", { class: "filter-faction-active-chip" }, [
        f?.name ?? fId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          filterState.faction = filterState.faction.filter(id => id !== fId);
          renderFactionChips();
          onChange();
        }}, ["×"]),
      ]);
      if (f?.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
      factionChipsEl.append(chip);
    }
  }

  const factionSelect = el("select", { class: "filter-faction-select" });
  factionSelect.append(el("option", { value: "" }, ["Filter by faction…"]));
  for (const f of appData.factions ?? []) {
    factionSelect.append(el("option", { value: f.id }, [f.name]));
  }
  factionSelect.addEventListener("change", () => {
    const val = factionSelect.value;
    if (!val || filterState.faction.includes(val)) { factionSelect.value = ""; return; }
    filterState.faction = [...filterState.faction, val];
    factionSelect.value = "";
    renderFactionChips();
    onChange();
  });
  renderFactionChips();

  // ── Language filter ──
  const langChipsEl = el("div", { class: "filter-faction-chips" });

  function renderLangChips() {
    clear(langChipsEl);
    for (const lang of filterState.language) {
      langChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        lang,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          filterState.language = filterState.language.filter(l => l !== lang);
          renderLangChips();
          onChange();
        }}, ["×"]),
      ]));
    }
  }

  const langSelect = el("select", { class: "filter-faction-select" });
  langSelect.append(el("option", { value: "" }, ["Filter by language…"]));
  for (const l of [...(appData.meta.knownLanguages ?? [])].sort()) {
    langSelect.append(el("option", { value: l }, [l]));
  }
  langSelect.addEventListener("change", () => {
    const val = langSelect.value;
    if (!val || filterState.language.includes(val)) { langSelect.value = ""; return; }
    filterState.language = [...filterState.language, val];
    langSelect.value = "";
    renderLangChips();
    onChange();
  });
  renderLangChips();

  // ── Secret filter ──
  const secretChipsEl = el("div", { class: "filter-faction-chips" });

  function renderSecretChips() {
    clear(secretChipsEl);
    for (const sId of filterState.secret) {
      const s = (appData.secrets ?? []).find(s2 => s2.id === sId);
      secretChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        s?.title || "(untitled)",
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          filterState.secret = filterState.secret.filter(id => id !== sId);
          renderSecretChips();
          onChange();
        }}, ["×"]),
      ]));
    }
  }

  const secretSelect = el("select", { class: "filter-faction-select" });
  secretSelect.append(el("option", { value: "" }, ["Filter by secret…"]));
  for (const s of [...(appData.secrets ?? [])].filter(s2 => !s2.archived).sort((a, b) => (a.title || "").localeCompare(b.title || ""))) {
    secretSelect.append(el("option", { value: s.id }, [s.title || "(untitled)"]));
  }
  secretSelect.addEventListener("change", () => {
    const val = secretSelect.value;
    if (!val || filterState.secret.includes(val)) { secretSelect.value = ""; return; }
    filterState.secret = [...filterState.secret, val];
    secretSelect.value = "";
    renderSecretChips();
    onChange();
  });
  renderSecretChips();

  // ── Deceased toggle ──
  const deceasedCheck = el("input", { type: "checkbox", id: "filter-show-deceased" });
  deceasedCheck.checked = filterState.showDeceased;
  deceasedCheck.addEventListener("change", () => {
    filterState.showDeceased = deceasedCheck.checked;
    onChange();
  });

  // ── Filter panel (inline, toggleable) ──
  const popover = el("div", { class: "filter-popover" });
  popover.append(
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Faction"]),
      el("div", { class: "filter-faction-wrap" }, [factionSelect, factionChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Language"]),
      el("div", { class: "filter-faction-wrap" }, [langSelect, langChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("span", { class: "filter-popover-label" }, ["Knows secret"]),
      el("div", { class: "filter-faction-wrap" }, [secretSelect, secretChipsEl]),
    ]),
    el("div", { class: "filter-popover-row" }, [
      el("label", { class: "filter-toggle", for: "filter-show-deceased" }, [deceasedCheck, "Show deceased"]),
    ]),
  );

  const filterByBtn = el("button", { class: "btn-small filter-by-btn" }, ["Filter by ▾"]);
  filterByBtn.addEventListener("click", () => {
    const open = popover.classList.toggle("is-open");
    filterByBtn.classList.toggle("is-active", open);
    filterByBtn.textContent = open ? "Filter by ▴" : "Filter by ▾";
  });

  // ── Clear all filters ──
  const clearBtn = el("button", { class: "btn-link filter-clear-btn" }, ["Clear filters"]);
  clearBtn.style.display = isFilterModified(filterState) ? "" : "none";
  clearBtn.addEventListener("click", () => {
    filterState = { ...DEFAULT_STATE, owner: [...ALL_OWNERS] };
    searchInput.value = "";
    for (const [owner, btn] of Object.entries(ownerBtnMap)) {
      btn.classList.add("owner-toggle--on");
      btn.classList.remove("owner-toggle--off");
    }
    renderFactionChips();
    renderLangChips();
    renderSecretChips();
    deceasedCheck.checked = false;
    try { localStorage.removeItem(PERSIST_KEY); } catch {}
    clearBtn.style.display = "none";
    renderGrid();
  });

  // ── New character ──
  async function handleNew() {
    const character = createCharacter();
    appData.characters.push(character);
    await save("characters", appData.characters);
    navigate(`characters/${character.id}`);
  }

  const topBar = el("div", { class: "filter-inline-bar" }, [
    searchInput,
    ownerToggleEl,
    clearBtn,
    filterByBtn,
  ]);

  renderGrid();

  container.append(
    el("div", { class: "characters-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New character"]),
    ]),
    topBar,
    el("div", { class: "characters-body" }, [grid, popover])
  );
}
