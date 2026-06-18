import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createFaction, displayName } from "../schema.js";
import { createFilterBar } from "../filters.js";
import { mountFactionMap } from "./faction-map.js";

function applyFilters(factions, { search }) {
  if (!search) return factions;
  const q = search.toLowerCase();
  return factions.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.summary.toLowerCase().includes(q) ||
    f.agenda.toLowerCase().includes(q)
  );
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
        ? el("span", { class: "faction-card-leader" }, [`Led by ${displayName(leader)}`])
        : null,
    ]),
  ]);

  if (faction.color) card.style.setProperty("--faction-color", faction.color);
  card.addEventListener("click", () => navigate(`factions/${faction.id}`));
  return card;
}

export function mountFactions(container, appData) {
  let currentView = "list";
  let teardownMap = null;
  let lastState   = { search: "", facetValues: {} };

  async function handleNew() {
    const faction = createFaction();
    appData.factions.push(faction);
    await save("factions", appData.factions);
    navigate(`factions/${faction.id}`);
  }

  const filterBar = createFilterBar({
    searchPlaceholder: "Search factions",
    facets: [],
  }, { persistKey: "factions" });

  const grid = el("div", { class: "faction-grid" });

  async function renderContent(state) {
    lastState = state;
    if (teardownMap) { teardownMap(); teardownMap = null; }
    clear(grid);
    if (currentView === "list") {
      const visible = applyFilters(appData.factions, state);
      if (!visible.length) {
        grid.append(el("p", { class: "faction-empty" }, ["No factions match."]));
      } else {
        for (const f of visible) grid.append(renderFactionCard(f, appData.characters));
      }
    } else {
      teardownMap = await mountFactionMap(grid, appData, { search: state.search });
    }
  }

  const listBtn = el("button", { onclick: () => switchView("list") }, ["List"]);
  const mapBtn  = el("button", { onclick: () => switchView("map") }, ["Map"]);
  listBtn.classList.add("is-active");
  const viewToggle = el("div", { class: "factions-view-toggle" }, [listBtn, mapBtn]);

  function switchView(view) {
    currentView = view;
    listBtn.classList.toggle("is-active", view === "list");
    mapBtn.classList.toggle("is-active", view === "map");
    renderContent(lastState);
  }

  filterBar.subscribe(state => renderContent(state));
  renderContent(lastState);

  container.append(
    el("div", { class: "factions-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New faction"]),
      viewToggle,
    ]),
    filterBar.node,
    grid
  );
}
