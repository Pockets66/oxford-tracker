# Slice 2.5: Character sheet redesign + filter bar redesign + theme polish

Read CLAUDE.md and ROADMAP.md. Slice 3 must be done. This slice modifies schema, character sheet layout, character overview filter bar, and CSS theme. It also adds the relationship dialog that Slice 4 will later expose visually.

**Do not refactor storage, router, dom, or app boot.** Touch only what is listed.

## Goal

Five things:

1. Refine the character schema (drop unused fields, add birth time and place, add zodiac as proper data)
2. Replace the character sheet layout with one large background canvas + small side cards
3. Add a relationship add/edit dialog (writes to `relationships.json`, source of truth for Slice 4)
4. Rebuild the filter bar visually: owner toggles as colored chips, factions as a dropdown-then-chip pattern
5. Make dark theme the default and ensure scrollbars/inputs match the aesthetic everywhere

## Schema migration

Update `src/js/schema.js`. The new character shape:

```js
{
  id: string,
  name: string,
  age: number | null,
  birthday: string | null,       // ISO date "YYYY-MM-DD", from <input type="date">
  birthTime: string | null,      // "HH:MM" 24-hour, from <input type="time">, optional
  placeOfBirth: string,          // freeform
  zodiac: {
    sun: string | null,          // auto-computed from birthday, but stored
    moon: string | null,         // dropdown selection
    rising: string | null        // dropdown selection
  },
  owner: string,                 // "Bree", "Jack", "Nicole", "Caiden", "NPC", or comma joined
  deceased: boolean,
  factionIds: string[],
  summary: string,               // short, on card
  background: string,            // large free-text canvas, replaces the old multi-field sheet
  cards: {
    skills: string,
    secrets: string,
    notes: string
    // currentPlots is derived, not stored. See below.
  },
  createdAt: string,
  updatedAt: string
}
```

**Migration of existing data.** When the app boots, run a one-time migration on the loaded characters array:

- If a character has `sheet` (the old shape), move its fields. Specifically: combine `sheet.family` + `sheet.notes` into the new `background` string (separated by a blank line if both exist). Move `sheet.skills`, `sheet.secrets` into `cards`. Drop `sheet.fears` and `sheet.weaknesses` (and `sheet.family` after merging).
- If `zodiac` is the old flat object, keep it (the shape is unchanged).
- Add `birthTime: null`, `placeOfBirth: ""` if missing.
- Set `background: ""` if missing.
- Set `cards: { skills: "", secrets: "", notes: "" }` if missing.
- Save the migrated array back so the JSON on disk reflects the new shape.

Run the migration once on load, gated by a version check in `meta.json`. Bump `schemaVersion` to 2. If meta says version 2, skip migration.

`currentPlots` is **not** a stored field. It is computed at render time by looking through `plotlines.json` for plotlines whose attached scenes include this character, OR plotlines directly tagged with this character (Slice 7 will add a way to tag). For Slice 2.5, return an empty list since plotlines have no character link yet. The Current Plots card just shows "No current plots" until Slice 7. Render the card empty but present.

## Zodiac auto-computation

Create `src/js/zodiac.js` with one exported function:

```js
export function sunSignFromDate(isoDate) {
  // Returns the Western sun sign for a YYYY-MM-DD date, or null if invalid.
}
```

Use the standard date ranges (Capricorn Dec 22 – Jan 19, etc). When the user changes the birthday field on the sheet, call this and write the result into `character.zodiac.sun`. The sun field on the sheet displays the computed value as read-only text (not an editable input).

Moon and rising are **dropdowns** with all 12 signs as options plus a blank "—" option for unknown. Stored verbatim.

The 12 signs in order: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces.

## Character sheet layout

Rewrite `src/js/views/character-sheet.js`.

The page is two columns:

**Left column (60% width):** the main canvas.
- Top: name input (large, EB Garamond)
- Under it: owner select + deceased checkbox on one line
- Identity row: age, birthday (date picker), birth time (time picker, optional), place of birth (text)
- Zodiac row: sun (auto, read-only display), moon (dropdown), rising (dropdown)
- Summary textarea (small, 2 rows, "short description shown on the card")
- Background textarea (large, min 20 rows, autoresize as it fills, "freeform background and story")
- Faction picker section (keep the existing Slice 3 UI here, unchanged)
- Relationships section: header "Relationships" with a small "+ Add relationship" button. Below it, a list of current relationships rendered as rows: `{Other character's name} — {type} ({closeness})` with edit and remove buttons per row. Clicking the character name navigates to their sheet.

