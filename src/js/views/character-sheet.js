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

// ── Card builder ──────────────────────────────────────────────────────────────

function makeCard(key, title, body) {
  return el("section", { class: "sheet-card", "data-card": key }, [
    el("header", { class: "sheet-card-header" }, [
      el("h3", { class: "sheet-card-title" }, [title]),
    ]),
    el("div", { class: "sheet-card-body" }, [body].filter(Boolean)),
  ]);
}

function scEmpty(msg) {
  return el("p", { class: "sc-empty" }, [msg || "Click ✏ to edit."]);
}

// ── Read-only card body renders ───────────────────────────────────────────────

function renderIdentityRO(ch, appData) {
  const age      = computeAge(ch, appData.meta?.currentDate) ?? ch.age;
  const items    = [];

  const prevNames = (ch.previousNames ?? []).filter(Boolean);
  if (prevNames.length) {
    items.push(el("p", { class: "sc-line" }, [`Previously: ${prevNames.join(", ")}`]));
  }

  const aliases = (ch.aliases ?? []).filter(Boolean);
  if (aliases.length) {
    const akaSet   = new Set(ch.akaAliasIndices ?? []);
    const dispIdx  = ch.displayAliasIndex;
    const parts    = aliases.map((a, i) => {
      const tags = [];
      if (i === dispIdx) tags.push("primary");
      if (akaSet.has(i)) tags.push("a.k.a.");
      return tags.length ? `${a} (${tags.join(", ")})` : a;
    });
    items.push(el("p", { class: "sc-line" }, [`Aliases: ${parts.join(", ")}`]));
  }

  const ageParts = [];
  if (age != null) ageParts.push(`Age ${age}`);
  if (ch.birthday) ageParts.push(`Born ${formatLongDate(ch.birthday)}`);
  if (ageParts.length) items.push(el("p", { class: "sc-line" }, [ageParts.join(" · ")]));

  if (ch.placeOfBirth) {
    items.push(el("p", { class: "sc-line" }, [ch.placeOfBirth]));
  }

  if (ch.deceased) {
    const deathStr = ch.deathDate ? formatLongDate(ch.deathDate) : null;
    items.push(el("p", { class: "sc-line sc-deceased" }, [
      deathStr ? `Deceased · died ${deathStr}` : "Deceased",
    ]));
  }

  return items.length
    ? el("div", { class: "sc-body" }, items)
    : scEmpty("Click ✏ to add identity details.");
}

function renderZodiacRO(ch) {
  const sun    = ch.zodiac?.sun ?? sunSignFromDate(ch.birthday);
  const moon   = ch.zodiac?.moon;
  const rising = ch.zodiac?.rising;

  if (!sun && !moon && !rising) return scEmpty("No astrological data.");

  const items = [];
  if (sun) items.push(el("p", { class: "sc-astro-sun" }, [sun]));
  const extra = [moon ? `Moon in ${moon}` : null, rising ? `Rising ${rising}` : null].filter(Boolean);
  if (extra.length) items.push(el("p", { class: "sc-astro-extra" }, [extra.join(" · ")]));
  return el("div", { class: "sc-body" }, items);
}

function renderLanguagesRO(ch) {
  const langs = ch.languages ?? [];
  if (!langs.length) return scEmpty("No languages recorded.");

  const LEVEL_ORDER = ["Native", "Advanced", "Accented", "Broken"];
  const sorted = [...langs].sort((a, b) => {
    const ai = LEVEL_ORDER.indexOf(a.level);
    const bi = LEVEL_ORDER.indexOf(b.level);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name);
  });

  return el("div", { class: "sc-body" },
    sorted.map(l => el("div", { class: "sc-lang-row" }, [
      el("span", { class: "sc-lang-name" }, [l.name]),
      el("span", { class: "sc-lang-level" }, [l.level]),
    ]))
  );
}

function renderSkillsRO(ch) {
  const skills = ch.cards?.skills ?? "";
  if (!skills.trim()) return scEmpty("No skills recorded.");
  return el("div", { class: "sc-pretext" }, [skills]);
}

function renderSummaryRO(ch) {
  if (!ch.summary?.trim()) return scEmpty("No summary yet.");
  return el("p", { class: "sc-summary" }, [ch.summary]);
}

function renderBackgroundRO(ch) {
  if (!ch.background?.trim()) return scEmpty("No background yet.");
  return el("div", { class: "sc-pretext sc-background" }, [ch.background]);
}

// ── Relationships helpers ─────────────────────────────────────────────────────

