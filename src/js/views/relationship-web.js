import cytoscape from "../../vendor/cytoscape.esm.min.js";
import { el, clear } from "../dom.js";
import { displayName } from "../schema.js";
import { navigate } from "../router.js";

function edgeLabel(rel) {
  return rel.structuralType || rel.socialLabels?.[0] || "";
}

function feelingsString(rel) {
  return [rel.platonic, rel.romantic].filter(Boolean).join(" · ");
}

export function openRelationshipWeb(centerId, appData) {
  const center = appData.characters.find(c => c.id === centerId);
  if (!center) return;

  const rels = (appData.relationships ?? []).filter(r => r.from === centerId || r.to === centerId);

  // Collect all character ids involved.
  const charIds = new Set([centerId]);
  for (const r of rels) { charIds.add(r.from); charIds.add(r.to); }

  // Read CSS variables once.
  const cssVars = getComputedStyle(document.documentElement);
  const v = (name) => cssVars.getPropertyValue(name).trim();

  const ownerColorMap = {
    Bree:   v("--owner-bree"),
    Jack:   v("--owner-jack"),
    Nicole: v("--owner-nicole"),
    Caiden: v("--owner-caiden"),
    NPC:    v("--owner-npc"),
  };

  function ownerColor(owner) {
    const first = (owner || "NPC").split(",")[0].trim();
    return ownerColorMap[first] || ownerColorMap.NPC;
  }

  const nodes = [...charIds].map(cid => {
    const c = appData.characters.find(ch => ch.id === cid);
    if (!c) return null;
    return {
      data: {
        id:         c.id,
        label:      displayName(c),
        ownerColor: ownerColor(c.owner),
        deceased:   c.deceased || false,
        isCenter:   c.id === centerId,
      },
    };
  }).filter(Boolean);

  const edges = rels.map(r => {
    const fromChar = appData.characters.find(c => c.id === r.from);
    const toChar   = appData.characters.find(c => c.id === r.to);
    return {
      data: {
        id:       r.id,
        source:   r.from,
        target:   r.to,
        label:    edgeLabel(r),
        feelings: feelingsString(r),
        frozen:   !!(fromChar?.deceased || toChar?.deceased),
      },
    };
  });

  // ── Build modal DOM ──────────────────────────────────────────────────────
  const tooltip = el("div", { class: "rweb-tooltip" });
  tooltip.style.display = "none";
  document.body.append(tooltip);

  let cy = null;

  function closeWeb() {
    document.removeEventListener("keydown", onEsc);
    tooltip.style.display = "none";
    tooltip.remove();
    cy?.destroy();
    cy = null;
    backdrop.remove();
  }

  function onEsc(e) { if (e.key === "Escape") closeWeb(); }
  document.addEventListener("keydown", onEsc);

  const backdrop = el("div", { class: "rweb-backdrop" });

  const sheetBtn = el("button", { class: "btn-small", onclick: () => {
    closeWeb();
    navigate(`characters/${centerId}`);
  }}, ["Character Sheet"]);

  const closeBtn = el("button", { class: "btn-small", onclick: () => closeWeb() }, ["Close"]);

  const topbar = el("div", { class: "rweb-topbar" }, [
    el("span", { class: "rweb-title" }, [displayName(center)]),
    el("div",  { class: "rweb-topbar-actions" }, [sheetBtn, closeBtn]),
  ]);

  const body = el("div", { class: "rweb-body" });
  const modal = el("div", { class: "rweb-modal" }, [topbar, body]);
  backdrop.append(modal);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeWeb(); });
  document.body.append(backdrop);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!rels.length) {
    body.append(el("div", { class: "placeholder-view" }, [
      "No relationships yet. Add some from the character sheet.",
    ]));
    return;
  }

  // ── Cytoscape instance ───────────────────────────────────────────────────
  const canvas = el("div", { class: "rweb-canvas" });
  body.append(canvas);

  cy = cytoscape({
    container: canvas,
    elements:  [...nodes, ...edges],
    layout: {
      name:           "concentric",
      concentric:     (node) => node.data("isCenter") ? 100 : 1,
      levelWidth:     () => 1,
      minNodeSpacing: 80,
      spacingFactor:  1.2,
      animate:        false,
    },
    style: [
      {
        selector: "node",
        style: {
          "background-color":       "data(ownerColor)",
          "width":                  44,
          "height":                 44,
          "border-width":           1,
          "border-color":           v("--border"),
          "label":                  "data(label)",
          "font-family":            "'EB Garamond', Georgia, serif",
          "font-size":              12,
          "color":                  v("--text"),
          "text-wrap":              "wrap",
          "text-max-width":         90,
          "text-valign":            "bottom",
          "text-margin-y":          8,
          "text-background-color":  v("--bg-surface"),
          "text-background-opacity": 0.8,
          "text-background-padding": "2px",
        },
      },
      {
        selector: "node[?isCenter]",
        style: {
          "width":        60,
          "height":       60,
          "border-width": 2,
          "border-color": v("--text"),
        },
      },
      {
        selector: "node[?deceased]",
        style: { "opacity": 0.45 },
      },
      {
        selector: "edge",
        style: {
          "curve-style":              "bezier",
          "control-point-step-size":  40,
          "width":                    1.5,
          "line-color":               v("--text-muted"),
          "target-arrow-shape":       "triangle",
          "target-arrow-color":       v("--text-muted"),
          "arrow-scale":              0.8,
          "label":                    "data(label)",
          "font-size":                9,
          "font-family":              "Inter, system-ui, sans-serif",
          "color":                    v("--text-muted"),
          "text-rotation":            "autorotate",
          "text-background-color":    v("--bg-surface"),
          "text-background-opacity":  0.85,
          "text-background-padding":  "2px",
        },
      },
      {
        selector: "edge[?frozen]",
        style: { "opacity": 0.4 },
      },
    ],
    userZoomingEnabled:   true,
    userPanningEnabled:   true,
    boxSelectionEnabled:  false,
    autounselectify:      true,
  });

  // ── Node hover ───────────────────────────────────────────────────────────
  cy.on("mouseover", "node", e => {
    if (e.target.data("isCenter")) return;
    e.target.style({ "border-color": v("--gold"), "border-width": 2 });
    document.body.style.cursor = "pointer";
  });
  cy.on("mouseout", "node", e => {
    if (e.target.data("isCenter")) return;
    e.target.style({ "border-color": v("--border"), "border-width": 1 });
    document.body.style.cursor = "";
  });

  // ── Edge hover + tooltip ─────────────────────────────────────────────────
  cy.on("mouseover", "edge", e => {
    e.target.style({
      "line-color":         v("--accent"),
      "target-arrow-color": v("--accent"),
      "width":              2,
    });
    const feelings = e.target.data("feelings");
    if (feelings) {
      tooltip.textContent = feelings;
      tooltip.style.display = "block";
    }
  });
  cy.on("mousemove", e => {
    if (tooltip.style.display === "none") return;
    tooltip.style.left = (e.originalEvent.pageX + 12) + "px";
    tooltip.style.top  = (e.originalEvent.pageY + 12) + "px";
  });
  cy.on("mouseout", "edge", e => {
    e.target.style({
      "line-color":         v("--text-muted"),
      "target-arrow-color": v("--text-muted"),
      "width":              1.5,
    });
    tooltip.style.display = "none";
  });

  // ── Click non-center node to re-center ───────────────────────────────────
  cy.on("tap", "node", e => {
    const nodeId = e.target.id();
    if (nodeId === centerId) return;
    openRelationshipWeb(nodeId, appData);
    closeWeb();
  });
}
