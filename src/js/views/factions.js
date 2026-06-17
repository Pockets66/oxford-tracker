import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createFaction } from "../schema.js";
import { createFilterBar } from "../filters.js";

function applyFilters(factions, { search, facetValues }) {
  let result = factions;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q) ||
      f.agenda.toLowerCase().includes(q)
    );
  }

  const sizeFilter = facetValues.size ?? [];
  if (sizeFilter.length) {
    result = result.filter(f => {
      const n = f.memberIds.length;
      return sizeFilter.some(bucket => {
        if (bucket === "1–3")  return n >= 1 && n <= 3;
        if (bucket === "4–9")  return n >= 4 && n <= 9;
        if (bucket === "10+")  return n >= 10;
        return false;
      });
    });
  }

  if (facetValues.hasLeader) {
    result = result.filter(f => !!f.leaderId);
  }

  return result;
}

function renderFactionCard(faction, characters) {
  const leader = faction.leaderId
    ? characters.find(c => c.id === faction.leaderId)
    : null;

  const card = el("article", { class: "faction-card" }, [
    el("h2", { class: "faction-card-name" }, [faction.name || "Unnamed"]),
    faction.summary ? el("p", { class: "faction-card-summary" }, [faction.summary]) : null,
    el("div", { class: "faction-card-meta" }, [
      el("span", { class: "faction-card-count" }, [
        `${faction.memberIds.length} member${faction.memberIds.length !== 1 ? "s" : ""}`,
      ]),
      leader
        ? el("span", { class: "faction-card-leader" }, [`Led by ${leader.name}`])
        : null,
    ]),
  ]);

  if (faction.color) card.style.setProperty("--faction-color", faction.color);
  card.addEventListener("click", () => navigate(`factions/${faction.id}`));
  return card;
}

export function mountFactions(container, appData) {
  async function handleNew() {
    const faction = createFaction();
    appData.factions.push(faction);
    await save("factions", appData.factions);
    navigate(`factions/${faction.id}`);
  }

  const filterBar = createFilterBar({
    searchPlaceholder: "Search factions",
    facets: [
      {
        id: "size", label: "Member count", type: "multi",
        options: ["1–3", "4–9", "10+"],
      },
      {
        id: "hasLeader", label: "Has leader",
        type: "toggle", defaultValue: false,
      },
    ],
  });

  const grid = el("div", { class: "faction-grid" });
  const initialState = {
    search: "",
    facetValues: { size: [], hasLeader: false },
  };

  function renderGrid(state) {
    clear(grid);
    const visible = applyFilters(appData.factions, state);
    if (!visible.length) {
      grid.append(el("p", { class: "faction-empty" }, ["No factions match."]));
    } else {
      for (const f of visible) grid.append(renderFactionCard(f, appData.characters));
    }
  }

  filterBar.subscribe(state => renderGrid(state));
  renderGrid(initialState);

  container.append(
    el("div", { class: "factions-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New faction"]),
    ]),
    filterBar.node,
    grid
  );
}
