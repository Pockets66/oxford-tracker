# Slice 4: Relationship Web

Read CLAUDE.md and ROADMAP.md. Slice 2.8 must be done. Medium effort.

## Files to read first

- `src/js/views/character-sheet.js`
- `src/js/schema.js`
- `src/css/theme.css`
- `src/css/sheet.css`
- `src/css/dialog.css`
- `src/index.html`
- `ROADMAP.md`

Nothing else.

## Goal

A modal overlay that visualizes the selected character's first-degree relationship network as a Cytoscape graph. Opens from a button on the character sheet. Center node is the character. Surrounding nodes are everyone they have a direct relationship with. Directional edges labeled with structural type or first social label. Tooltip on edge hover shows feelings. Click any other node to re-center the web on that character. Button to close the modal and return to the sheet.

## Dependency

Vendor Cytoscape rather than CDN. Use the unpkg or jsdelivr-hosted ES module build saved into `src/vendor/cytoscape.esm.min.js`. Download it once and commit it. This avoids any runtime network dependency in the packaged Electron app.

Get it from: `https://unpkg.com/cytoscape@3.30.2/dist/cytoscape.esm.min.js`

Save to `src/vendor/cytoscape.esm.min.js`. Import like:
```js
import cytoscape from "../vendor/cytoscape.esm.min.js";
```

Do NOT add it to package.json. Vendored only.

## New files

- `src/js/views/relationship-web.js` — modal renderer
- `src/css/relationship-web.css` — modal + cytoscape container styles
- `src/vendor/cytoscape.esm.min.js` — the library

## Files to touch

- `src/js/views/character-sheet.js` — add the "Open Relationship Web" button
- `src/index.html` — link the new CSS
- `ROADMAP.md` — mark slice 4 done

## Files to leave alone

Everything else, especially: storage.js, router.js, app.js boot sequence, the relationship dialog from slice 2.8, the schema, all other views.

## The button

Add to the character sheet's relationships section header. Currently the header has the section title plus the "+ Add relationship" button. Add a second button next to it: `Open Relationship Web`. Use `.btn-small` styling to match. Clicking it calls `openRelationshipWeb(character.id, appData)`.

## Modal structure

`openRelationshipWeb(centerId, appData)` creates a full-screen modal:

- Backdrop: `--bg` at 92% opacity, click to close
- Container: ~90vw × 90vh, centered, `--bg-surface` background, `--gold` 1px border
- Top bar inside the modal:
  - Left: the centered character's displayName in EB Garamond 1.4rem
  - Right: two buttons:
    - "Character Sheet" — closes modal and navigates to `#/characters/{centerId}` (which is probably where the user already is, but harmless)
    - "Close" — closes modal, returns to where user was
- Body: the Cytoscape canvas, fills the rest of the modal

Modal Esc key closes it.

## Cytoscape setup

Layout: `concentric` with the center node pinned to the middle.

```js
{
  name: "concentric",
  concentric: (node) => node.data("isCenter") ? 100 : 1,
  levelWidth: () => 1,
  minNodeSpacing: 80,
  spacingFactor: 1.2,
  animate: false,
}
```

### Nodes

Build node data for the center character plus every character with at least one relationship to or from them:

```js
{
  data: {
    id: character.id,
    label: displayName(character),
    owner: character.owner,         // for color
    deceased: character.deceased,
    isCenter: character.id === centerId,
  }
}
```

### Edges

For each relationship edge in `appData.relationships` where `from === centerId` OR `to === centerId`:

```js
{
  data: {
    id: relationship.id,
    source: relationship.from,
    target: relationship.to,
    label: edgeLabel(relationship),       // see below
    feelings: feelingsString(relationship), // for tooltip
    frozen: <true if either endpoint is deceased>,
  }
}
```

### Edge label and tooltip

```js
function edgeLabel(rel) {
  return rel.structuralType || rel.socialLabels?.[0] || "";
}

function feelingsString(rel) {
  const parts = [];
  if (rel.platonic) parts.push(rel.platonic);
  if (rel.romantic) parts.push(rel.romantic);
  return parts.join(" · ");
}
```

The label appears on the edge line. The full feelings string appears as a custom tooltip on hover (see below).

## Cytoscape stylesheet

Define node and edge styles using CSS variables read from the document. Build the style string in JS:

