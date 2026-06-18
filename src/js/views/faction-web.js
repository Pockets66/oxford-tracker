import cytoscape from "../../vendor/cytoscape.esm.min.js";
import { el } from "../dom.js";
import { displayName } from "../schema.js";
import { navigate } from "../router.js";
import { ownerColor } from "../util/owner-color.js";

export function openFactionWeb(characterId, appData) {
  const character = appData.characters.find(c => c.id === characterId);
  if (!character) return;

  const charFactionIds = new Set(character.factionIds ?? []);
  const factions = appData.factions.filter(f => charFactionIds.has(f.id));

  let cy = null;

  function closeModal() {
    document.removeEventListener("keydown", onEsc);
    cy?.destroy();
    cy = null;
    backdrop.remove();
  }

  function onEsc(e) { if (e.key === "Escape") closeModal(); }
  document.addEventListener("keydown", onEsc);

  const backdrop = el("div", { class: "rweb-backdrop" });
  const closeBtn = el("button", { class: "btn-small", onclick: () => closeModal() }, ["Close"]);
  const topbar = el("div", { class: "rweb-topbar" }, [
    el("span", { class: "rweb-title" }, [`${displayName(character)} — Factions`]),
    el("div", { class: "rweb-topbar-actions" }, [closeBtn]),
  ]);
  const body = el("div", { class: "rweb-body" });
  const modal = el("div", { class: "rweb-modal" }, [topbar, body]);
  backdrop.append(modal);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
  document.body.append(backdrop);

  if (!factions.length) {
    body.append(el("div", { class: "placeholder-view" }, [
      "Not a member of any factions yet.",
    ]));
    return;
  }

  const cssVars = getComputedStyle(document.documentElement);
  const v = (name) => cssVars.getPropertyValue(name).trim();

  const elements = [];

  for (const f of factions) {
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

  const addedChars = new Set();
  for (const f of factions) {
    for (const mid of f.memberIds ?? []) {
      const c = appData.characters.find(ch => ch.id === mid);
      if (!c) continue;
      if (!addedChars.has(mid)) {
        addedChars.add(mid);
        elements.push({
          data: {
            id:          `character:${c.id}`,
            label:       displayName(c),
            kind:        "character",
            color:       ownerColor(c.owner),
            characterId: c.id,
            deceased:    c.deceased || false,
            isViewing:   c.id === characterId,
          },
        });
      }
      elements.push({
        data: {
          id:        `edge:${mid}:${f.id}`,
          source:    `character:${mid}`,
          target:    `faction:${f.id}`,
          edgeColor: f.color || "#888",
        },
      });
    }
  }

  const canvas = el("div", { class: "fweb-canvas" });
  body.append(canvas);

  cy = cytoscape({
    container: canvas,
    elements,
    layout: {
      name:            "cose",
      animate:         false,
      fit:             true,
      padding:         40,
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
        selector: "node[?isViewing]",
        style: {
          "width":        36,
          "height":       36,
          "border-width": 2,
          "border-color": v("--gold"),
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
    const kind      = e.target.data("kind");
    const isViewing = e.target.data("isViewing");
    if (kind === "faction") {
      e.target.style({ "border-color": v("--text"), "border-width": 2 });
    } else {
      e.target.style({
        "border-color": isViewing ? v("--gold") : v("--border"),
        "border-width": isViewing ? 2 : 1,
      });
    }
    document.body.style.cursor = "";
  });

  cy.on("tap", "node[kind = 'faction']", e => {
    closeModal();
    navigate(`factions/${e.target.data("factionId")}`);
  });
  cy.on("tap", "node[kind = 'character']", e => {
    const cid = e.target.data("characterId");
    if (cid === characterId) return;
    closeModal();
    navigate(`characters/${cid}`);
  });
}
