# Slice 5: Faction Map

Read CLAUDE.md and ROADMAP.md. Slice 4 must be done. **Medium effort. Prefer surgical edits.**

**Migration policy:** This project has wiped `user-data/` for development. No migration code is needed in this slice. Schema changes apply to fresh-created entities only. The final data import happens after all slices land.

## Files to read first

- `src/js/views/factions.js`
- `src/js/views/relationship-web.js`
- `src/css/factions.css`
- `src/css/relationship-web.css`
- `src/js/schema.js`
- `ROADMAP.md`

Nothing else.

## Goal

Two things in this slice:

1. **Faction Map view** — toggle the Factions overview between List and Map. Map is a Cytoscape force-directed graph showing factions as large colored nodes and characters as small owner-colored nodes connected to their factions.
2. **Remove the "In the Know" concept from factions**. Add a `knowsSupernatural: false` field to `createCharacter()`. (No migration needed: a future data import won't include "In the Know" as a faction; instead the import will set `knowsSupernatural: true` on relevant characters.)

## Schema additions

In `src/js/schema.js`:

- Add `knowsSupernatural: false` to `createCharacter()`'s default object.
- Add `knowsSupernatural: false` to any character read from disk that doesn't have it (defensive defaulting at load, not a migration — just `c.knowsSupernatural ??= false` if you want). Bump `schemaVersion` if you like; not required since we are not migrating data.

The character sheet does not yet show a UI for `knowsSupernatural`. That's slice 5.5.

## Faction Map: new files

- `src/js/views/faction-map.js`
- `src/js/util/owner-color.js`  (extracted helper)
- `src/css/faction-map.css`

## Faction Map: files to touch

- `src/js/views/factions.js` — add the List/Map toggle, conditionally mount the map. **Surgical edit.** Do not rewrite the file.
- `src/js/views/relationship-web.js` — replace inline `ownerColor()` helper with import from the new util. **Surgical edit.** One import line plus deletion of the old helper.
- `src/index.html` — link the new CSS.
- `ROADMAP.md` — mark slice 5 done.

## Owner color helper

`src/js/util/owner-color.js`:

```js
export function ownerColor(owner) {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const map = {
    Bree:   v("--owner-bree"),
    Jack:   v("--owner-jack"),
    Nicole: v("--owner-nicole"),
    Caiden: v("--owner-caiden"),
    NPC:    v("--owner-npc"),
  };
  const first = (owner || "NPC").split(",")[0].trim();
  return map[first] || map.NPC;
}
```

In `relationship-web.js`, find the existing `ownerColor` helper block and the `ownerColorMap` definition. Replace them with a single import:

```js
import { ownerColor } from "../util/owner-color.js";
```

Existing `ownerColor(c.owner)` call sites stay unchanged.

## View toggle on the Factions overview

In `factions.js`, find the toolbar block that contains the "New faction" button. Add a segmented toggle to the right of it:

```
[New faction]                          [LIST | MAP]
```

Use a `let currentView = "list"` scoped inside `mountFactions`. Add the toggle as two buttons with class `factions-view-toggle`. Active button gets `is-active`. Clicking switches the variable and re-renders.

The filter bar subscription stays alive; on each fire, the callback re-checks `currentView` to decide whether to render the card grid or call `mountFactionMap`.

## Faction Map: rendering

In `faction-map.js`, export:

```js
export async function mountFactionMap(container, appData, { search = "" } = {})
```

Returns a teardown function the toggle can call when switching back to list.

Lazy-import Cytoscape:

```js
const { default: cytoscape } = await import("../../vendor/cytoscape.esm.min.js");
```

### Nodes

For each faction in `appData.factions`:

```js
{
  data: {
    id: `faction:${faction.id}`,
    label: faction.name,
    kind: "faction",
    color: faction.color || "#888",
    factionId: faction.id,
  }
}
```

For each character with at least one entry in `factionIds`:

```js
{
  data: {
    id: `character:${character.id}`,
    label: displayName(character),
    kind: "character",
    color: ownerColor(character.owner),
    characterId: character.id,
    deceased: character.deceased,
  }
}
```

### Edges

For each (character, faction) membership, one edge with the faction's color, no arrow, no label.

### Layout

```js
{
  name: "cose",
  animate: false,
  fit: true,
  padding: 30,
  nodeRepulsion: () => 8000,
  idealEdgeLength: () => 100,
  edgeElasticity: () => 100,
  gravity: 0.25,
  numIter: 1000,
}
```

### Styles

Use the same `v(name)` pattern as relationship-web.

- Faction nodes: 80px diameter, faction color background, 2px `--text` border, label center, EB Garamond 14
- Character nodes: 28px diameter, owner color, 1px `--border` border, label below with margin 6, EB Garamond 10, text background-fill for readability
- Deceased nodes: opacity 0.45
- Edges: straight, width 1.2, line color from data, opacity 0.5
- Hover/active node: gold border 3px

### Click handlers

```js
cy.on("tap", "node[kind = 'faction']", e => navigate(`factions/${e.target.data("factionId")}`));
cy.on("tap", "node[kind = 'character']", e => navigate(`characters/${e.target.data("characterId")}`));
```

### Search filtering

If `search` is non-empty, hide nodes whose label does not match (case-insensitive substring). Also hide character nodes whose remaining connected factions are all hidden. Re-run the layout.

Simplest implementation: teardown + re-mount with the new search on each filter change.

### Empty state

If no factions, or filter produces zero, show the existing `.faction-empty` placeholder text instead of initializing Cytoscape.

## CSS

`src/css/faction-map.css`:

```css
.factions-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.factions-view-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  margin-left: auto;
}
.factions-view-toggle button {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  padding: 0.4rem 1rem;
  text-transform: uppercase;
  transition: background 0.12s, color 0.12s;
}
.factions-view-toggle button:hover { color: var(--text); }
.factions-view-toggle button.is-active {
  background: var(--accent);
  color: var(--bg);
}

.fmap-canvas {
  width: 100%;
  height: calc(100vh - 280px);
  min-height: 480px;
  background: var(--bg);
  border: 1px solid var(--border);
}
```

## Out of scope

- A character-sheet UI for `knowsSupernatural` (slice 5.5)
- A "knows the supernatural" filter on the characters overview (slice 5.5)
- Persisting the List/Map toggle (session-only is fine)
- Faction-to-faction edges
- Any data migration

## Definition of done

- Factions overview has List | Map toggle, List by default
- Map shows factions as large colored nodes and member characters as small owner-colored nodes
- Multi-faction characters sit between their factions
- Deceased characters render greyed
- Clicking nodes navigates to the appropriate page
- The Factions text search filters both views
- `knowsSupernatural` field is on new characters by default (false)
- ROADMAP.md updated