**Right column (40% width):** the side cards. Each card is a labeled box with a textarea inside, except Current Plots.
- Card 1: **Current Plots** (computed, read-only list of plotline links, or "No current plots")
- Card 2: **Skills** (textarea)
- Card 3: **Secrets** (textarea)
- Card 4: **Notes** (textarea)

All textareas debounce-save 400ms after typing stops, same pattern as before.

Below 1100px width, the columns stack. Side cards become a horizontal scrolling row or a 2-column grid below the main canvas (whichever is simpler in CSS, do not engineer a complex responsive system).

## Relationship dialog

Create `src/js/views/relationship-dialog.js` exporting `openRelationshipDialog(characterId, existingRelationshipId)`.

When called with just `characterId`, opens a "create new" dialog. When called with an existing relationship id, opens an "edit" dialog prefilled.

Dialog fields:
- Other character (searchable dropdown of all other characters)
- Type (dropdown, see list below)
- Closeness (dropdown, see list below)
- Notes (small textarea, optional)
- Buttons: Save, Cancel, plus Delete (only in edit mode)

**Type options** (Sims-inspired, ordered for usability):

Family: Parent, Child, Sibling, Spouse, Ex-spouse, Other family
Romantic: Lover, Ex-lover, Crush, Fiancé(e)
Social: Friend, Best friend, Roommate, Classmate, Colleague, Mentor, Student
Negative: Rival, Enemy, Nemesis
Other: Acquaintance, Stranger, Other

**Closeness options:** Estranged, Distant, Acquaintance, Familiar, Close, Inseparable

**Reciprocal handling.** Saving a relationship from A→B prompts a follow-up step in the same dialog: "Set the reciprocal from {OtherName} to {ThisName}". Auto-suggest the inverse type where obvious:

- Parent ↔ Child
- Sibling ↔ Sibling
- Spouse ↔ Spouse
- Ex-spouse ↔ Ex-spouse
- Lover ↔ Lover
- Ex-lover ↔ Ex-lover
- Friend ↔ Friend, Best friend ↔ Best friend
- Rival ↔ Rival, Enemy ↔ Enemy
- Crush has NO auto-reciprocal (asymmetry is intentional)
- Mentor ↔ Student
- Acquaintance ↔ Acquaintance

For everything else, leave the reciprocal type blank and let the user pick. Closeness defaults to the same value but is editable (A can feel "Close" while B feels "Distant", that's intentional).

Save writes two edges to `relationships.json`. Each edge:

```js
{
  id: uuid,
  from: characterAId,
  to: characterBId,
  type: string,
  closeness: string,
  notes: string,
  createdAt: iso,
  updatedAt: iso
}
```

Edit mode edits only the single edge that matched the id passed in. (No automatic symmetric edit, since asymmetry is the point.)

Delete mode in the dialog: ask "Also remove the reciprocal from {OtherName}?" with a checkbox defaulted to yes. If checked, delete both edges. If unchecked, delete only this one.

## Filter bar redesign

Rewrite `src/js/filters.js` to support two new control types: **owner-toggles** and **faction-dropdown**.

**Owner-toggles control.** Renders five circular chips in a row, one per owner (Bree green, Jack yellow, Nicole blue, Caiden red, NPC sepia). All chips start "on" (saturated, glowing, full color). Clicking a chip toggles it "off" (greyed out, low opacity). The active set is the set of "on" owners. Characters whose owner appears in the active set are shown. Characters with multi-owner strings ("Bree, Jack") match if ANY of their owners is in the active set.

Each chip is a button. Size around 36px diameter. The owner's first letter in EB Garamond inside the chip. Hover state slightly enlarges. Off state: 25% opacity plus desaturation.

**Faction-dropdown control.** A single `<select>` styled to match the theme. When the user picks a faction from the dropdown, the faction's name becomes an active chip below the dropdown (colored with that faction's color), and the dropdown resets. Clicking the active chip's × removes it from the active set. Multiple chips can be active. Behavior:

- Zero active faction chips → no faction filtering, all characters pass through this filter
- One or more active faction chips → only characters whose `factionIds` intersect the active set pass through (OR semantics: any match qualifies)

Characters with no factions match only when zero faction chips are active.

**Update the Characters overview** to use these controls. The owner facet from Slice 2 becomes `owner-toggles`. The faction facet becomes `faction-dropdown`. Search and the deceased toggle stay as they are visually (but restyled, see Theme polish below).

## Theme polish

**Make dark theme the default.** In `app.js`, change the default in the theme toggle setup to `"dark"` if no preference is stored. Update the icon to match (toggle shows the sun in dark mode, which is already correct).

**Style scrollbars to match.** Add to `theme.css`:

```css
/* Custom scrollbars in both themes. */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--accent) var(--bg-surface);
}
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
*::-webkit-scrollbar-track {
  background: var(--bg-surface);
}
*::-webkit-scrollbar-thumb {
  background: var(--accent);
  border-radius: 0;
  border: 2px solid var(--bg-surface);
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--accent-hover);
}
```

**Style form inputs, selects, textareas, and date pickers** to match the aesthetic. None should appear as default OS controls. They should:
- Use `--bg-surface` background, `--text` color, `--border` 1px border
- Use Inter font, comfortable padding
- Focus state: 1px `--gold` outline plus subtle `--gold-soft` glow
- No rounded corners (or very subtle 2px max), to match the rest of the app
- Date and time pickers cannot be fully restyled cross-browser but should at least have their wrapping container colored correctly and the calendar indicator icon inverted for dark theme via `filter: invert(0.9)` on `::-webkit-calendar-picker-indicator`

**Style the relationship dialog** consistently. Modal backdrop is `--bg` at 80% opacity. Dialog itself is `--bg-surface` with a `--gold` 1px border and the same double-rule decoration as the welcome card from Slice 1.5. Buttons match the welcome card button (sharp corners, accent background, gold border on hover).

## Files to create

- `src/js/zodiac.js`
- `src/js/views/relationship-dialog.js`
- `src/css/sheet.css` (new, for the two-column character sheet)
- `src/css/dialog.css` (new, for the relationship dialog)

## Files to touch

- `src/js/schema.js` (new fields, migration helper)
- `src/js/app.js` (run migration on boot, change theme default)
- `src/js/views/characters.js` (use new filter bar control types)
- `src/js/views/character-sheet.js` (full rewrite of the layout)
- `src/js/views/factions.js` (simplify filter bar, see below)
- `src/js/filters.js` (add owner-toggles and faction-dropdown control types)
- `src/css/theme.css` (scrollbars, form inputs, set dark as default)
- `src/css/characters.css` (adjust to new layout if needed)
- `src/index.html` (link new CSS files)
- `ROADMAP.md` (add a "Status: done" line under a new Slice 2.5 section, update Slice 4 description to mention that relationships are now created via the dialog and the web view just visualizes them)

## Factions overview filter cleanup

The current Factions overview filter bar (from Slice 3) includes member count buckets and a "has leader" toggle. Remove both. The Factions overview filter bar should now be **just a single text search** across name, summary, and agenda. Nothing else.

## Out of scope

- The Relationship Web visualization (Slice 4 still owns that)
- The Faction Map (Slice 5)
- Any scene or plotline work
- A separate Graveyard tab (deferred to the followups bucket; deceased filter handles it for now)

## Definition of done

- Schema migration runs once, old characters load without losing data, JSON files on disk reflect the new shape, schemaVersion is 2
- Birthday is a date picker, picking a date auto-fills the sun sign as read-only text
- Moon and rising are dropdowns of the 12 signs plus blank
- Place of birth field works
- Character sheet has the two-column layout, background canvas is large and prominent, side cards stack on the right in the order Current Plots, Skills, Secrets, Notes
- Add relationship button opens the dialog, picking another character + type + closeness saves two edges (with the reciprocal flow)
- Editing or deleting a relationship works, including the "also remove the reciprocal?" prompt
- Owner filter is five colored circular toggle chips, all on by default, clicking toggles
- Faction filter is a dropdown that creates active chips, multiple chips = OR
- Dark theme is the default on first launch
- Scrollbars, inputs, selects, textareas, and the date picker all visually match the theme in both light and dark
- ROADMAP.md updated
