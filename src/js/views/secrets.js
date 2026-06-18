import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { createSecret, computeStatus, STATUS_TIERS, statusSlug, displayName } from "../schema.js";

const STORE_KEY = "oxford-filters-secrets";

function loadFilterState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        search:   s.search   ?? "",
        ownerIds: Array.isArray(s.ownerIds) ? s.ownerIds : [],
        statuses: Array.isArray(s.statuses) ? s.statuses : [],
      };
    }
  } catch {}
  return { search: "", ownerIds: [], statuses: [] };
}

function saveFilterState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

function applyFilter(secrets, state, showArchived) {
  let result = secrets.filter(s => !!s.archived === showArchived);

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(s =>
      (s.title ?? "").toLowerCase().includes(q) ||
      (s.summary ?? "").toLowerCase().includes(q) ||
      (s.body ?? "").toLowerCase().includes(q) ||
      (s.tags ?? []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (state.ownerIds.length) {
    result = result.filter(s =>
      state.ownerIds.some(id =>
        (s.ownerCharacterIds ?? []).includes(id) || (s.ownerFactionIds ?? []).includes(id)
      )
    );
  }

  if (state.statuses.length) {
    result = result.filter(s => state.statuses.includes(computeStatus(s)));
  }

  return result;
}

function renderCard(secret, appData) {
  const status = computeStatus(secret);
  const slug   = statusSlug(status);

  const ownerNames = [
    ...(secret.ownerCharacterIds ?? []).map(id => {
      const c = appData.characters.find(ch => ch.id === id);
      return c ? displayName(c) : null;
    }),
    ...(secret.ownerFactionIds ?? []).map(id => {
      const f = appData.factions.find(f2 => f2.id === id);
      return f?.name ?? null;
    }),
  ].filter(Boolean);

  const metaParts = [];
  if (ownerNames.length) metaParts.push(ownerNames.join(", "));
  metaParts.push(`${(secret.knownToIds ?? []).length} known`);
  if ((secret.hiddenFromIds ?? []).length) metaParts.push(`${secret.hiddenFromIds.length} hidden`);

  const card = el("article", { class: "secret-card" }, [
    el("div", { class: "secret-card-header" }, [
      el("h2", { class: "secret-card-title" }, [secret.title || "(untitled)"]),
      el("span", { class: `status-chip status-chip--${slug}` }, [status]),
    ]),
    secret.summary ? el("p", { class: "secret-card-summary" }, [secret.summary]) : null,
    el("p", { class: "secret-card-meta" }, [metaParts.join(" · ")]),
  ]);
  card.addEventListener("click", () => navigate(`secrets/${secret.id}`));
  return card;
}

export function mountSecrets(container, appData) {
  let showArchived = false;
  let filterState  = loadFilterState();

  const grid = el("div", { class: "secret-grid" });

  function renderGrid() {
    clear(grid);
    const visible = applyFilter(appData.secrets ?? [], filterState, showArchived);
    if (!visible.length) {
      const emptyEl = el("div", { class: "secret-empty" }, [
        el("p", {}, [showArchived ? "No archived secrets." : "No secrets yet."]),
      ]);
      if (!showArchived) {
        const newBtn = el("button", { class: "btn-primary" }, ["New secret"]);
        newBtn.addEventListener("click", handleNew);
        emptyEl.append(newBtn);
      }
      grid.append(emptyEl);
    } else {
      for (const s of visible) grid.append(renderCard(s, appData));
    }
  }

  function onChange() {
    saveFilterState(filterState);
    renderGrid();
  }

  async function handleNew() {
    const secret = createSecret();
    (appData.secrets ??= []).push(secret);
    await save("secrets", appData.secrets);
    navigate(`secrets/${secret.id}`);
  }

  // ── Active / Archived toggle ──
  const activeBtn   = el("button", { class: "factions-view-toggle-btn is-active" }, ["Active"]);
  const archivedBtn = el("button", { class: "factions-view-toggle-btn" }, ["Archived"]);
  activeBtn.addEventListener("click", () => {
    if (showArchived) {
      showArchived = false;
      activeBtn.classList.add("is-active");
      archivedBtn.classList.remove("is-active");
      renderGrid();
    }
  });
  archivedBtn.addEventListener("click", () => {
    if (!showArchived) {
      showArchived = true;
      archivedBtn.classList.add("is-active");
      activeBtn.classList.remove("is-active");
      renderGrid();
    }
  });

  // ── Search ──
  const searchInput = el("input", {
    type: "text", placeholder: "Search secrets…", class: "filter-search",
  });
  searchInput.value = filterState.search;
  searchInput.addEventListener("input", () => { filterState.search = searchInput.value; onChange(); });

  // ── Status toggles ──
  const statusFiltersEl = el("div", { class: "secret-status-filters" });
  for (const tier of STATUS_TIERS) {
    const btn = el("button", {
      class: "secret-status-toggle" + (filterState.statuses.includes(tier.name) ? " is-active" : ""),
      "data-status": tier.name,
    }, [tier.name]);
    btn.addEventListener("click", () => {
      const idx = filterState.statuses.indexOf(tier.name);
      if (idx === -1) { filterState.statuses.push(tier.name); btn.classList.add("is-active"); }
      else            { filterState.statuses.splice(idx, 1);  btn.classList.remove("is-active"); }
      onChange();
    });
    statusFiltersEl.append(btn);
  }

  // ── Owner filter ──
  const ownerChipsEl = el("div", { class: "filter-faction-chips" });

  function renderOwnerChips() {
    clear(ownerChipsEl);
    for (const ownerId of filterState.ownerIds) {
      const c = appData.characters.find(ch => ch.id === ownerId);
      const f = appData.factions.find(f2 => f2.id === ownerId);
      const name = c ? displayName(c) : (f?.name ?? ownerId);
      ownerChipsEl.append(el("span", { class: "filter-faction-active-chip" }, [
        name,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          filterState.ownerIds = filterState.ownerIds.filter(id => id !== ownerId);
          renderOwnerChips();
          onChange();
        }}, ["×"]),
      ]));
    }
  }

  const ownerSelect = el("select", { class: "filter-faction-select" });
  ownerSelect.append(el("option", { value: "" }, ["Filter by owner…"]));
  const charGroup = el("optgroup", { label: "Characters" });
  for (const c of [...appData.characters].sort((a, b) => displayName(a).localeCompare(displayName(b)))) {
    charGroup.append(el("option", { value: c.id }, [displayName(c)]));
  }
  const facGroup = el("optgroup", { label: "Factions" });
  for (const f of appData.factions) {
    facGroup.append(el("option", { value: f.id }, [f.name]));
  }
  ownerSelect.append(charGroup, facGroup);
  ownerSelect.addEventListener("change", () => {
    const val = ownerSelect.value;
    if (!val || filterState.ownerIds.includes(val)) { ownerSelect.value = ""; return; }
    filterState.ownerIds = [...filterState.ownerIds, val];
    ownerSelect.value = "";
    renderOwnerChips();
    onChange();
  });
  renderOwnerChips();

  renderGrid();

  // ── Secret plotlines section ──
  const secretPlotlines = (appData.plotlines ?? []).filter(pl => pl.isSecret);
  if (secretPlotlines.length) {
    const cards = secretPlotlines.map(pl => {
      const card = el("div", { class: "secret-plotline-card" });
      card.style.setProperty("--pl-color", pl.color ?? "#4a6b8a");
      card.addEventListener("click", () => navigate(`plotlines/${pl.id}`));
      card.append(
        el("div", { class: "secret-plotline-color-bar" }),
        el("div", { class: "secret-plotline-body" }, [
          el("h3", { class: "secret-plotline-title" }, [pl.title || "Untitled"]),
          pl.summary ? el("p", { class: "secret-plotline-summary" }, [pl.summary]) : null,
        ].filter(Boolean)),
      );
      return card;
    });
    container.append(el("div", { class: "secret-plotlines-section" }, [
      el("h2", { class: "secret-plotlines-heading" }, ["Secret Plotlines"]),
      el("div", { class: "secret-plotlines-grid" }, cards),
    ]));
  }

  container.append(
    el("div", { class: "secrets-toolbar" }, [
      el("button", { class: "btn-primary", onclick: handleNew }, ["New secret"]),
      el("div", { class: "factions-view-toggle" }, [activeBtn, archivedBtn]),
    ]),
    el("div", { class: "secrets-filter-bar" }, [
      searchInput,
      ownerSelect,
      ownerChipsEl,
      statusFiltersEl,
    ]),
    grid
  );
}
