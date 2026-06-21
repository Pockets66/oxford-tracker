import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { syncFactionMembership, displayName, computeAge, LANGUAGE_LEVELS, RELATIONSHIP_BANDS, anomalyOverallClass } from "../schema.js";
import { sunSignFromDate } from "../zodiac.js";
import { createCombobox } from "../components/combobox.js";
import { formatLongDate } from "../dates.js";

const OWNERS = ["Bree", "Jack", "Nicole", "Caiden", "NPC"];
const SIGNS  = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
                 "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

const PENCIL_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;

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

function autoresize(ta) {
  ta.style.height = "auto";
  ta.style.height = (ta.scrollHeight || 120) + "px";
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

// ── Card builders ──────────────────────────────────────────────────────────────

// No-pencil card (used for Current card — derived data, no editing).
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
  const age   = computeAge(ch, appData.meta?.currentDate) ?? ch.age;
  const items = [];

  const prevNames = (ch.previousNames ?? []).filter(Boolean);
  if (prevNames.length) {
    items.push(el("p", { class: "sc-line" }, [`Previously: ${prevNames.join(", ")}`]));
  }

  const aliases = (ch.aliases ?? []).filter(Boolean);
  if (aliases.length) {
    const akaSet  = new Set(ch.akaAliasIndices ?? []);
    const dispIdx = ch.displayAliasIndex;
    const parts   = aliases.map((a, i) => {
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

  if (ch.placeOfBirth) items.push(el("p", { class: "sc-line" }, [ch.placeOfBirth]));

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

function renderZodiacRO(ch, appData) {
  const sun    = ch.zodiac?.sun ?? sunSignFromDate(ch.birthday);
  const moon   = ch.zodiac?.moon;
  const rising = ch.zodiac?.rising;

  if (!sun && !moon && !rising && !ch.birthTime && !ch.birthCityId) return scEmpty("No astrological data.");

  const items = [];
  if (sun) items.push(el("p", { class: "sc-astro-sun" }, [sun]));
  const extra = [moon ? `Moon in ${moon}` : null, rising ? `Rising ${rising}` : null].filter(Boolean);
  if (extra.length) items.push(el("p", { class: "sc-astro-extra" }, [extra.join(" · ")]));

  const cityName = ch.birthCityId
    ? (appData?.meta?.knownCities ?? []).find(c => c.id === ch.birthCityId)?.name ?? null
    : null;
  if (ch.birthTime || cityName) {
    const parts = [];
    if (ch.birthTime) parts.push(`Born ${ch.birthTime}`);
    if (cityName)     parts.push(ch.birthTime ? `in ${cityName}` : `Born in ${cityName}`);
    items.push(el("p", { class: "sc-astro-birthplace" }, [parts.join(" ")]));
  }

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

const BAND_COLOR = {
  "Nemesis":     "var(--danger)",
  "Bad Blood":   "var(--danger)",
  "Cold":        "var(--text-muted)",
  "Neutral":     "var(--text-muted)",
  "Friendly":    "var(--success, #3d7a4a)",
  "Close":       "var(--success, #3d7a4a)",
  "Inseparable": "var(--gold)",
};

function refreshRelsEl(relsEl, ch, appData, onRelsChange) {
  clear(relsEl);
  const mine = (appData.relationships ?? []).filter(r => r.from === ch.id);

  mine.sort((a, b) => {
    const ao = appData.characters.find(c => c.id === a.to);
    const bo = appData.characters.find(c => c.id === b.to);
    const ad = ao?.deceased ? 1 : 0;
    const bd = bo?.deceased ? 1 : 0;
    if (ad !== bd) return ad - bd;
    // Band descending (Inseparable=6 first)
    const ai = RELATIONSHIP_BANDS.indexOf(a.band ?? "Neutral");
    const bi = RELATIONSHIP_BANDS.indexOf(b.band ?? "Neutral");
    if (bi !== ai) return bi - ai;
    return displayName(ao ?? {}).localeCompare(displayName(bo ?? {}));
  });

  if (!mine.length) {
    relsEl.append(el("p", { class: "sheet-empty-note" }, ["No relationships yet."]));
    return;
  }

  for (const rel of mine) {
    const other  = appData.characters.find(c => c.id === rel.to);
    const frozen = !!other?.deceased;
    const band   = rel.band ?? "Neutral";
    const links  = (rel.links ?? []).join(", ");

    const mainLine = el("div", { class: "rel-row-main" }, [
      el("a", { class: "rel-other-name", href: `#/characters/${rel.to}` },
        [other ? displayName(other) : "Unknown"]),
      links ? el("span", { class: "rel-type" }, [` — ${links} · `]) : el("span", { class: "rel-type" }, [" · "]),
      el("em", { class: "rel-band", style: `color: ${BAND_COLOR[band] ?? "var(--text-muted)"}` }, [band]),
    ]);

    const row = el("div", {
      class: "rel-row" + (frozen ? " rel-row--frozen" : ""),
      title: frozen ? "This character is deceased." : "",
    }, [
      mainLine,
      rel.notes ? el("div", { class: "rel-row-feelings" }, [rel.notes]) : null,
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

  parts.push(el("div", { class: "sc-rels-header" }, [
    el("span", { class: "sc-sublabel" }, ["Relationships"]),
    el("div", { class: "sc-rels-btns" }, [
      el("button", { class: "btn-small", onclick: async () => {
        const { openRelationshipBulkDialog } = await import("./relationship-bulk-dialog.js");
        openRelationshipBulkDialog({ mode: "edit", holderId: ch.id, appData, onClose: onRelsChange });
      }}, ["Edit"]),
      el("button", { class: "btn-small", onclick: async () => {
        const { openRelationshipBulkDialog } = await import("./relationship-bulk-dialog.js");
        openRelationshipBulkDialog({ mode: "add", holderId: ch.id, appData, onClose: onRelsChange });
      }}, ["+ Add"]),
    ]),
  ]));

  parts.push(buildRelsEl(ch, appData, onRelsChange));

  // ── Incoming relationships ─────────────────────────────────────────────────
  const incoming = (appData.relationships ?? [])
    .filter(r => r.to === ch.id)
    .sort((a, b) => {
      const ao = appData.characters.find(c => c.id === a.from);
      const bo = appData.characters.find(c => c.id === b.from);
      const ad = ao?.deceased ? 1 : 0;
      const bd = bo?.deceased ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const ai = RELATIONSHIP_BANDS.indexOf(a.band ?? "Neutral");
      const bi = RELATIONSHIP_BANDS.indexOf(b.band ?? "Neutral");
      if (bi !== ai) return bi - ai;
      return displayName(ao ?? {}).localeCompare(displayName(bo ?? {}));
    });

  parts.push(el("div", { class: "sc-incoming-rule" }));
  parts.push(el("p", { class: "sc-sublabel sc-incoming-label" }, ["Incoming"]));

  if (!incoming.length) {
    parts.push(el("p", { class: "sheet-empty-note sc-incoming-empty" }, [
      "No one has this character in their list.",
    ]));
  } else {
    const incomingList = el("div", { class: "rels-list" });
    for (const rel of incoming) {
      const other  = appData.characters.find(c => c.id === rel.from);
      const frozen = !!other?.deceased;
      const band   = rel.band ?? "Neutral";
      const links  = (rel.links ?? []).join(", ");

      const mainLine = el("div", { class: "rel-row-main" }, [
        el("a", { class: "rel-other-name", href: `#/characters/${rel.from}` },
          [other ? displayName(other) : "Unknown"]),
        links ? el("span", { class: "rel-type" }, [` — ${links} · `]) : el("span", { class: "rel-type" }, [" · "]),
        el("em", { class: "rel-band", style: `color: ${BAND_COLOR[band] ?? "var(--text-muted)"}` }, [band]),
      ]);

      incomingList.append(el("div", {
        class: "rel-row" + (frozen ? " rel-row--frozen" : ""),
        title: frozen ? "This character is deceased." : "",
      }, [mainLine]));
    }
    parts.push(incomingList);
  }

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

  const anomaliesInvolved = (appData.anomalies ?? []).filter(a =>
    !a.archived && (a.characterIds ?? []).includes(ch.id)
  );

  if (!plotlines.length && !secretsKnown.length && !hiddenFrom.length && !anomaliesInvolved.length) {
    return scEmpty("No current plots, secrets, or anomalies.");
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

  if (anomaliesInvolved.length) {
    parts.push(el("p", { class: "sc-sublabel" }, ["Anomalies"]));
    parts.push(el("ul", { class: "printed-scene-list" }, anomaliesInvolved.map(a => {
      const overall = anomalyOverallClass(a);
      const slug    = overall ? overall.toLowerCase() : null;
      const chip    = slug ? el("span", { class: `class-chip class-chip--${slug}` }, [overall]) : null;
      const link    = el("a", { href: `#/anomalies/${a.id}` }, [a.title || "(unnamed anomaly)"]);
      return el("li", { class: "sc-anomaly-row" }, chip ? [link, " — ", chip] : [link]);
    })));
  }

  return el("div", { class: "sc-body" }, parts);
}

// ── Edit form renderers ───────────────────────────────────────────────────────

function makeDoneBtn(done) {
  const btn = el("button", { class: "btn-primary sheet-card-done" }, ["Done"]);
  btn.addEventListener("click", done);
  return btn;
}

function editIdentity(ch, appData, debouncedSave, persistNow, done) {
  const firstIn  = el("input", { type: "text", class: "sheet-name-part name-part--first",  placeholder: "First name" });
  const middleIn = el("input", { type: "text", class: "sheet-name-part name-part--middle", placeholder: "Middle" });
  const lastIn   = el("input", { type: "text", class: "sheet-name-part name-part--last",   placeholder: "Last name" });
  firstIn.value  = ch.firstName  ?? "";
  middleIn.value = ch.middleName ?? "";
  lastIn.value   = ch.lastName   ?? "";
  firstIn.addEventListener("input",  () => { ch.firstName  = firstIn.value;  debouncedSave(); });
  middleIn.addEventListener("input", () => { ch.middleName = middleIn.value; debouncedSave(); });
  lastIn.addEventListener("input",   () => { ch.lastName   = lastIn.value;   debouncedSave(); });

  const birthdayIn = el("input", { type: "date", class: "sheet-input" });
  birthdayIn.value = ch.birthday ?? "";

  const sunDisplay = el("span", { class: "sheet-sun-display" }, [ch.zodiac?.sun ?? "—"]);

  const ageWrapper = el("label", { class: "sheet-label" }, ["Age"]);
  function refreshAge() {
    while (ageWrapper.childNodes.length > 1) ageWrapper.removeChild(ageWrapper.lastChild);
    if (ch.birthday) {
      const age    = computeAge(ch, appData.meta?.currentDate);
      const note   = ch.deathDate ? "at death" : "from birthday";
      ageWrapper.append(
        el("span", { class: "sheet-age-computed" }, [age != null ? String(age) : "?"]),
        el("span", { class: "sheet-age-caption" }, [note]),
      );
    } else {
      const inp = el("input", { type: "number", class: "sheet-input sheet-input--narrow", placeholder: "Age", min: "0", max: "999" });
      inp.value = ch.age ?? "";
      inp.addEventListener("input", () => { ch.age = inp.value !== "" ? Number(inp.value) : null; debouncedSave(); });
      ageWrapper.append(inp);
    }
  }
  refreshAge();

  birthdayIn.addEventListener("input", () => {
    ch.birthday     = birthdayIn.value || null;
    ch.zodiac       ??= {};
    ch.zodiac.sun   = sunSignFromDate(ch.birthday);
    sunDisplay.textContent = ch.zodiac.sun ?? "—";
    refreshAge();
    debouncedSave();
  });

  const placeIn = el("input", { type: "text", class: "sheet-input sheet-input--wide", placeholder: "Place of birth" });
  placeIn.value = ch.placeOfBirth ?? "";
  placeIn.addEventListener("input", () => { ch.placeOfBirth = placeIn.value; debouncedSave(); });

  const ownerSel = el("select", { class: "sheet-owner-select" });
  for (const o of OWNERS) {
    const opt = el("option", { value: o }, [o]);
    if (ch.owner === o) opt.selected = true;
    ownerSel.append(opt);
  }
  ownerSel.addEventListener("change", () => { ch.owner = ownerSel.value; debouncedSave(); });

  const deathDateIn = el("input", { type: "date", class: "sheet-input" });
  deathDateIn.value = ch.deathDate ?? "";
  deathDateIn.addEventListener("input", () => {
    ch.deathDate = deathDateIn.value || null;
    refreshAge();
    debouncedSave();
  });

  const deathRow = el("div", { class: "sheet-row" }, [
    el("label", { class: "sheet-label" }, ["Death date", deathDateIn]),
  ]);
  deathRow.hidden = !ch.deceased;

  const deceasedCheck = el("input", { type: "checkbox", class: "sheet-checkbox" });
  deceasedCheck.checked = !!ch.deceased;
  deceasedCheck.addEventListener("change", () => {
    ch.deceased = deceasedCheck.checked;
    if (!ch.deceased) { ch.deathDate = null; deathDateIn.value = ""; }
    deathRow.hidden = !ch.deceased;
    refreshAge();
    debouncedSave();
  });

  const deleteBtn = el("button", { class: "btn-danger sc-delete-btn" }, ["Delete Character"]);
  deleteBtn.addEventListener("click", () => {
    if (!confirm(`Delete "${displayName(ch)}"? This cannot be undone.`)) return;
    const idx = appData.characters.findIndex(c => c.id === ch.id);
    if (idx !== -1) appData.characters.splice(idx, 1);
    persistNow().then(() => navigate("characters"));
  });

  return el("div", { class: "sc-edit-form" }, [
    el("div", { class: "sheet-name-group" }, [firstIn, middleIn, lastIn]),
    makeNameList(ch, "previousNames", "Previous names", debouncedSave),
    makeNameList(ch, "aliases", "Aliases / codenames", debouncedSave, { withPrimary: true, withAka: true }),
    el("div", { class: "sheet-row" }, [
      ageWrapper,
      el("label", { class: "sheet-label" }, ["Birthday", birthdayIn]),
      el("label", { class: "sheet-label" }, ["Sun ☀", sunDisplay]),
    ]),
    deathRow,
    el("div", { class: "sheet-row" }, [
      el("label", { class: "sheet-label" }, ["Place of birth", placeIn]),
      el("label", { class: "sheet-label" }, ["Owner", ownerSel]),
      el("label", { class: "sheet-label sheet-label--inline" }, [deceasedCheck, " Deceased"]),
    ]),
    deleteBtn,
    makeDoneBtn(done),
  ]);
}

function editZodiac(ch, appData, persistNow, debouncedSave, done) {
  const sun       = ch.zodiac?.sun ?? sunSignFromDate(ch.birthday);
  const moonSel   = signSelect(ch.zodiac?.moon);
  const risingSel = signSelect(ch.zodiac?.rising);

  moonSel.addEventListener("change",   () => { ch.zodiac ??= {}; ch.zodiac.moon   = moonSel.value   || null; debouncedSave(); });
  risingSel.addEventListener("change", () => { ch.zodiac ??= {}; ch.zodiac.rising = risingSel.value || null; debouncedSave(); });

  const hasExtra  = !!(ch.zodiac?.moon || ch.zodiac?.rising);
  const extraBody = el("div", { class: "sheet-astro-extra" }, [
    el("div", { class: "sheet-row" }, [
      el("label", { class: "sheet-label" }, ["Moon ☽", moonSel]),
      el("label", { class: "sheet-label" }, ["Rising ↑", risingSel]),
    ]),
  ]);
  extraBody.hidden = !hasExtra;

  const toggleBtn = el("button", { class: "btn-link sheet-astro-toggle" }, [
    hasExtra ? "▾ Astrological details" : "+ More astrological info",
  ]);
  toggleBtn.addEventListener("click", () => {
    extraBody.hidden = !extraBody.hidden;
    toggleBtn.textContent = extraBody.hidden ? "+ More astrological info" : "▾ Astrological details";
  });

  // Birth time
  const timeInput = el("input", { type: "time", class: "sheet-input" });
  timeInput.value = ch.birthTime || "";
  timeInput.addEventListener("change", () => {
    ch.birthTime = timeInput.value || null;
    debouncedSave();
  });

  // Birth city combobox with rebuild-in-place on "+ Add new city"
  const cityComboWrap = el("div");

  function rebuildCityCombo() {
    clear(cityComboWrap);
    const cityItems = [
      ...(appData.meta.knownCities ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => ({ value: c.id, label: c.name })),
      { value: "__add__", label: "+ Add new city" },
    ];
    cityComboWrap.append(createCombobox({
      items:     cityItems,
      value:     ch.birthCityId || "",
      placeholder: "Choose a city",
      presorted: true,
      onChange: (value) => {
        if (value === "__add__") {
          openAddCityDialog(appData, (newCity) => {
            appData.meta.knownCities ??= [];
            appData.meta.knownCities.push(newCity);
            save("meta", appData.meta);
            ch.birthCityId = newCity.id;
            persistNow();
            rebuildCityCombo();
          });
        } else {
          ch.birthCityId = value || null;
          debouncedSave();
        }
      },
    }));
  }
  rebuildCityCombo();

  return el("div", { class: "sc-edit-form" }, [
    el("label", { class: "sheet-label" }, [
      "Sun ☀",
      el("span", { class: "sheet-sun-display" }, [sun ?? "—"]),
    ]),
    toggleBtn,
    extraBody,
    el("label", { class: "sheet-label" }, ["Birth time (optional)", timeInput]),
    el("label", { class: "sheet-label" }, ["Birth city", cityComboWrap]),
    makeDoneBtn(done),
  ]);
}

function openAddCityDialog(appData, onSave) {
  const nameInput = el("input", { type: "text",   class: "sheet-input", placeholder: "City name…" });
  const latInput  = el("input", { type: "number", class: "sheet-input", placeholder: "Latitude",  min: "-90",  max: "90",  step: "any" });
  const lngInput  = el("input", { type: "number", class: "sheet-input", placeholder: "Longitude", min: "-180", max: "180", step: "any" });
  const tzInput   = el("input", { type: "text",   class: "sheet-input", placeholder: "e.g. Europe/London" });

  const errEl = el("p", { class: "ptl-error" });
  errEl.hidden = true;

  function validate() {
    const name = nameInput.value.trim();
    const lat  = parseFloat(latInput.value);
    const lng  = parseFloat(lngInput.value);
    if (!name)          { errEl.textContent = "Name is required.";        errEl.hidden = false; return null; }
    if (isNaN(lat))     { errEl.textContent = "Latitude must be a number."; errEl.hidden = false; return null; }
    if (isNaN(lng))     { errEl.textContent = "Longitude must be a number."; errEl.hidden = false; return null; }
    errEl.hidden = true;
    return { id: crypto.randomUUID(), name, lat, lng, timezone: tzInput.value.trim() || "UTC" };
  }

  const saveBtn   = el("button", { class: "btn-primary" }, ["Save city"]);
  const cancelBtn = el("button", { class: "btn-secondary" }, ["Cancel"]);

  const backdrop = el("div", { class: "dialog-backdrop" });
  const dialog   = el("div", { class: "dialog" }, [
    el("h2", { class: "dialog-title" }, ["Add new city"]),
    el("div", { class: "dialog-body" }, [
      el("div", { class: "dialog-field" }, [el("div", { class: "dialog-field-label" }, ["Name"]),      nameInput]),
      el("div", { class: "dialog-field" }, [el("div", { class: "dialog-field-label" }, ["Latitude"]),  latInput]),
      el("div", { class: "dialog-field" }, [el("div", { class: "dialog-field-label" }, ["Longitude"]), lngInput]),
      el("div", { class: "dialog-field" }, [el("div", { class: "dialog-field-label" }, ["Timezone"]),  tzInput]),
      errEl,
    ]),
    el("div", { class: "dialog-footer" }, [saveBtn, cancelBtn]),
  ]);

  backdrop.append(dialog);
  document.body.append(backdrop);

  function close() { backdrop.remove(); }
  cancelBtn.addEventListener("click", close);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });

  saveBtn.addEventListener("click", () => {
    const city = validate();
    if (!city) return;
    close();
    onSave(city);
  });

  nameInput.focus();
}

function editLanguages(ch, appData, persistNow, done) {
  ch.languages ??= [];
  const rowsEl = el("div", { class: "lang-rows" });

  function renderRows() {
    clear(rowsEl);
    for (let i = 0; i < ch.languages.length; i++) {
      const entry = ch.languages[i];
      const idx   = i;
      const removeBtn = el("button", { class: "name-chip-remove lang-remove" }, ["×"]);
      removeBtn.addEventListener("click", () => {
        ch.languages.splice(idx, 1);
        persistNow();
        renderRows();
      });
      rowsEl.append(el("div", { class: "lang-row" }, [
        el("span", { class: "lang-name" }, [entry.name]),
        el("span", { class: "lang-sep" }, [" — "]),
        el("span", { class: "lang-level" }, [entry.level]),
        removeBtn,
      ]));
    }
  }

  let selectedLang = "";
  const comboWrap = el("div", { class: "lang-combobox-wrap" });

  const levelSel = el("select", { class: "sheet-input lang-level-sel" });
  for (const lv of LANGUAGE_LEVELS) {
    const opt = el("option", { value: lv }, [lv]);
    if (lv === "Native") opt.selected = true;
    levelSel.append(opt);
  }

  const addBtn = el("button", { class: "btn-small" }, ["Add"]);
  addBtn.addEventListener("click", () => {
    if (!selectedLang || selectedLang === "__new__") return;
    ch.languages.push({ name: selectedLang, level: levelSel.value });
    selectedLang = "";
    persistNow();
    renderRows();
    rebuildCombo();
  });

  function rebuildCombo() {
    clear(comboWrap);
    const items = [
      ...(appData.meta.knownLanguages ?? []).sort((a, b) => a.localeCompare(b)).map(l => ({ value: l, label: l })),
      { value: "__new__", label: "+ Add new language…" },
    ];
    comboWrap.append(createCombobox({
      items,
      value: "",
      placeholder: "Select language…",
      onChange: (val) => {
        if (val === "__new__") {
          clear(comboWrap);
          const nameInput = el("input", {
            type: "text",
            class: "sheet-input",
            placeholder: "Language name…",
          });
          nameInput.style.flex = "1";
          nameInput.style.minWidth = "0";
          const confirmBtn = el("button", { class: "btn-small" }, ["✓"]);
          const cancelBtn  = el("button", { class: "btn-small" }, ["✗"]);

          function commitNew() {
            const name = nameInput.value.trim();
            if (!name) { rebuildCombo(); return; }
            appData.meta.knownLanguages ??= [];
            if (!appData.meta.knownLanguages.includes(name)) {
              appData.meta.knownLanguages.push(name);
              appData.meta.knownLanguages.sort((a, b) => a.localeCompare(b));
              save("meta", appData.meta);
            }
            if (!ch.languages.find(l => l.name === name)) {
              ch.languages.push({ name, level: levelSel.value });
              persistNow();
              renderRows();
            }
            selectedLang = "";
            rebuildCombo();
          }

          nameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); commitNew(); }
            else if (e.key === "Escape") { rebuildCombo(); }
          });
          confirmBtn.addEventListener("click", commitNew);
          cancelBtn.addEventListener("click", () => rebuildCombo());

          const row = el("div", { class: "lang-new-row" }, [nameInput, confirmBtn, cancelBtn]);
          comboWrap.append(row);
          nameInput.focus();
        } else {
          selectedLang = val;
        }
      },
    }));
  }

  rebuildCombo();
  renderRows();

  return el("div", { class: "sc-edit-form" }, [
    el("div", { class: "lang-card-body" }, [
      rowsEl,
      el("div", { class: "lang-add-row" }, [comboWrap, levelSel, addBtn]),
    ]),
    makeDoneBtn(done),
  ]);
}

function editSkills(ch, debouncedSave, done) {
  const ta = el("textarea", { class: "sheet-textarea", placeholder: "Skills, abilities, and training…" });
  ta.value = ch.cards?.skills ?? "";
  ta.addEventListener("input", () => {
    ch.cards ??= {};
    ch.cards.skills = ta.value;
    autoresize(ta);
    debouncedSave();
  });
  requestAnimationFrame(() => autoresize(ta));
  return el("div", { class: "sc-edit-form" }, [ta, makeDoneBtn(done)]);
}

function editSummary(ch, debouncedSave, done) {
  const ta = el("textarea", { class: "sheet-textarea", rows: "3", placeholder: "Short description shown on character cards…" });
  ta.value = ch.summary ?? "";
  ta.addEventListener("input", () => { ch.summary = ta.value; debouncedSave(); });
  requestAnimationFrame(() => autoresize(ta));
  return el("div", { class: "sc-edit-form" }, [ta, makeDoneBtn(done)]);
}

function editBackground(ch, debouncedSave, done) {
  const ta = el("textarea", { class: "sheet-textarea sheet-textarea--bg", placeholder: "Freeform background and story…" });
  ta.value = ch.background ?? "";
  ta.addEventListener("input", () => {
    ch.background = ta.value;
    autoresize(ta);
    debouncedSave();
  });
  requestAnimationFrame(() => autoresize(ta));
  return el("div", { class: "sc-edit-form" }, [ta, makeDoneBtn(done)]);
}

function editFactionsRels(ch, appData, persistMembership, done) {
  // ── Factions ──
  const chipRowEl = el("div", { class: "sc-faction-chips" });
  const comboWrap = el("div", { class: "faction-combobox-wrap" });

  function refreshFactions() {
    clear(chipRowEl);
    const factions = (ch.factionIds ?? [])
      .map(fId => appData.factions.find(f => f.id === fId))
      .filter(Boolean);

    if (factions.length) {
      for (const f of factions) {
        const chip = el("span", { class: "faction-chip faction-chip--removable" }, [
          el("a", { class: "faction-chip-name", href: `#/factions/${f.id}` }, [f.name]),
          el("button", { class: "faction-chip-remove", onclick: () => removeFaction(f.id) }, ["×"]),
        ]);
        if (f.color) { chip.style.background = f.color; chip.style.color = chipTextColor(f.color); }
        chipRowEl.append(chip);
      }
    } else {
      chipRowEl.append(el("span", { class: "sheet-empty-note" }, ["No factions assigned."]));
    }

    clear(comboWrap);
    const available = appData.factions
      .filter(f => !(ch.factionIds ?? []).includes(f.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (available.length) {
      comboWrap.append(createCombobox({
        items: available.map(f => ({ value: f.id, label: f.name })),
        value: "",
        placeholder: "Add faction…",
        onChange: (fId) => { if (fId) addFaction(fId); },
      }));
    }
  }

  function addFaction(fId) {
    const f = appData.factions.find(f2 => f2.id === fId);
    if (!f || f.memberIds.includes(ch.id)) return;
    f.memberIds.push(ch.id);
    syncFactionMembership(appData.characters, appData.factions);
    persistMembership();
    refreshFactions();
  }

  function removeFaction(fId) {
    const f = appData.factions.find(f2 => f2.id === fId);
    if (!f) return;
    const idx = f.memberIds.indexOf(ch.id);
    if (idx !== -1) f.memberIds.splice(idx, 1);
    syncFactionMembership(appData.characters, appData.factions);
    persistMembership();
    refreshFactions();
  }

  refreshFactions();

  // ── Relationships (in-place refresh — doesn't close the card) ──
  const relsEl = el("div", { class: "rels-list" });
  function refreshRels() { refreshRelsEl(relsEl, ch, appData, refreshRels); }
  refreshRels();

  return el("div", { class: "sc-edit-form" }, [
    el("p", { class: "sc-sublabel" }, ["Factions"]),
    chipRowEl,
    comboWrap,
    el("div", { class: "sc-rels-header" }, [
      el("span", { class: "sc-sublabel" }, ["Relationships"]),
      el("div", { class: "sc-rels-btns" }, [
        el("button", { class: "btn-small", onclick: async () => {
          const { openRelationshipBulkDialog } = await import("./relationship-bulk-dialog.js");
          openRelationshipBulkDialog({ mode: "edit", holderId: ch.id, appData, onClose: refreshRels });
        }}, ["Edit"]),
        el("button", { class: "btn-small", onclick: async () => {
          const { openRelationshipBulkDialog } = await import("./relationship-bulk-dialog.js");
          openRelationshipBulkDialog({ mode: "add", holderId: ch.id, appData, onClose: refreshRels });
        }}, ["+ Add"]),
      ]),
    ]),
    relsEl,
    makeDoneBtn(done),
  ]);
}

// ── Button row ────────────────────────────────────────────────────────────────

function makeButtonRow(ch, appData) {
  const relBtn = el("button", { class: "sheet-action-btn", "data-action": "relationship-web" });
  relBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8" y1="11" x2="16" y2="7"/><line x1="8" y1="13" x2="16" y2="17"/></svg><span>Relationships</span>`;
  relBtn.addEventListener("click", async () => {
    const { openRelationshipWeb } = await import("./relationship-web.js");
    openRelationshipWeb(ch.id, appData);
  });

  const facBtn = el("button", { class: "sheet-action-btn", "data-action": "faction-web", title: "Faction Web" });
  facBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><line x1="10" y1="11" x2="5" y2="7"/><line x1="14" y1="11" x2="19" y2="7"/><line x1="10" y1="13" x2="5" y2="17"/><line x1="14" y1="13" x2="19" y2="17"/></svg><span>Factions</span>`;
  facBtn.addEventListener("click", async () => {
    const { openFactionWeb } = await import("./faction-web.js");
    openFactionWeb(ch.id, appData);
  });

  const tlBtn = el("button", { class: "sheet-action-btn", "data-action": "personal-timeline", title: "Personal Timeline" });
  tlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/></svg><span>Timeline</span>`;
  tlBtn.addEventListener("click", async () => {
    const { openPersonalTimeline } = await import("./personal-timeline.js");
    openPersonalTimeline(ch.id, appData);
  });

  return el("div", { class: "sheet-button-row" }, [relBtn, facBtn, tlBtn]);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function mountCharacterSheet(container, appData, id) {
  const character = appData.characters.find(c => c.id === id);
  if (!character) {
    container.append(el("p", { class: "placeholder-view" }, ["Character not found."]));
    return;
  }

  // Persist helpers — defined once, survive show() re-renders.
  const cardState = { close: null };

  function persistNow() {
    character.updatedAt = new Date().toISOString();
    return save("characters", appData.characters);
  }
  const debouncedSave = debounce(persistNow, 400);

  function persistMembership() {
    return Promise.all([
      save("characters", appData.characters),
      save("factions", appData.factions),
    ]);
  }

  // Escape closes whichever card is in edit mode.
  function onEsc(e) {
    if (e.key === "Escape" && cardState.close) {
      cardState.close();
      e.stopPropagation();
    }
  }
  document.addEventListener("keydown", onEsc);

  function show() {
    // Reset open card state (DOM is cleared, old close fn would target detached nodes).
    cardState.close = null;
    clear(container);

    // Editable card factory — closed over cardState so only one card opens at a time.
    function makeEditCard(key, title, renderROFn, renderEditFn) {
      const bodyEl = el("div", { class: "sheet-card-body" });
      const cardEl = el("section", { class: "sheet-card", "data-card": key });
      bodyEl.append(renderROFn());

      function doClose() {
        cardState.close = null;
        cardEl.removeAttribute("data-editing");
        clear(bodyEl);
        bodyEl.append(renderROFn());
      }

      function doOpen() {
        if (cardState.close) cardState.close();
        cardState.close = doClose;
        cardEl.setAttribute("data-editing", "");
        clear(bodyEl);
        bodyEl.append(renderEditFn(doClose));
      }

      const pencilBtn = el("button", { class: "sheet-card-edit", title: "Edit" });
      pencilBtn.innerHTML = PENCIL_SVG;
      pencilBtn.addEventListener("click", doOpen);

      cardEl.append(
        el("header", { class: "sheet-card-header" }, [
          el("h3", { class: "sheet-card-title" }, [title]),
          pencilBtn,
        ]),
        bodyEl,
      );
      return cardEl;
    }

    // Rels change in read-only mode → full re-render.
    function onRelsChange() { show(); }

    const name     = displayName(character);
    const akas     = (character.akaAliasIndices ?? []).map(i => character.aliases?.[i]).filter(Boolean);
    const deathStr = character.deathDate ? formatLongDate(character.deathDate) : null;

    const leftCol = el("div", { class: "sheet-main" }, [
      makeEditCard("identity", "Identity",
        () => renderIdentityRO(character, appData),
        (done) => editIdentity(character, appData, debouncedSave, persistNow, done)),
      makeButtonRow(character, appData),
      makeEditCard("summary", "Summary",
        () => renderSummaryRO(character),
        (done) => editSummary(character, debouncedSave, done)),
      makeEditCard("background", "Background",
        () => renderBackgroundRO(character),
        (done) => editBackground(character, debouncedSave, done)),
    ]);

    const rightCol = el("div", { class: "sheet-cards" }, [
      makeEditCard("zodiac", "Zodiac",
        () => renderZodiacRO(character, appData),
        (done) => editZodiac(character, appData, persistNow, debouncedSave, done)),
      makeEditCard("languages", "Languages",
        () => renderLanguagesRO(character),
        (done) => editLanguages(character, appData, persistNow, done)),
      makeEditCard("skills", "Skills",
        () => renderSkillsRO(character),
        (done) => editSkills(character, debouncedSave, done)),
      makeEditCard("factions-rels", "Factions & Relationships",
        () => renderFactionsRelsRO(character, appData, onRelsChange),
        (done) => editFactionsRels(character, appData, persistMembership, done)),
      makeCard("current", "Current", renderCurrentRO(character, appData)),
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
    if (!container.isConnected) { cleanup(); return; }
    show();
  }

  function onRouteChange() { cleanup(); }

  function cleanup() {
    document.removeEventListener("keydown", onEsc);
    window.removeEventListener("current-date-change", onDateChange);
    window.removeEventListener("route-change", onRouteChange);
  }

  window.addEventListener("current-date-change", onDateChange);
  window.addEventListener("route-change", onRouteChange);

  show();
}
