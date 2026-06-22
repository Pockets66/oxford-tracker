# Slice 15: Plotlines overview + scene/plotline sync + inline entity creation

Read CLAUDE.md and ROADMAP.md. **Three checkpoints.** Surgical edits throughout.

**Migration policy:** No migration.

## Files to read first

For each checkpoint, only the files listed below. Do NOT browse the rest of the project.

### Checkpoint 1 files
- `src/index.html`
- `src/js/app.js`
- `src/js/router.js`
- `src/js/views/plotlines.js`
- `src/js/views/plotline-detail.js`
- `src/css/plotlines.css`
- `ROADMAP.md`

### Checkpoint 2 files
- `src/js/views/scene-page.js`
- `src/js/views/plotline-detail.js`
- `src/js/views/scenes.js`
- `src/js/schema.js`
- `src/css/scenes.css`

### Checkpoint 3 files
- `src/js/components/combobox.js`
- `src/js/views/plotline-detail.js`
- `src/js/views/scene-page.js`
- `src/js/views/character-sheet.js` (only if referenced from a combobox; otherwise skip)
- `src/js/schema.js`
- `src/js/storage.js`
- `src/js/dom.js`

## Goal

1. Reorder the topbar tabs.
2. Convert the Plotlines tab from sidebar+detail to overview+detail.
3. Add bidirectional sync between scenes and plotlines (computed, not stored).
4. Add "+ Add new" support to relevant comboboxes so users can create skeleton entities inline.

---

## Checkpoint 1 — Tab reorder + Plotlines overview

### Tab order

In `src/index.html`, find the topbar tabs. Current order:

```
Timeline | Characters | Scenes | Plotlines | Factions | Secrets | Anomalies
```

Reorder to:

```
Plotlines | Scenes | Characters | Factions | Secrets | Anomalies | Timeline
```

Plotlines first, Timeline last.

In `src/js/app.js` (or wherever tabs are declared in JS), match the new order. The default route on first launch should now be `#/plotlines`.

### Plotlines overview replacing sidebar

In `src/js/views/plotlines.js`, replace the sidebar+detail layout with the standard overview pattern (matching Factions or Secrets).

**Files to change:**
- `src/js/views/plotlines.js` — rewrite the mount function to render a card grid instead of the sidebar layout
- `src/css/plotlines.css` — remove sidebar-specific rules; add card-grid rules matching the factions/secrets style

**Overview layout:**

Toolbar at top:
- "New plotline" button on the left
- Filter bar with `persistKey: "plotlines"`:
  - Text search (title + summary + body)
  - Character filter (faction-dropdown-style — pick characters who appear in the plotline)
  - Secret filter (checkbox: "Only secret plotlines" toggle)

Below the toolbar, a card grid.

**Card structure:**

```
┌─────────────────────────────────────────┐
│ ▌ {Plotline title}                      │   ← left color stripe matches plotline.color
│                                          │
│ {summary, truncated to 2 lines}          │
│                                          │
│ 3 of 8 items complete                    │
│ [▓▓▓░░░░░] 38%                          │
│                                          │
│ {character chip} {character chip} +2     │   ← up to 3 chips, then "+N"
└─────────────────────────────────────────┘
```

- Card width: same as Factions/Secrets cards (responsive grid, ~280px min).
- Card height: auto, generous padding.
- Click navigates to `#/plotlines/<id>` which still opens plotline-detail.js.
- "Secret" plotlines get a small lock icon (or just a "🔒" — but use an inline SVG, not emoji) in the top-right corner.
- Progress bar uses plotline.color as its fill.

**Sample card CSS additions** (paste into plotlines.css, replacing sidebar rules):

```css
.plotlines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.plotline-card {
  position: relative;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: 1rem 1rem 1rem 1.5rem;
  cursor: pointer;
  transition: border-color 0.12s;
}
.plotline-card:hover { border-color: var(--gold); }

.plotline-card-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
}

.plotline-card-title {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.2rem;
  color: var(--text);
  margin-bottom: 0.4rem;
}

.plotline-card-summary {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-bottom: 0.8rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plotline-card-progress-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.3rem;
}

.plotline-card-progress-bar {
  height: 4px;
  background: var(--bg);
  margin-bottom: 0.8rem;
}
.plotline-card-progress-fill {
  height: 100%;
  transition: width 0.3s;
}

.plotline-card-characters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.plotline-card-secret-icon {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  color: var(--gold);
  opacity: 0.7;
}
```

