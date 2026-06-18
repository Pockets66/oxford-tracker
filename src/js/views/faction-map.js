import { el } from "../dom.js";
import { displayName } from "../schema.js";
import { navigate } from "../router.js";
import { ownerColor } from "../util/owner-color.js";

export async function openFactionMapModal(appData) {
  let teardown = null;

  function closeModal() {
    document.removeEventListener("keydown", onEsc);
    if (teardown) { teardown(); teardown = null; }
    backdrop.remove();
  }

  function onEsc(e) { if (e.key === "Escape") closeModal(); }
  document.addEventListener("keydown", onEsc);

  const backdrop = el("div", { class: "rweb-backdrop" });
  const closeBtn = el("button", { class: "btn-small", onclick: () => closeModal() }, ["Close"]);
  const topbar   = el("div",   { class: "rweb-topbar" }, [
    el("span", { class: "rweb-title" }, ["Faction Map"]),
    el("div",  { class: "rweb-topbar-actions" }, [closeBtn]),
  ]);
  const body   = el("div", { class: "rweb-body" });
  const modal  = el("div", { class: "rweb-modal" }, [topbar, body]);
  backdrop.append(modal);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
  document.body.append(backdrop);

  teardown = await mountFactionMap(body, appData);
}

export async function mountFactionMap(container, appData, { search = "" } = {}) {
  const { default: cytoscape } = await import("../../vendor/cytoscape.esm.min.js");

  const cssVars = getComputedStyle(document.documentElement);
  const v = (name) => cssVars.getPropertyValue(name).trim();

  const q = search.toLowerCase();

  // Filter factions by label match.
  const visibleFactions = q
    ? appData.factions.filter(f => f.name.toLowerCase().includes(q))
    : [...appData.factions];

  if (!visibleFactions.length) {
    const ph = el("p", { class: "faction-empty" }, ["No factions match."]);
    container.append(ph);
    return () => ph.remove();
  }

  const visibleFactionIds = new Set(visibleFactions.map(f => f.id));

  // Characters: must belong to at least one visible faction. If search set, label must match too.
  const charEntries = [];
  for (const c of appData.characters) {
    const memberOf = (c.factionIds ?? []).filter(fid => visibleFactionIds.has(fid));
    if (!memberOf.length) continue;
    if (q && !displayName(c).toLowerCase().includes(q)) continue;
    charEntries.push({ c, memberOf });
  }

  // Build Cytoscape elements.
  const elements = [];

  for (const f of visibleFactions) {
    elements.push({
      data: {
        id:        `faction:${f.id}`,
        label:     f.name,
        kind:      "faction",
        color:     f.color || "#888",
        factionId: f.id,
      },
    });
  }

  for (const { c, memberOf } of charEntries) {
    elements.push({
      data: {
        id:          `character:${c.id}`,
        label:       displayName(c),
        kind:        "character",
        color:       ownerColor(c.owner),
        characterId: c.id,
        deceased:    c.deceased || false,
      },
    });
    for (const fid of memberOf) {
      const f = appData.factions.find(f2 => f2.id === fid);
      elements.push({
        data: {
          id:        `edge:${c.id}:${fid}`,
          source:    `character:${c.id}`,
          target:    `faction:${fid}`,
          edgeColor: f?.color || "#888",
        },
      });
    }
  }

  const canvas = el("div", { class: "fmap-canvas" });
  container.append(canvas);

  const cy = cytoscape({
    container: canvas,
    elements,
    layout: {
      name:            "cose",
      animate:         false,
      fit:             true,
      padding:         30,
      nodeRepulsion:   () => 8000,
      idealEdgeLength: () => 100,
      edgeElasticity:  () => 100,
      gravity:         0.25,
      numIter:         1000,
    },
    style: [
      {
        selector: "node[kind = 'faction']",
        style: {
          "background-color": "data(color)",
          "width":            80,
          "height":           80,
          "border-width":     2,
          "border-color":     v("--text"),
          "label":            "data(label)",
          "font-family":      "'EB Garamond', Georgia, serif",
          "font-size":        14,
          "color":            v("--text"),
          "text-valign":      "center",
          "text-halign":      "center",
          "text-wrap":        "wrap",
          "text-max-width":   70,
        },
      },
      {
        selector: "node[kind = 'character']",
        style: {
          "background-color":        "data(color)",
          "width":                   28,
          "height":                  28,
          "border-width":            1,
          "border-color":            v("--border"),
          "label":                   "data(label)",
          "font-family":             "'EB Garamond', Georgia, serif",
          "font-size":               10,
          "color":                   v("--text"),
          "text-valign":             "bottom",
          "text-halign":             "center",
          "text-margin-y":           6,
          "text-wrap":               "wrap",
          "text-max-width":          80,
          "text-background-color":   v("--bg-surface"),
          "text-background-opacity": 0.8,
          "text-background-padding": "2px",
        },
      },
      {
        selector: "node[?deceased]",
        style: { "opacity": 0.45 },
      },
      {
        selector: "edge",
        style: {
          "curve-style":        "straight",
          "width":              1.2,
          "line-color":         "data(edgeColor)",
          "opacity":            0.5,
          "target-arrow-shape": "none",
        },
      },
    ],
    userZoomingEnabled:  true,
    userPanningEnabled:  true,
    boxSelectionEnabled: false,
    autounselectify:     true,
  });

  cy.on("mouseover", "node", e => {
    e.target.style({ "border-color": v("--gold"), "border-width": 3 });
    document.body.style.cursor = "pointer";
  });
  cy.on("mouseout", "node", e => {
    const kind = e.target.data("kind");
    e.target.style({
      "border-color": kind === "faction" ? v("--text") : v("--border"),
      "border-width": kind === "faction" ? 2 : 1,
    });
    document.body.style.cursor = "";
  });

  cy.on("tap", "node[kind = 'faction']",   e => navigate(`factions/${e.target.data("factionId")}`));
  cy.on("tap", "node[kind = 'character']", e => navigate(`characters/${e.target.data("characterId")}`));

  return () => { cy.destroy(); canvas.remove(); };
}