```js
const css = getComputedStyle(document.documentElement);
const v = (name) => css.getPropertyValue(name).trim();

const ownerColor = (owner) => {
  const map = {
    Bree: v("--owner-bree"),
    Jack: v("--owner-jack"),
    Nicole: v("--owner-nicole"),
    Caiden: v("--owner-caiden"),
    NPC: v("--owner-npc"),
  };
  // For multi-owner, just use the first.
  const first = (owner || "NPC").split(",")[0].trim();
  return map[first] || map.NPC;
};
```

Node style:
- Background color: `data(ownerColor)` (pre-compute and store per node)
- Width and height: 60 for center, 44 for others
- Border: 2px solid `--text` for the center, 1px solid `--border` for others
- Label: `data(label)`, font-family `'EB Garamond', Georgia, serif`, font-size 12, text color `--text`, text-wrap `wrap`, text-max-width 90
- Text-valign `bottom`, text-margin-y 8 (label sits below the node)
- For deceased nodes: opacity 0.45 (use a selector `node[?deceased]`)
- Hover state: border becomes `--gold` 2px

Edge style:
- Curve-style `bezier`
- Width 1.5
- Line color `--text-muted`
- Target arrow shape `triangle`, target arrow color `--text-muted`
- Label: `data(label)`, font-size 9, font-family Inter, color `--text-muted`
- Text rotation `autorotate` so labels follow the line direction
- Text background: `--bg-surface` with padding 2, so labels are readable against any background
- For frozen edges: opacity 0.4 (use a selector `edge[?frozen]`)
- Hover state: line and arrow color become `--accent`, width 2

Bidirectional pairs (which is most of them, since the new slice 2.8 dialog auto-creates reciprocals) will show as two parallel curved edges between the same node pair, one curving each way. Cytoscape handles this naturally with `curve-style: bezier` and a `control-point-step-size` of about 40.

## Tooltip on edge hover

Standard Cytoscape doesn't ship a tooltip. Build a simple one:

```js
const tooltip = el("div", { class: "rweb-tooltip" });
tooltip.style.display = "none";
document.body.append(tooltip);

cy.on("mouseover", "edge", (e) => {
  const feelings = e.target.data("feelings");
  if (!feelings) return;
  tooltip.textContent = feelings;
  tooltip.style.display = "block";
});

cy.on("mousemove", (e) => {
  if (tooltip.style.display === "none") return;
  tooltip.style.left = e.originalEvent.pageX + 12 + "px";
  tooltip.style.top  = e.originalEvent.pageY + 12 + "px";
});

cy.on("mouseout", "edge", () => {
  tooltip.style.display = "none";
});
```

Style `.rweb-tooltip`:
```css
.rweb-tooltip {
  position: fixed;
  z-index: 2100;
  background: var(--bg-raised);
  border: 1px solid var(--gold);
  color: var(--text);
  font-family: 'EB Garamond', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  padding: 0.3rem 0.6rem;
  pointer-events: none;
  white-space: nowrap;
}
```

Clean it up when the modal closes (remove from DOM).

## Re-centering on click

Clicking any non-center node calls `openRelationshipWeb(nodeId, appData)` again. The simplest implementation: tear down the current Cytoscape instance, clear the modal body, rebuild with the new center. (Cytoscape has a `.destroy()` method; use it.) Smooth enough for this scale.

Clicking the center node does nothing.

## Modal close handling

- Esc key
- Click on backdrop (but not on the modal itself)
- Close button
- "Character Sheet" button (navigates and closes)

All paths call a single `closeWeb()` that:
- Destroys the Cytoscape instance
- Removes the tooltip element
- Removes the modal from the DOM
- Removes the keydown listener

## Empty state

If the center character has zero relationships, render a placeholder inside the modal body instead of an empty Cytoscape:

> No relationships yet. Add some from the character sheet.

Style as `.placeholder-view` (existing class).

## Performance note

With 45 characters and 54 relationships, Cytoscape handles this instantly. No optimization needed.

## Definition of done

- Character sheet has an "Open Relationship Web" button in the relationships section header
- Clicking opens a modal with the character at center, all connected characters around them
- Edges are directional arrows with labels (structural type or first social label)
- Hovering an edge shows a tooltip with the feelings string
- Owner color shows on each node
- Deceased nodes are greyed
- Edges to/from deceased characters are greyed
- Clicking a non-center node re-centers the web on that character
- Close button, backdrop click, and Esc all close the modal cleanly
- ROADMAP.md updated
