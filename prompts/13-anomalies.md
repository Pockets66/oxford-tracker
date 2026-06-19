# Slice 13: Anomalies

Read CLAUDE.md and ROADMAP.md. Slice 12 must be done. **Medium-large. Three checkpoints.** Surgical edits in existing files; full creation for new files.

**Migration policy:** No migration. New entity, doesn't touch existing data.

## Files to read first

ONLY these:

- `src/js/schema.js`
- `src/js/app.js`
- `src/js/views/secrets.js` (for the overview pattern: toolbar + filter + cards)
- `src/js/views/secret-page.js` (for the per-entity page pattern with multiple linked sections)
- `src/js/views/scenes.js` (for status chip patterns)
- `src/js/views/factions.js` (for the List/Map toggle pattern, since we want a List/Index toggle here)
- `src/js/views/character-sheet.js` (for two-column card + per-card edit pattern)
- `src/js/filters.js`
- `src/js/components/combobox.js`
- `src/index.html`
- `main.js`
- `src/js/router.js`
- `ROADMAP.md`

## Goal

Add an Anomalies tab. Tabs end with Anomalies already, so it just needs wiring. Anomalies are catalogued supernatural manifestations with one primary P-type and zero or more secondary P-types, each with its own Class (I most dangerous, X least). Two view modes (Card grid and Index). Each anomaly has lore, dated observations, related characters/scenes/plotlines/secrets, status, location, tags.

## Schema

In `src/js/schema.js`, add:

### Constants

```js
export const ANOMALY_CATEGORIES = [
  { name: "Paradoxical",   description: "Time-loop entities, rifts, beings that exist and don't exist depending on observation." },
  { name: "Parasites",     description: "Soul-leeches that drain without killing outright." },
  { name: "Pathological",  description: "Conditions like vampirism-as-disease, cursed bloodlines producing involuntary monstrous transformation." },
  { name: "Patrons",       description: "Bargaining entities where the deal is the point." },
  { name: "Penitents",     description: "Revenants with unfinished business, oath-bound spirits." },
  { name: "Pest",          description: "Imps, soured brownies, poltergeists that just throw cutlery." },
  { name: "Phantom",       description: "Standard ghosts, residual hauntings." },
  { name: "Plague",        description: "Hive-mind possession events, contagious hauntings, entities that jump host to host." },
  { name: "Polluters",     description: "Land-tainting entities, gone-wrong river spirits, cursed groves." },
  { name: "Portents",      description: "Omen-bearing entities that appear before events." },
  { name: "Possessors",    description: "Spirits that hijack a living body." },
  { name: "Predators",     description: "Entities in active hunt mode." },
  { name: "Preternatural", description: "Outer entities, things that came through from elsewhere." },
  { name: "Pretenders",    description: "Doppelgangers, changelings wearing human shape." },
  { name: "Primordial",    description: "Old gods, dragons in the sense of beings that predate human reckoning." },
  { name: "Progenitors",   description: "Originators in a lineage: the first vampire who turns others, alpha werewolves who make more." },
  { name: "Puppeteers",    description: "Entities that operate victims from a distance without entering them." },
];

export const ANOMALY_CLASSES = [
  { roman: "I",    label: "Reality-breaking" },
  { roman: "II",   label: "Catastrophic" },
  { roman: "III",  label: "Lethal" },
  { roman: "IV",   label: "Hazardous" },
  { roman: "V",    label: "Threatening" },
  { roman: "VI",   label: "Disruptive" },
  { roman: "VII",  label: "Unsettling" },
  { roman: "VIII", label: "Curious" },
  { roman: "IX",   label: "Mild" },
  { roman: "X",    label: "Negligible" },
];

export const ANOMALY_STATUSES = ["Active", "Contained", "Dormant", "Eradicated", "Unknown"];
```

### Anomaly entity

```js
export function createAnomaly() {
  return {
    id: uuid(),
    title: "",
    primaryCategory: null,        // one of ANOMALY_CATEGORIES[].name
    primaryClass: null,           // one of ANOMALY_CLASSES[].roman (e.g. "III")
    secondaryTypes: [],           // [{ category, class }, ...]
    status: "Unknown",
    location: "",
    discoveryDate: null,          // "YYYY-MM-DD" | "YYYY-MM" | "YYYY" | null
    lore: "",
    observations: [],             // [{ id, date, title, body }]
    characterIds: [],
    sceneIds: [],
    plotlineIds: [],
    secretIds: [],
    tags: [],
    notes: "",
    archived: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

// Compute overall threat class: the LOWEST class roman across primary and all secondaries.
export function anomalyOverallClass(anomaly) {
  const classes = [anomaly.primaryClass, ...anomaly.secondaryTypes.map(t => t.class)].filter(Boolean);
  if (!classes.length) return null;
  const orderedRomans = ANOMALY_CLASSES.map(c => c.roman);
  let lowest = classes[0];
  let lowestIdx = orderedRomans.indexOf(lowest);
  for (const c of classes) {
    const idx = orderedRomans.indexOf(c);
    if (idx < lowestIdx) { lowest = c; lowestIdx = idx; }
  }
  return lowest;
}
```

