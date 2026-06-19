# Slice 9: Personal character timeline + Faction Web modal

Read CLAUDE.md and ROADMAP.md. Slice 8 must be done. **Medium-large. Two checkpoints.** Use surgical edits where possible.

**Migration policy:** No migration.

## Files to read first

- `src/js/views/character-sheet.js` (the button row from Slice 8)
- `src/js/views/relationship-web.js` (pattern for modal + Cytoscape)
- `src/js/views/faction-map.js` (Cytoscape config for the faction graph)
- `src/js/schema.js`
- `src/js/app.js`
- `main.js`
- `src/css/relationship-web.css`
- `src/index.html`
- `ROADMAP.md`

Nothing else.

## Goal

Wire the two disabled buttons from Slice 8:

1. **Faction Web button** opens a modal showing this character's factions and their members. Subset of the existing Faction Map.
2. **Personal Timeline button** opens a modal with this character's life timeline: birth (auto from birthday), death (auto from deathDate), backstory events from a new `timelineEvents.json`, and scenes the character is in.

Also introduces `timelineEvents` as a new top-level entity to be reused by Slice 10 (global timeline).

## New entity: TimelineEvent

In `src/js/schema.js`:

```js
export function createTimelineEvent() {
  return {
    id: uuid(),
    title: "",
    body: "",
    date: null,                 // "YYYY-MM-DD" or "YYYY-MM" or "YYYY"
    characterIds: [],           // one event can attach to multiple characters
    factionIds: [],             // optional: faction-level events
    plotlineIds: [],            // optional: thread an event into a plotline
    kind: "event",              // future-proof: "event" | "milestone" | ...
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}
```

The `date` field is more permissive than scenes: year-only is allowed. Add to `src/js/dates.js`:

```js
// Already exists: parseFlexibleDate, formatFlexibleDate, flexibleDateSortKey.
// Extend each to also accept "YYYY" (year-only).
// formatFlexibleDate of "1995" returns "1995". Of "1995-10" returns "October 1995".
// Of "1995-10-19" returns "19 October 1995".
// Sort key for "1995" treats it as "1995-01-01".
```

## New files

- `src/data/timelineEvents.json` — `[]`
- `src/js/views/faction-web.js`
- `src/js/views/personal-timeline.js`
- `src/js/views/timeline-event-dialog.js` (small form for creating/editing events)
- `src/css/faction-web.css`
- `src/css/personal-timeline.css`

## Files to touch

- `src/js/schema.js` (createTimelineEvent)
- `src/js/app.js` (load timelineEvents on boot, pass into appData)
- `src/js/storage.js` (add `timelineEvents` to whatever entity list it maintains)
- `main.js` (add `timelineEvents` to `ENTITY_FILES`)
- `src/js/views/character-sheet.js` (wire the two disabled buttons; remove the disabled attribute and titles)
- `src/index.html` (link the new CSS files)
- `ROADMAP.md`

## Checkpoint structure

### Checkpoint 1 — Faction Web modal

A new modal that opens from the Faction Web button. Architecturally identical to the relationship-web modal (gold-bordered, 90vw × 90vh, Esc/backdrop to close).

Contents: a Cytoscape graph showing:

- The character's factions as large colored nodes (matching the Faction Map styling)
- For each faction, its members as small owner-colored character nodes
- Edges connecting each faction to its members
- The viewing character is highlighted: gold border, slightly larger

Layout: `cose` force-directed, same config as faction-map.js.

Clicking a faction node opens that faction's page (closes the modal first). Clicking a character node opens that character's sheet.

Empty state: if the character has no factions, show "Not a member of any factions yet."

Reuse the `ownerColor()` helper from `src/js/util/owner-color.js`.

Build `faction-web.js`:

```js
export async function openFactionWeb(characterId, appData) { ... }
```

In `character-sheet.js`, wire the Faction Web button:

```js
button.addEventListener("click", async () => {
  const { openFactionWeb } = await import("./faction-web.js");
  openFactionWeb(character.id, appData);
});
```

Remove the `disabled` attribute on the Faction Web button. Remove the "Coming in Slice 9" title; replace with "Faction Web".

**STOP. Commit. User tests.**

### Checkpoint 2 — Personal Timeline modal

A modal opened from the Personal Timeline button. Uses vis-timeline (already vendored from Slice 7.5).

Contents: a horizontal timeline showing all events involving this character, plus auto-derived items.

Items on the timeline:

1. **Birth** (auto from `character.birthday`, if set): a special green dot or pin labeled with the character's name + "born".
2. **Death** (auto from `character.deathDate`, if set): a special dark/grey marker labeled "died".
3. **Backstory and life events** (from `timelineEvents.json` where `event.characterIds` includes this character).
4. **Scene appearances**: each scene where the character has a role AND status is "In progress" or "Complete" AND has a date. Render as colored boxes (color from any attached plotline if available, otherwise default).

Below the timeline, a section "Events" listing the same events as plain rows (for accessibility and easy editing), grouped by year. Each event row has edit and delete buttons. Below the list, an "Add event" button opens the timeline-event-dialog.

### Timeline event dialog

A small modal:

- Title input
- Date input (year, year-month, or full date; use a small "Precision" toggle: Year / Month / Day)
- Body textarea
- Other characters involved (combobox to add additional characterIds beyond the current viewing character)
- Save / Cancel / Delete (Delete only in edit mode)

When saving, the current viewing character is auto-included in `characterIds`. The user can remove themselves if they really want, though that's unusual.

### Modal close handling

Same pattern as the other modals: Esc, backdrop click, X button. Destroy the vis-timeline instance on close.

### Reactivity within the modal

When the user adds a new event via the dialog and saves, the timeline modal re-renders to include it. Simplest: destroy and rebuild the timeline canvas on data change.

### Current-date marker

Reuse the current-date custom-time marker pattern from slice 7.5. Vertical line at `meta.currentDate`.

### Empty state

If no birth, no death, no events, no scenes: show a placeholder inside the modal saying "Nothing on this character's timeline yet." with an "Add event" button.

In `character-sheet.js`, wire the Personal Timeline button:

```js
button.addEventListener("click", async () => {
  const { openPersonalTimeline } = await import("./personal-timeline.js");
  openPersonalTimeline(character.id, appData);
});
```

Remove `disabled` and update the title to "Personal Timeline".

**STOP. Commit. Done. Update ROADMAP.**

## CSS

`src/css/faction-web.css` — reuse styles from `relationship-web.css` where possible. Specifically the modal-overlay, modal-frame, modal-topbar, and tooltip classes. Add a new class `.fweb-canvas` for the Cytoscape container.

`src/css/personal-timeline.css` — modal frame + the events list below + add-event button. Reuse `vis-timeline.css` already linked from Slice 7.5.

## Out of scope

- Global timeline (Slice 10)
- Event templates ("birth", "started job", etc.)
- Auto-extracting events from scene body text
- Rich-text in event body
- Relations rework

## Definition of done

- Faction Web button opens a Cytoscape modal showing this character's factions and their other members
- Personal Timeline button opens a vis-timeline modal showing birth, death, life events, and scene appearances
- Life events can be added, edited, and deleted from inside the modal
- timelineEvents.json exists in user-data/
- Events can attach to multiple characters via characterIds
- Modals close cleanly (Esc, backdrop, X)
- Both buttons now show without disabled state
- ROADMAP.md updated with both checkpoints
