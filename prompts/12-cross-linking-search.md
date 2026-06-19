# Slice 12: Cross-linking audit + global search + back navigation

Read CLAUDE.md and ROADMAP.md. Slice 11 must be done. **Medium effort. Three checkpoints.** Surgical edits everywhere; no rewrites.

**Migration policy:** No migration. No schema changes.

## Files to read first

These specific files plus any view that surfaces entity names. The audit naturally touches a lot of files, but each touch is small.

- `src/js/router.js`
- `src/js/app.js`
- `src/js/views/` — all view files (read on demand during the audit)
- `src/index.html`
- `src/css/layout.css`
- `ROADMAP.md`

## Goal

Three things:

1. **Audit all entity name surfaces** and confirm every character, faction, scene, plotline, secret, timeline event name renders as a clickable link to that entity's page.
2. **Add a global search popover** triggered by a topbar search icon and the Ctrl+K shortcut.
3. **Add a "← Back" button** in the topbar that goes to the previous route.

## Checkpoint 1: Cross-linking audit

Walk every view file and check each rendering of an entity name. Convert non-link renderings into clickable `<a href="#/...">` tags.

Surfaces to audit (use `grep` to find usages of `displayName(`, `.name`, `.title`, character/faction/scene/plotline/secret references):

- **Character names** anywhere outside the Characters tab should link to `#/characters/<id>`. Examples: relationship rows, faction member chips, scene character lists, plotline character lists, timeline event participants, secret known-to / owners / hidden-from lists, incoming relationships panel.
- **Faction names** anywhere outside the Factions tab should link to `#/factions/<id>`. Examples: character sheet faction chips, scene faction chips, secret faction owners, faction map node click handlers (already done — verify).
- **Scene titles** anywhere should link to `#/scenes/<id>`. Examples: character sheet scenes section, plotline timeline items, plotline items list, timeline tab items, secret scene references.
- **Plotline titles** anywhere should link to `#/plotlines/<id>`. Examples: character sheet current plots section, secret plotline references, timeline tab items.
- **Secret titles** anywhere should link to `#/secrets/<id>`. Examples: character sheet secrets known section, character sheet hidden from me section.
- **Timeline event titles** in clickable contexts open the event dialog in edit mode (these don't have their own page, so this is a special case — keep current click behavior).

Use the `findAndAudit` approach: open each view file, grep for `displayName(`, then for each match verify it's wrapped in or generates an `<a>` element. Same for `.name` and `.title` accesses on entity objects.

When you find a non-link rendering of an entity name, replace it with the linked version. Standard pattern:

```js
el("a", { href: `#/characters/${character.id}`, class: "entity-link" }, [displayName(character)])
```

The `entity-link` class gets new styling: `--accent` color, no underline by default, underline on hover. Style:

```css
.entity-link {
  color: var(--accent);
  text-decoration: none;
  transition: color 0.12s;
}
.entity-link:hover {
  color: var(--accent-hover);
  text-decoration: underline;
}
```

Existing link classes (like `.faction-chip--link`, `.printed-rel-name`) can stay; just verify they're consistently used. The new generic `.entity-link` is for places that don't have a specific class.

When finished, in the slice's ROADMAP entry, list every file you modified plus a short note like "Audited and fixed: scene-page.js (faction chips), secret-page.js (character chip rows)…"

**STOP. Commit. User tests by clicking around.**

## Checkpoint 2: Global search popover

### Markup

Add to the topbar in `src/index.html`, between the tabs and the theme toggle:

```html
<button id="search-btn" class="search-btn" title="Search (Ctrl+K)" aria-label="Search">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="7"/>
    <line x1="20" y1="20" x2="16.5" y2="16.5"/>
  </svg>
</button>
```

The popover itself lives in `src/index.html` as a hidden overlay near the end of body:

```html
<div id="search-overlay" class="search-overlay" hidden>
  <div class="search-popover">
    <input type="text" id="search-input" class="search-input" placeholder="Search characters, scenes, factions…" autocomplete="off" />
    <div id="search-results" class="search-results"></div>
  </div>
</div>
```

### New file

`src/js/views/global-search.js`:

```js
export function openSearch(appData) { /* show overlay, focus input, render initial state */ }
export function closeSearch() { /* hide overlay */ }
```

Module-level state:
- `recentItems`: array of `{ kind, id, name }`, max 8, persisted to localStorage under `oxford-recent-items`.
- Each navigation through the search adds the picked item to the front of recentItems.

### Wire-up

In `src/js/app.js`:

- Wire the search button to call `openSearch(appData)`.
- Add a global keydown listener for Ctrl+K (or Cmd+K on Mac) that calls `openSearch(appData)`.
- Add a Ctrl+Backspace or Escape listener inside the popover to close.

### What's searchable

When the input is empty, the popover shows "Recent" — the items in `recentItems`, grouped by entity type, each linked.

When the input has a query, the popover searches across:

- **Characters**: firstName, middleName, lastName, all aliases, all previousNames, summary
- **Factions**: name, summary, agenda
- **Scenes**: title, summary, storyBeats, goals
- **Plotlines**: title, summary
- **Secrets**: title, summary
- **Timeline events**: title, body (events are short, fine to include body)

NOT searched: character background, character notes, scene body, plotline body, secret body. Too long, would dominate results and noise out signal.

Match: case-insensitive substring on any field. Score by where matched: exact name/title > startsWith on name/title > contains in name/title > contains in summary or body. Use the ranker pattern from the relationship-bulk dialog if it exists; otherwise simple:

```js
function rank(item, query) {
  const q = query.toLowerCase();
  const primary = (item.displayName || item.title || "").toLowerCase();
  if (primary === q) return 1000;
  if (primary.startsWith(q)) return 500;
  if (primary.includes(q)) return 200;
  return 50; // matched only in subtitle/summary
}
```

### Result rendering

Group by entity type. Each group has an SVG icon and a header (e.g. "Characters"). Max 5 results per group. If a group has more than 5 matches, show "+N more" at the bottom of the group.

Each result row:
- Entity icon (small SVG)
- Display name or title (bold)
- Subtitle: brief context (for characters: their owner; for factions: member count; for scenes: date; for plotlines: progress; for secrets: status)

Click navigates to the entity's page. Closes the popover. Adds to recent items.

Keyboard: arrow keys move selection through results, Enter activates, Escape closes.

### Styling

```css
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 2200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
}
.search-popover {
  width: min(640px, 90vw);
  background: var(--bg-surface);
  border: 1px solid var(--gold);
  display: flex;
  flex-direction: column;
}
.search-input {
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  padding: 1rem 1.2rem;
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.2rem;
  color: var(--text);
  outline: none;
}
.search-input:focus { border-bottom-color: var(--gold); }
.search-results {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0.5rem 0;
}
.search-group-header {
  padding: 0.5rem 1.2rem 0.3rem;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.search-result {
  padding: 0.5rem 1.2rem;
  cursor: pointer;
  display: flex;
  gap: 0.7rem;
  align-items: center;
  transition: background 0.1s;
}
.search-result:hover,
.search-result--active {
  background: var(--bg-raised);
}
.search-result-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.search-result-name {
  color: var(--text);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1rem;
}
.search-result-sub {
  color: var(--text-muted);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.75rem;
  margin-left: auto;
}
```

Put these in a new file `src/css/global-search.css` and link from index.html.

**STOP. Commit. User tests.**

## Checkpoint 3: Back navigation button

In `src/index.html`, add a back button to the topbar BEFORE the app title:

```html
<button id="back-btn" class="back-btn" title="Back" aria-label="Back">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
</button>
```

### Behavior

In `src/js/router.js` (or `app.js`), maintain a route history stack as users navigate. When hash changes:

```js
const routeHistory = [];
let suppressNextPush = false;

window.addEventListener("hashchange", () => {
  if (!suppressNextPush) {
    routeHistory.push(window.location.hash);
    if (routeHistory.length > 50) routeHistory.shift();
  }
  suppressNextPush = false;
});
```

When the back button is clicked:

```js
function goBack() {
  if (routeHistory.length < 2) return;       // nothing to go back to
  routeHistory.pop();                         // remove current
  const prev = routeHistory[routeHistory.length - 1];
  suppressNextPush = true;
  window.location.hash = prev;
}
```

This is a simple in-memory stack. Refreshing the app resets it (which is fine).

### Disabled state

When `routeHistory.length < 2`, the back button is disabled (greyed, not clickable). Update on every hashchange.

### Styling

```css
.back-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.4rem;
  display: inline-flex;
  align-items: center;
  transition: color 0.12s;
}
.back-btn:hover:not(:disabled) {
  color: var(--accent);
}
.back-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
```

The existing per-page back links (e.g. "← Characters" on character pages) stay. They handle the "go up one level" case (entity → tab overview). The new topbar back button handles arbitrary in-app navigation history.

**STOP. Done. Update ROADMAP.**

## Files to touch

Cross-linking audit (Checkpoint 1):
- Likely touches: `src/js/views/character-sheet.js`, `src/js/views/scenes.js`, `src/js/views/scene-page.js`, `src/js/views/plotlines.js`, `src/js/views/plotline-detail.js`, `src/js/views/secrets.js`, `src/js/views/secret-page.js`, `src/js/views/factions.js`, `src/js/views/faction-page.js`, `src/js/views/personal-timeline.js`, `src/js/views/global-timeline.js`, possibly `src/js/views/relationship-bulk-dialog.js`.
- Plus `src/css/layout.css` for the `.entity-link` class.

Global search (Checkpoint 2):
- New: `src/js/views/global-search.js`, `src/css/global-search.css`.
- Touch: `src/index.html`, `src/js/app.js`.

Back nav (Checkpoint 3):
- Touch: `src/js/router.js` or `src/js/app.js`, `src/index.html`, `src/css/layout.css`.

ROADMAP.md updated with each checkpoint.

## Out of scope

- Search within a specific tab (e.g. search only secrets). The existing filter bars handle that.
- Full-text search of body fields (deferred; keeps result list focused).
- Fuzzy matching (would need a library; not worth it at this data scale).
- Forward button (browser-style). The back stack is one-directional.

## Definition of done

- Every character/faction/scene/plotline/secret name rendered anywhere in the app is a clickable link to that entity's page.
- Ctrl+K or clicking the search icon opens the global search popover.
- Empty popover shows recent items.
- Typing in search returns ranked results grouped by entity type.
- Clicking a result navigates and closes the popover.
- Back button in the topbar goes to the previous hash route.
- Back button disabled when there's no history to go back to.
- ROADMAP.md updated with all three checkpoints + the list of files touched in the audit.