function buildRelsEl(ch, appData, onRelsChange) {
  const relsEl = el("div", { class: "rels-list" });
  refreshRelsEl(relsEl, ch, appData, onRelsChange);
  return relsEl;
}

function refreshRelsEl(relsEl, ch, appData, onRelsChange) {
  clear(relsEl);
  const mine = (appData.relationships ?? []).filter(r => r.from === ch.id);

  mine.sort((a, b) => {
    const ao = appData.characters.find(c => c.id === a.to);
    const bo = appData.characters.find(c => c.id === b.to);
    const ad = ao?.deceased ? 1 : 0;
    const bd = bo?.deceased ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return displayName(ao ?? {}).localeCompare(displayName(bo ?? {}));
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
      openRelationshipDialog(appData, ch.id, rel.id, () => {
        refreshRelsEl(relsEl, ch, appData, onRelsChange);
      });
    });

    const delBtn = el("button", { class: "btn-small btn-small--danger" }, ["×"]);
    delBtn.addEventListener("click", () => removeRel(rel, ch, appData, relsEl, onRelsChange));

    const row = el("div", {
      class: "rel-row" + (frozen ? " rel-row--frozen" : ""),
      title: frozen ? "This character is deceased." : "",
    }, [
      el("div", { class: "rel-row-main" }, [
        el("a", { class: "rel-other-name", href: `#/characters/${rel.to}` },
          [other ? displayName(other) : "Unknown"]),
        el("span", { class: "rel-type" }, [typeStr]),
        editBtn,
        delBtn,
      ]),
      feelStr ? el("div", { class: "rel-row-feelings" }, [feelStr]) : null,
    ].filter(Boolean));

    relsEl.append(row);
  }
}

function removeRel(rel, ch, appData, relsEl, onRelsChange) {
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
  refreshRelsEl(relsEl, ch, appData, onRelsChange);
}

