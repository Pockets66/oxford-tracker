import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createCharacter, displayName } from "../schema.js";
import { createFilterBar } from "../filters.js";

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

function applyFilters(characters, { search, facetValues }) {
  let result = characters;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(c =>
      displayName(c).toLowerCase().includes(q) ||
      (c.aliases ?? []).some(a => a.toLowerCase().includes(q)) ||
      (c.previousNames ?? []).some(n => n.toLowerCase().includes(q)) ||
      c.summary.toLowerCase().includes(q)
    );
  }

  const ownerFilter = facetValues.owner ?? ALL_OWNERS;
  if (ownerFilter.length < ALL_OWNERS.length) {
    result = result.filter(c => {
      const owners = (c.owner || "NPC").split(",").map(s => s.trim());
      return ownerFilter.some(o => owners.includes(o));
    });
  }

  const factionFilter = facetValues.faction ?? [];
  if (factionFilter.length) {
    result = result.filter(c =>
      factionFilter.some(fId => (c.factionIds ?? []).includes(fId))
    );
  }

  if (!facetValues.showDeceased) {
    result = result.filter(c => !c.deceased);
  }

  return result;
}

function renderCard(character, factions) {
  const zodiacParts = [
    character.zodiac?.sun,
    character.zodiac?.moon,
    character.zodiac?.rising,
  ].filter(Boolean);

  const card = el("article", {
    class: "character-card" + (character.deceased ? " character-card--deceased" : ""),
    "data-owner": character.owner || "NPC",
  }, [
    character.deceased ? el("span", { class: "character-deceased-tag" }, ["Deceased"]) : null,
    el("h2", { class: "character-name" }, [displayName(character)]),
    character.aliases?.length ? el("p", { class: "character-aka" }, [`a.k.a. ${character.aliases[0]}`]) : null,
    (character.age || character.birthday) ? el("p", { class: "character-meta" }, [
      [character.age ? `Age ${character.age}` : null, character.birthday || null]
        .filter(Boolean).join(" · "),
    ]) : null,

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
  async function handleNew() {
    const character = createCharacter();
    appData.characters.push(character);
    await save("characters", appData.characters);
    navigate(`characters/${character.id}`);
  }

  const filterBar = createFilterBar({
    searchPlaceholder: "Search characters",
    facets: [
      {
        id: "owner", type: "owner-toggles",
        options: [
          { value: "Bree",   color: "var(--owner-bree)" },
          { value: "Jack",   color: "var(--owner-jack)" },
          { value: "Nicole", color: "var(--owner-nicole)" },
          { value: "Caiden", color: "var(--owner-caiden)" },
          { value: "NPC",    color: "var(--owner-npc)" },
        ],
      },
      {
        id: "faction", type: "faction-dropdown",
        options: (appData.factions ?? []).map(f => ({ value: f.id, label: f.name, color: f.color })),
      },
      {
        id: "showDeceased", label: "Show deceased",
        type: "toggle", defaultValue: true,
      },
    ],
  });

  const grid = el("div", { class: "character-grid" });
  const initialState = {
    search: "",
    facetValues: { owner: [...ALL_OWNERS], faction: [], showDeceased: true },
  };

  function renderGrid(state) {
    clear(grid);
    const visible = applyFilters(appData.characters, state);
    if (!visible.length) {
      grid.append(el("p", { class: "character-empty" }, ["No characters match."]));
    } else {
      for (const c of visible) grid.append(renderCard(c, appData.factions));
    }
  }

  filterBar.subscribe(state => renderGrid(state));
  renderGrid(initialState);

  container.append(
    el("div", { class: "characters-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New character"]),
    ]),
    filterBar.node,
    grid
  );
}
