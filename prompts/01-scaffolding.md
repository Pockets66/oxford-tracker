# Slice 1: Scaffolding and storage

Read CLAUDE.md before starting. Read ROADMAP.md to understand where this fits.

## Goal

A working skeleton. The user can open the app, pick a project folder, see five tabs, and the JSON read/write plumbing works. No entity features yet.

## Deliverables

### Files to create

```
src/index.html
src/css/theme.css
src/css/layout.css
src/js/app.js
src/js/dom.js
src/js/storage.js
src/js/router.js
src/js/filters.js
src/data/characters.json    empty array
src/data/factions.json      empty array
src/data/scenes.json        empty array
src/data/plotlines.json     empty array
src/data/relationships.json empty array
src/data/anomalies.json     empty array
src/data/meta.json          { "schemaVersion": 1 }
.gitignore
README.md
```

### index.html

Single page. Loads `js/app.js` as a module. Markup:

- Top bar with app title on the left, tabs in the middle (Characters, Scenes, Plotlines, Factions, Anomalies), settings gear on the right
- Main content area where the active tab renders
- A welcome overlay shown when no data folder is connected, with a single "Open project folder" button
- A banner region for error messages (initially hidden)

### storage.js

A small module that owns all File System Access work.

- `connectFolder()` prompts the user to pick a folder, stores the handle in IndexedDB so it persists across reloads, requests readwrite permission, returns the handle
- `restoreFolder()` on app boot reads the saved handle from IndexedDB, re-requests permission, returns the handle or null
- `loadAll()` reads every JSON file in the folder and returns an object keyed by entity type. If a file is missing, seed it from `src/data/`
- `save(entityType, data)` writes the named JSON file
- On any write failure, dispatch a custom `storage-error` event on `window` with details. app.js listens and shows the banner

Use `showDirectoryPicker()`. The handle goes into IndexedDB under a single key. On restore, call `queryPermission` then `requestPermission` if needed.

### router.js

Hash based routing. URLs look like `#/characters`, `#/characters/<id>`, `#/scenes`, etc. Exposes `navigate(path)` and a `route-change` event. The five tab buttons set the hash. app.js listens for route changes and mounts the right view.

For this slice the views are placeholder divs that say "Characters" or "Scenes coming in slice 6". Just enough to prove routing works.

### app.js

Boot sequence:

1. Try `restoreFolder()`. If it returns a handle, call `loadAll()`, hide the welcome overlay, mount the routed view.
2. If not, show welcome. On click of "Open project folder", call `connectFolder()`, then `loadAll()`, then continue boot.
3. Wire tab clicks to `router.navigate()`.
4. Listen for `storage-error` and show the banner.

### dom.js

Small helpers: `el(tag, props, children)`, `qs(selector)`, `qsa(selector)`, `mount(parent, node)`, `clear(node)`. Use these everywhere instead of raw DOM calls in feature code.

### filters.js (new module in `src/js/`)

A small reusable filter bar builder used by Characters, Factions, and Scenes in later slices. Exports `createFilterBar(config)` which returns a DOM node plus a `subscribe(callback)` method. `config` looks like:

```js
{
  searchPlaceholder: "Search characters",
  facets: [
    { id: "owner", label: "Owner", type: "multi", options: [...] },
    { id: "deceased", label: "Show deceased", type: "toggle", defaultValue: true }
  ]
}
```

The callback fires on every change with `{ search, facetValues }`. Views apply this to their own data. Keep the implementation under 150 lines, no clever abstractions, just the three control types this app needs: text input, multi select, toggle.

### theme.css

CSS variables for the owner color palette and the base theme. Define:

- `--owner-bree` green
- `--owner-jack` yellow
- `--owner-nicole` blue
- `--owner-caiden` red
- `--owner-npc` neutral grey

Pick muted, readable shades (not pure primaries). Document each with a comment. Also define base background, text, accent, border, danger, success.

### layout.css

Tab bar, main area, welcome overlay, banner. Nothing fancy. Readable on a normal laptop screen.

### .gitignore

```
user-data/
.DS_Store
*.log
node_modules/
```

### README.md

Two paragraphs. What the app is, how to run it. To run: open `src/index.html` directly in Chrome or Edge. Mention that Firefox does not yet support the File System Access API.

## Out of scope for this slice

- Any entity CRUD
- Any Cytoscape or vis-timeline code
- Any styling beyond the tab shell and welcome screen
- Export or import
- Search

## Definition of done

- Open `src/index.html`, see welcome screen
- Click "Open project folder", pick an empty folder, get seeded with the JSON files
- Five tabs visible, clicking each updates the hash and swaps the placeholder content
- Reload the page, the folder reconnects automatically (with one permission re-grant click), tabs still work
- Refresh, switch tab, refresh again, route is restored from hash

Append a `**Status: done**` line and any followups to the Slice 1 section in ROADMAP.md when finished.