function renderFactionsRelsRO(ch, appData, onRelsChange) {
  const factions = (ch.factionIds ?? [])
    .map(fId => appData.factions.find(f => f.id === fId))
    .filter(Boolean);

  const parts = [];

  if (factions.length) {
    const chips = factions.map(f => {
      const chip = el("a", { class: "faction-chip faction-chip--link", href: `#/factions/${f.id}` }, [f.name]);
      if (f.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
      return chip;
    });
    parts.push(el("div", { class: "sc-faction-chips" }, chips));
  }

  const relsHeader = el("div", { class: "sc-rels-header" }, [
    el("span", { class: "sc-sublabel" }, ["Relationships"]),
    el("button", { class: "btn-small", onclick: () => {
      openRelationshipDialog(appData, ch.id, null, onRelsChange);
    }}, ["+ Add"]),
  ]);
  parts.push(relsHeader);

  parts.push(buildRelsEl(ch, appData, onRelsChange));

  return el("div", { class: "sc-body" }, parts);
}

function renderCurrentRO(ch, appData) {
  const plotlines = (appData.plotlines ?? []).filter(pl => {
    if ((pl.characterIds ?? []).includes(ch.id)) return true;
    return (pl.items ?? []).some(item => {
      if (item.kind !== "scene") return false;
      const scene = (appData.scenes ?? []).find(s => s.id === item.sceneId);
      return (scene?.characters ?? []).some(sc => sc.characterId === ch.id);
    });
  });

  const secretsKnown = (appData.secrets ?? []).filter(s =>
    !s.archived && (s.knownToIds ?? []).includes(ch.id)
  );
  const hiddenFrom = (appData.secrets ?? []).filter(s =>
    !s.archived && (s.hiddenFromIds ?? []).includes(ch.id)
  );

  if (!plotlines.length && !secretsKnown.length && !hiddenFrom.length) {
    return scEmpty("No current plots or secrets.");
  }

  const parts = [];

  if (plotlines.length) {
    parts.push(el("p", { class: "sc-sublabel" }, ["Plotlines"]));
    parts.push(el("ul", { class: "printed-scene-list" }, plotlines.map(pl =>
      el("li", {}, [el("a", { href: `#/plotlines/${pl.id}` }, [pl.title || "Untitled plotline"])])
    )));
  }

  if (secretsKnown.length) {
    parts.push(el("p", { class: "sc-sublabel" }, ["Secrets known"]));
    parts.push(el("ul", { class: "printed-scene-list" }, secretsKnown.map(s =>
      el("li", {}, [el("a", { href: `#/secrets/${s.id}` }, [s.title || "(untitled)"])])
    )));
  }

  if (hiddenFrom.length) {
    parts.push(el("p", { class: "sc-sublabel" }, ["Hidden from me"]));
    parts.push(el("ul", { class: "printed-scene-list" }, hiddenFrom.map(s =>
      el("li", {}, [el("a", { href: `#/secrets/${s.id}` }, [s.title || "(untitled)"])])
    )));
  }

  return el("div", { class: "sc-body" }, parts);
}

// ── Button row ────────────────────────────────────────────────────────────────

function makeButtonRow(ch, appData) {
  const relBtn = el("button", { class: "sheet-action-btn", "data-action": "relationship-web" });
  relBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8" y1="11" x2="16" y2="7"/><line x1="8" y1="13" x2="16" y2="17"/></svg><span>Relationships</span>`;
  relBtn.addEventListener("click", async () => {
    const { openRelationshipWeb } = await import("./relationship-web.js");
    openRelationshipWeb(ch.id, appData);
  });

  const facBtn = el("button", {
    class: "sheet-action-btn",
    "data-action": "faction-web",
    title: "Coming in Slice 9",
  });
  facBtn.disabled = true;
  facBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><line x1="10" y1="11" x2="5" y2="7"/><line x1="14" y1="11" x2="19" y2="7"/><line x1="10" y1="13" x2="5" y2="17"/><line x1="14" y1="13" x2="19" y2="17"/></svg><span>Factions</span>`;

  const tlBtn = el("button", {
    class: "sheet-action-btn",
    "data-action": "personal-timeline",
    title: "Coming in Slice 9",
  });
  tlBtn.disabled = true;
  tlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/></svg><span>Timeline</span>`;

  return el("div", { class: "sheet-button-row" }, [relBtn, facBtn, tlBtn]);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function mountCharacterSheet(container, appData, id) {
  const character = appData.characters.find(c => c.id === id);
  if (!character) {
    container.append(el("p", { class: "placeholder-view" }, ["Character not found."]));
    return;
  }

  function show() {
    clear(container);

    const name = displayName(character);
    const akas = (character.akaAliasIndices ?? [])
      .map(i => character.aliases?.[i]).filter(Boolean);
    const deathStr = character.deathDate ? formatLongDate(character.deathDate) : null;

    function onRelsChange() { show(); }

    const leftCol = el("div", { class: "sheet-main" }, [
      makeCard("identity",   "Identity",   renderIdentityRO(character, appData)),
      makeButtonRow(character, appData),
      makeCard("summary",    "Summary",    renderSummaryRO(character)),
      makeCard("background", "Background", renderBackgroundRO(character)),
    ]);

    const rightCol = el("div", { class: "sheet-cards" }, [
      makeCard("zodiac",       "Zodiac",                    renderZodiacRO(character)),
      makeCard("languages",    "Languages",                 renderLanguagesRO(character)),
      makeCard("skills",       "Skills",                    renderSkillsRO(character)),
      makeCard("factions-rels","Factions & Relationships",  renderFactionsRelsRO(character, appData, onRelsChange)),
      makeCard("current",      "Current",                   renderCurrentRO(character, appData)),
    ]);

    container.append(el("div", { class: "printed-sheet" }, [
      el("div", { class: "printed-sheet-topbar" }, [
        el("a", { class: "sheet-back", href: "#/characters" }, ["← Characters"]),
      ]),
      el("div", { class: "printed-header" }, [
        el("h1", { class: "printed-name" }, [name]),
        akas.length ? el("p", { class: "printed-aka" }, [`a.k.a. ${akas.join(", ")}`]) : null,
        el("div", { class: "printed-flourish" }, ["❦"]),
      ].filter(Boolean)),
      el("p", { class: "printed-owner-line" }, [
        character.owner && character.owner !== "NPC" ? `${character.owner}'s character` : "NPC",
      ]),
      character.deceased
        ? el("p", { class: "printed-deceased-line" }, [
            deathStr ? `Deceased — died ${deathStr}` : "Deceased",
          ])
        : null,
      el("div", { class: "sheet-layout" }, [leftCol, rightCol]),
    ].filter(Boolean)));
  }

  function onDateChange() {
    if (!container.isConnected) {
      window.removeEventListener("current-date-change", onDateChange);
      window.removeEventListener("route-change", onRouteChange);
      return;
    }
    show();
  }

  function onRouteChange() {
    window.removeEventListener("current-date-change", onDateChange);
    window.removeEventListener("route-change", onRouteChange);
  }

  window.addEventListener("current-date-change", onDateChange);
  window.addEventListener("route-change", onRouteChange);

  show();
}