## Class colors (CSS)

Define in `src/css/anomalies.css`:

```css
:root {
  /* Class colors, blue (safe) → red (dangerous). */
  --class-i:    #4a1a1a;   /* deepest oxblood, near-black */
  --class-ii:   #7a1f1f;   /* saturated red */
  --class-iii:  #9a3520;   /* red-orange */
  --class-iv:   #a85a1f;   /* burnt orange */
  --class-v:    #b88a2a;   /* amber */
  --class-vi:   #8a7a3a;   /* muted gold / khaki */
  --class-vii:  #4a6a6a;   /* dusty teal */
  --class-viii: #5a8a9a;   /* pale teal-blue */
  --class-ix:   #6a9ac0;   /* sky blue */
  --class-x:    #a0c0d8;   /* ice blue / near-white */
}

.class-chip {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
}
.class-chip--i    { background: var(--class-i); }
.class-chip--ii   { background: var(--class-ii); }
.class-chip--iii  { background: var(--class-iii); }
.class-chip--iv   { background: var(--class-iv); }
.class-chip--v    { background: var(--class-v); }
.class-chip--vi   { background: var(--class-vi); }
.class-chip--vii  { background: var(--class-vii); }
.class-chip--viii { background: var(--class-viii); }
.class-chip--ix   { background: var(--class-ix);  color: var(--text); }
.class-chip--x    { background: var(--class-x);   color: var(--text); }
```

Class IX and X text uses `--text` for contrast since the background is light.

Helper to slugify a roman to a CSS class suffix: `"III"` → `"iii"`, etc. Pure lowercase.

The combined type-class label format is `{Category}-{Roman}`, e.g. "Predator-III", "Possessor-VII".

## Category glyphs

Define 17 inline SVG glyphs, one per category, each 18×18, single-color via `currentColor` so theming works. Render them inside a small mapping in `src/js/views/anomaly-glyphs.js`:

```js
export const ANOMALY_GLYPHS = {
  Possessors: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>
    <circle cx="12" cy="9" r="4"/>
    <circle cx="12" cy="9" r="1.5" fill="currentColor"/>
  </svg>`,
  Parasites: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="16" cy="12" r="6"/>
    <circle cx="6" cy="12" r="2.5"/>
    <line x1="9" y1="12" x2="10" y2="12"/>
    <line x1="7" y1="10" x2="6" y2="9"/>
  </svg>`,
  Predators: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 4c2 4 2 8 0 14"/>
    <path d="M10 4c2 4 2 8 0 14"/>
    <path d="M14 4c2 4 2 8 0 14"/>
  </svg>`,
  Pathological: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12h3l2-6 4 12 2-6h2l2 3h3"/>
  </svg>`,
  Pest: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="5" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="19"/>
    <line x1="7" y1="9" x2="5" y2="7"/>
    <line x1="17" y1="9" x2="19" y2="7"/>
    <line x1="7" y1="15" x2="5" y2="17"/>
    <line x1="17" y1="15" x2="19" y2="17"/>
  </svg>`,
  Primordial: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
    <polygon points="12,3 21,20 3,20"/>
    <line x1="12" y1="9" x2="12" y2="16"/>
  </svg>`,
  Paradoxical: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M7 12c0-3 2-5 5-5s5 2 5 5-2 5-5 5"/>
    <path d="M17 12c0-3-2-5-5-5s-5 2-5 5 2 5 5 5"/>
  </svg>`,
  Phantom: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 20V10c0-4 3-7 7-7s7 3 7 7v10l-2-2-2 2-2-2-2 2-2-2-2 2-2-2z"/>
    <circle cx="10" cy="11" r="0.8" fill="currentColor"/>
    <circle cx="14" cy="11" r="0.8" fill="currentColor"/>
  </svg>`,
  Preternatural: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M6 12c-1 2-3 3-3 3"/>
    <path d="M18 12c1 2 3 3 3 3"/>
    <path d="M12 9c0-2-1-4-1-4"/>
    <path d="M12 15c0 2-1 4-1 4"/>
    <path d="M12 15c0 2 1 4 1 4"/>
  </svg>`,
  Pretenders: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="9" cy="8" r="3"/>
    <path d="M3 20c0-3 3-6 6-6s6 3 6 6"/>
    <circle cx="15" cy="8" r="3"/>
    <path d="M9 20c0-3 3-6 6-6s6 3 6 6"/>
  </svg>`,
  Patrons: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 12c0-2 1-3 3-3h6c2 0 3 1 3 3"/>
    <path d="M9 9V6c0-1 1-2 2-2s2 1 2 2v3"/>
    <circle cx="12" cy="16" r="2"/>
  </svg>`,
  Progenitors: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <line x1="12" y1="6" x2="12" y2="11"/>
    <line x1="12" y1="11" x2="7" y2="16"/>
    <line x1="12" y1="11" x2="17" y2="16"/>
    <circle cx="7" cy="18" r="2"/>
    <circle cx="17" cy="18" r="2"/>
  </svg>`,
  Portents: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12c4-3 7-3 9 0 2-3 5-3 9 0"/>
    <path d="M3 16c4-3 7-3 9 0 2-3 5-3 9 0"/>
  </svg>`,
  Puppeteers: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="6" y1="3" x2="6" y2="11"/>
    <line x1="12" y1="3" x2="12" y2="13"/>
    <line x1="18" y1="3" x2="18" y2="11"/>
    <circle cx="6" cy="13" r="1.5"/>
    <circle cx="12" cy="15" r="1.5"/>
    <circle cx="18" cy="13" r="1.5"/>
    <line x1="6" y1="15" x2="12" y2="17"/>
    <line x1="12" y1="17" x2="18" y2="15"/>
  </svg>`,
  Penitents: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7" cy="8" r="3"/>
    <circle cx="17" cy="16" r="3"/>
    <line x1="10" y1="10" x2="14" y2="14" stroke-dasharray="2,2"/>
  </svg>`,
  Polluters: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 21V11"/>
    <path d="M12 11c-3-3-5-1-5-1s1 4 5 4z"/>
    <path d="M12 14c2-2 4-1 4-1s-1 3-4 3z"/>
  </svg>`,
  Plague: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6"  cy="6"  r="1.5" fill="currentColor"/>
    <circle cx="18" cy="6"  r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="6"  cy="18" r="1.5" fill="currentColor"/>
    <circle cx="18" cy="18" r="1.5" fill="currentColor"/>
    <line x1="6"  y1="6"  x2="12" y2="12"/>
    <line x1="18" y1="6"  x2="12" y2="12"/>
    <line x1="6"  y1="18" x2="12" y2="12"/>
    <line x1="18" y1="18" x2="12" y2="12"/>
  </svg>`,
};
```

Use `dom.el("span", { class: "anomaly-glyph", innerHTML: ANOMALY_GLYPHS[name] || "" })` to render. Color via `currentColor` so the glyph picks up the surrounding text color.

## New files

- `src/data/anomalies.json` — already empty `[]`. Confirm `main.js` includes "anomalies" in `ENTITY_FILES` (it should from earlier slices).
- `src/js/views/anomalies.js` (overview)
- `src/js/views/anomaly-page.js` (per-anomaly editor)
- `src/js/views/anomaly-glyphs.js` (the glyph mapping above)
- `src/css/anomalies.css`

## Files to touch

- `src/js/schema.js` (constants and createAnomaly)
- `src/js/app.js` (routes #/anomalies and #/anomalies/<id>)
- `src/index.html` (link anomalies.css)
- `ROADMAP.md`

The Anomalies tab is already in the topbar from Slice 1. If for any reason it isn't, add it now.

## Checkpoint structure

### Checkpoint 1 — Overview Card Grid + basic anomaly page

- Schema constants and `createAnomaly`.
- Build `anomalies.js` overview:
  - Toolbar: "New anomaly" button on left; List/Index toggle on right (defaults List).
  - Filter bar with `persistKey: "anomalies"`:
    - Text search (title, lore, location, tags)
    - Primary Type filter: alphabetized multi-select dropdown of all 17 categories
    - Class filter: multi-select toggle chips for I through X (color-coded; all on by default; click to toggle off)
    - Status filter: multi-select dropdown of ANOMALY_STATUSES
    - Location filter: text input
- Card view (Mode 1):
  - Each card shows:
    - Title (EB Garamond, sized like other entity titles)
    - Class chip at top-right showing overall class (`Class III`, colored by tier)
    - Primary type with its glyph + class: `[glyph] Predator-III`
    - Secondary types as small chips below: `Pathological-VI`
    - Location line (small, muted)
    - One-line lore preview (truncated to 2 lines)
    - Status indicator chip at bottom
  - Click routes to `#/anomalies/<id>`.