**Empty state:**

If no plotlines exist:

> No plotlines yet. Start one to thread scenes and events into a story.

With a "New plotline" button below it.

**Definition of done CP1:**
- Tab order is: Plotlines / Scenes / Characters / Factions / Secrets / Anomalies / Timeline
- Default route on app launch is `#/plotlines`
- Plotlines overview shows cards with title, color stripe, summary, progress, character chips
- Sidebar layout is removed
- Clicking a card opens the existing plotline detail page
- Filter bar works with persistence
- Empty state renders when no plotlines exist

**STOP. Commit. User tests.**

---

## Checkpoint 2 — Bidirectional scene/plotline sync (computed)

The data lives on plotlines (each plotline has `items: [{ kind: "scene", sceneId, ... }]`). Scenes get a computed "related plotlines" section that scans plotlines for matching items, and edits there propagate back to the plotline's `items`.

### Schema

NO schema changes. Scenes do NOT get a `plotlineIds` field. The relationship is purely computed.

### Helper function

In `src/js/schema.js` (or a new util if cleaner), add an exported helper:

```js
export function plotlinesForScene(sceneId, appData) {
  return appData.plotlines.filter(p =>
    p.items.some(item => item.kind === "scene" && item.sceneId === sceneId)
  );
}

export function addSceneToPlotline(sceneId, plotlineId, appData) {
  const plotline = appData.plotlines.find(p => p.id === plotlineId);
  if (!plotline) return;
  if (plotline.items.some(i => i.kind === "scene" && i.sceneId === sceneId)) return;
  plotline.items.push({
    id: crypto.randomUUID(),
    kind: "scene",
    sceneId,
    completed: false,
  });
  // saveStorage is the responsibility of the caller
}

export function removeSceneFromPlotline(sceneId, plotlineId, appData) {
  const plotline = appData.plotlines.find(p => p.id === plotlineId);
  if (!plotline) return;
  plotline.items = plotline.items.filter(i => !(i.kind === "scene" && i.sceneId === sceneId));
}
```

### Scene page additions

In `src/js/views/scene-page.js`, add a new section in the right column called "Plotlines" (or fold into an existing right-column structure if it has one).

Section structure:

```
PLOTLINES
{plotline chip 1} {plotline chip 2}
[combobox: add plotline...]
```

Each plotline chip:
- Background color from plotline.color
- Text label is plotline title
- Click navigates to `#/plotlines/<plotline.id>`
- Has an x button to remove (calls `removeSceneFromPlotline`)

The combobox lists all plotlines not already linked. Picking one calls `addSceneToPlotline`. (The "+ Add new plotline" inline-create option comes in CP3; for now, only existing plotlines.)

### Saving

After any add/remove, save the plotline (the one whose items changed). The scene itself doesn't change — the relationship lives on plotlines.

```js
// After modifying plotline.items:
saveStorage("plotlines", appData.plotlines);
```

### CSS

```css
.scene-plotline-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0;
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.75rem;
  text-decoration: none;
}
.scene-plotline-chip-remove {
  cursor: pointer;
  opacity: 0.7;
  font-size: 0.9rem;
}
.scene-plotline-chip-remove:hover { opacity: 1; }
```

### Existing plotline detail behavior

Should already work: the plotline-detail page's items list shows scenes. No changes needed there in this checkpoint.

**Definition of done CP2:**
- `plotlinesForScene`, `addSceneToPlotline`, `removeSceneFromPlotline` helpers exported from schema
- Scene page shows a Plotlines section with chips and a picker
- Adding a plotline from the scene page modifies the plotline's items array
- Removing a chip removes the item from the plotline
- Storage saves correctly on both add and remove
- Chips link to the plotline detail page

**STOP. Commit. User tests.**

---

