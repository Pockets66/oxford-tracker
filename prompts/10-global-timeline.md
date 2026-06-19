# Slice 10: Global Timeline tab

Read CLAUDE.md and ROADMAP.md. Slice 9 must be done. **Medium effort. Two checkpoints.** Use surgical edits.

**Migration policy:** No migration.

## Files to read first

- `src/js/views/personal-timeline.js` (the per-character timeline; this slice generalizes it)
- `src/js/views/scenes.js`
- `src/js/views/plotlines.js`
- `src/js/views/plotline-detail.js` (uses vis-timeline already)
- `src/js/schema.js`
- `src/js/app.js`
- `src/js/router.js`
- `src/index.html`
- `src/js/dates.js`
- `ROADMAP.md`

## Goal

A new top-level **Timeline** tab. Listed FIRST in the tab order (left of Characters). Shows every dated item across the project:

- All scenes with a date (Draft / In progress / Complete; user can filter by status)
- All timeline events (from `timelineEvents.json`)
- Birth and death markers for every character with a birthday or deathDate
- Plotline membership color-codes the items
- Current-date marker

Filters along the side or top to narrow by character, faction, plotline, item kind, and date range.

## Tab order change

In `src/index.html`, find the topbar tabs (Characters, Scenes, Plotlines, Factions, Secrets, Anomalies). Insert **Timeline** as the first item:

```
TIMELINE | CHARACTERS | SCENES | PLOTLINES | FACTIONS | SECRETS | ANOMALIES
```

In whatever module declares tabs in JS (likely `app.js`), insert Timeline at index 0. Route `#/timeline`.

Default route on first launch is now `#/timeline` (since it's the first tab).

## New files

- `src/js/views/global-timeline.js`
- `src/css/global-timeline.css`

## Files to touch

- `src/js/app.js` (route, tab declaration)
- `src/js/router.js` (if tabs are listed there)
- `src/index.html` (Timeline tab markup, link new CSS)
- `ROADMAP.md`

## Checkpoint structure

### Checkpoint 1 — Timeline view with all dated items

Build the basic global timeline view:

- Lazy-import vis-timeline (already vendored)
- Collect all dated items into a single dataset:
  - **Scenes** with `sceneDate` set. Status In progress = Oxford blue, Complete = gold, Draft = ivory.
  - **Timeline events** (all of them).
  - **Births**: one item per character with a birthday. Small green pin.
  - **Deaths**: one item per character with a deathDate. Small dark grey pin.
- Render each item with:
  - Content: a short label combining title and (for scenes) participants, or (for events) the event title, or (for births/deaths) "{name} born/died"
  - Tooltip on hover with the full title, date, and participants
  - Color from plotline membership if available, otherwise from status (for scenes) or kind (for events/births/deaths)
- Current-date custom marker (vertical line) using the meta.currentDate
- Click handlers:
  - Scene → open scene page
  - Event → open the timeline-event-dialog from Slice 9 (edit mode)
  - Birth/death → open the character sheet
- Initial zoom: roughly the campaign year ± 6 months.
- **STOP. Commit. User tests.**

### Checkpoint 2 — Filters and "Add event" button

Add a filter panel on the left side of the timeline view (or above; whichever is cleaner). Filters:

- **Status**: multi-toggle Draft / In progress / Complete (for scenes). All on by default. Toggling off hides matching scenes.
- **Item kind**: multi-toggle Scenes / Events / Births / Deaths. All on by default.
- **Character**: faction-dropdown-style filter. Multi-select. If any character is selected, only items involving that character appear (scenes where they have a role, events with them in `characterIds`, their own birth/death).
- **Faction**: faction-dropdown-style filter. Multi-select. Items match if a connected character is in any selected faction, OR if the item is a scene with that faction tagged, OR if a timelineEvent has the faction in `factionIds`.
- **Plotline**: faction-dropdown-style filter. Multi-select. Items match if they belong to the plotline (scenes via `plotline.items`, events via `event.plotlineIds`).
- **Date range**: two date inputs (from / to). Items outside the range are hidden.

Filter state persists via `persistKey: "global-timeline"` (use the existing filters.js persistence pattern).

Add a "Clear filters" button when any filter is non-default.

Add an "Add event" button at the top of the timeline view (right side of the toolbar). Opens the timeline-event-dialog from Slice 9 with no character pre-selected. After save, the timeline re-renders to include the new event.

**STOP. Done. Update ROADMAP.**

## Visual styling

Reuse `vis-timeline.css` already linked from Slice 7.5. Custom styles in `src/css/global-timeline.css`:

- Outer container fills the tab content area (calc viewport minus topbar minus toolbar)
- Toolbar: filter pills + "Add event" button + "Clear filters" link
- Timeline canvas takes the rest of the height
- Item color classes for status and kind (Oxford blue / gold / ivory for scenes; green / dark grey for births / deaths; default for events)

## Empty state

If no scenes, events, births, or deaths have dates: show:

> No dated items yet. Add scene dates, character birthdays, or events from other tabs to populate the timeline.

with a small "Add event" button below.

## Performance

With current data sizes (under 100 items), no special handling needed. Vis-timeline handles thousands of items without trouble.

## Out of scope

- Editing scenes or characters directly from the timeline (click navigates to their page instead)
- Timeline export
- Multiple timeline lanes / swimlanes by character
- Relations rework

## Definition of done

- Timeline tab is first in tab order, route `#/timeline`
- Default route on first launch is timeline
- Timeline shows all dated scenes, all timeline events, all character births and deaths
- Items color-coded by status or kind
- Filters work and persist
- Add event button opens the event dialog
- Current-date marker visible
- Click on items opens the appropriate page
- ROADMAP.md updated with both checkpoints