- Build `anomaly-page.js` with the title bar + primary type/class editor + secondary types editor + lore textarea. NO observations list, NO related entities yet — those come in checkpoint 2.
- Wire routes and tab.
- **STOP. Commit. User tests.**

### Checkpoint 2 — Index view + observations + related entities

- Index view (Mode 2):
  - Compact list grouped by Primary Type. Each group has a header showing the category glyph + name. Within each group, rows show `Title · Class · Status · Location`. Hover highlights row.
  - Sort within groups: by Class roman ascending (most dangerous first), then alphabetical by title.
  - Click row to open the anomaly page.
  - Style as a journal index: minimal borders, ample whitespace, EB Garamond throughout.
- Add the rest of the anomaly page:
  - **Observations card**: list of `{ id, date, title, body }` entries. Each rendered as a small log row with date in EB Garamond italic, title bold, body in regular. "+ Add observation" opens a small inline form (date input, title input, body textarea, Save/Cancel). Edit pencil per entry. Delete button per entry with confirm.
  - **Related Characters** card with combobox to add characters; chips below with x.
  - **Related Scenes** card with combobox; chips below.
  - **Related Plotlines** card with combobox; chips below.
  - **Related Secrets** card with combobox; chips below.
  - **Tags** input (comma-separated chips).
  - **Notes** textarea.
  - **Status** select.
  - **Location** text input.
  - **Discovery date** flexible date input (year, year-month, or full date).
  - **Archive toggle** at the top.
- Two-column layout on the anomaly page like character sheets: main column (title, lore, observations), side column (everything else).
- Per-card edit pattern. NOT applied globally — anomaly page can keep its current inline-edit-on-the-whole-page feel for now if the per-card retrofit is too much; the goal is consistency with other pages but observations is enough complexity that the page can stay inline-editable. Tend toward per-card if straightforward; defer per-card edit to a polish pass if complex.
- **STOP. Commit. User tests.**

### Checkpoint 3 — Cross-linking + timeline integration

- On the character sheet (in `character-sheet.js`), add a small "Anomalies" section to the printed view showing anomalies where this character appears in `anomaly.characterIds`. Below the existing Scenes section. Each row is `Anomaly title — Overall class chip`, linking to the anomaly page. Omit section if empty.
- On the scene page, add Related Anomalies subsection rendering as chips with links.
- On the global timeline (slice 10), add anomalies to the dataset:
  - Anomaly discovery date → a single timeline item with the anomaly's overall class color and the title as label. Click opens the anomaly page.
  - Anomaly observations → individual timeline items per observation with the anomaly title + observation title as label, smaller. Click opens the anomaly page (not the observation directly, since observations don't have their own URL).
- Add an "Anomalies" filter facet to the global timeline filter panel.
- On the global search (slice 12), include anomalies in the searchable set. Search across: title, lore, primary type, observations (title + body), location, tags.
- **STOP. Done. Update ROADMAP.**

## Empty state

When no anomalies exist: show a placeholder:

> No anomalies catalogued yet. Add one to start building Foley's Book.

with a "New anomaly" button.

## Out of scope

- Sub-tabs by Primary Type (dropped per user decision; the filter dropdown handles it)
- Auto-extraction of anomaly references from scene text
- Anomaly relationships (one anomaly related to another)
- Class auto-derivation from secondary type counts or similar heuristics
- Print-to-PDF or journal-style export

## Definition of done

- Anomalies tab works end-to-end
- 17 category types defined with descriptions and glyphs
- 10 class tiers with labels and gradient colors
- Per-type class pairs (Primary type with class, plus zero or more Secondary types with classes)
- Overall class auto-computed as the lowest (most dangerous) class across all types
- Two view modes: Card grid and Index (journal-style)
- Filter bar with persistence
- Observations as a list of dated entries
- Related characters, scenes, plotlines, secrets editable
- Cross-links from character sheet, scene page
- Anomalies appear on the global timeline at discovery date and observation dates
- Global search includes anomalies
- ROADMAP.md updated with all three checkpoints