## Checkpoint 3 — "+ Add new" inline creation in comboboxes

Four comboboxes get the same "+ Add new …" pattern that the city picker already has.

### Plotline detail → "Add scene" combobox

In `src/js/views/plotline-detail.js`, find the scene-picker combobox. Add an "+ Add new scene" item at the bottom of the items list.

When selected, open an inline form (small dialog or popover):
- Title (text input, required, autofocus)
- "Create and add" button
- "Cancel" button

On Create:
1. Build a new scene via `createScene()` from schema
2. Set the title
3. Push to `appData.scenes`
4. Save scenes storage
5. Add the new scene's id to the current plotline as a scene item (using `addSceneToPlotline`)
6. Save plotlines storage
7. Refresh the plotline detail view

The new scene appears in the plotline immediately. The user can navigate to the scenes tab later to fill in details.

### Plotline detail → "Add character" combobox

Find the character-picker. Add "+ Add new character" item.

Inline form:
- First name (text input, required, autofocus)
- Last name (text input, optional)
- Owner (select dropdown, defaults to "NPC")
- "Create and add" / "Cancel"

On Create:
1. Build a new character via `createCharacter()`
2. Set firstName, lastName, owner
3. Push to `appData.characters`
4. Save characters storage
5. Add character's id to the current plotline's `characterIds`
6. Save plotlines storage
7. Refresh view

### Scene page → "Add character" combobox

Same pattern as plotline → character. Add "+ Add new character" with the same form. On create, add to scene's `characters` array (with default role "Background") and to `appData.characters`.

### Scene page → "Add plotline" combobox (introduced in CP2)

Add "+ Add new plotline" item.

Inline form:
- Title (text input, required, autofocus)
- "Create and add" / "Cancel"

On Create:
1. Build a new plotline via `createPlotline()`
2. Set title; assign a default color from a small rotating palette (use `appData.plotlines.length % colors.length` to cycle)
3. Push to `appData.plotlines`
4. Save plotlines storage
5. Add the current scene to the new plotline's items (using `addSceneToPlotline`)
6. Save plotlines storage again
7. Refresh view

### Inline-form helper

Build one reusable function for the inline form dialog. Pattern:

```js
// src/js/components/inline-create-dialog.js (new file)
export function openInlineCreateDialog({
  title,            // "Create new scene"
  fields,           // [{ name: "title", label: "Title", type: "text", required: true, autofocus: true }, ...]
  onSubmit,         // async (values) => void
}) { ... }
```

The dialog: small modal (~360px wide), `--bg-surface` background, `--gold` border, header with title, field inputs, two buttons (Create / Cancel) at the bottom. Esc closes; clicking backdrop closes. Submit validates required fields and calls onSubmit.

All four "+ Add new" flows reuse this dialog with different field configurations.

### Combobox change

In `src/js/components/combobox.js`, ensure the items list supports an "Add new" marker. If the combobox already supports special items (it does for the city picker from slice 14a.1), follow that pattern. If not, the calling code intercepts the "+ Add new" value selection and opens the dialog.

Easiest pattern: each caller adds an item `{ value: "__add_new__", label: "+ Add new <thing>" }` at the bottom of its items list. On change, check `if (value === "__add_new__") openInlineCreateDialog(...)`.

### CSS

Use the existing dialog CSS if it works. Otherwise add small surgical rules for the inline-create dialog in a new file or in `dialog.css`.

**Definition of done CP3:**
- Plotline detail "Add scene" combobox can create new skeleton scenes
- Plotline detail "Add character" combobox can create new skeleton characters
- Scene page "Add character" combobox can create new skeleton characters
- Scene page "Add plotline" combobox can create new skeleton plotlines
- All four use a shared inline-create dialog
- Created entities show up in their respective tabs immediately
- Created entities can be edited later for full details

**STOP. Commit. Update ROADMAP.**

---

## Out of scope

- "Add new" support in other comboboxes (relationships, factions, etc.) — separate slice if wanted
- Denormalized `plotlineIds` on scenes (we use computed instead)
- Drag-reorder plotlines on the overview
- Plotline tags or categories
