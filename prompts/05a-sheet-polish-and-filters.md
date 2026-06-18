# Slice 5.5: Character sheet polish + persistent filter panel

Read CLAUDE.md and ROADMAP.md. Slice 5 must be done. **Medium effort. Surgical edits throughout.**

**Migration policy:** No data migration needed. Schema changes apply to fresh-created entities only. Final data import is post-all-slices.

## Files to read first

- `src/js/views/character-sheet.js`
- `src/js/views/characters.js`
- `src/js/views/relationship-dialog.js`
- `src/js/filters.js`
- `src/js/schema.js`
- `src/css/sheet.css`
- `src/css/characters.css`
- `src/css/dialog.css`
- `ROADMAP.md`

## Goal

Eight unrelated improvements bundled because each is small:

1. Remove birth time field entirely from the schema and UI
2. Death date row only renders when deceased is checked
3. Sun sign default; "+ More astrological info" expander reveals moon, rising, time of birth, place of birth
4. Two checkboxes per alias: "Display as primary name" and "Display as a.k.a." (independent)
5. Languages card with searchable dropdown + add-new + 3 competency levels
6. `knowsSupernatural` checkbox on the character sheet
7. Allow editing relationships involving deceased characters (frozen styling stays, edit button enabled)
8. New filter panel on the Characters overview: owner toggles stay inline; everything else (faction, language, supernatural, deceased) goes behind a "Filter by..." button. Filter state persists across reloads via localStorage. "Clear all filters" button.

The old `cards.secrets` textarea on the character sheet gets replaced with a placeholder div ("Secrets card will be populated in slice 6"). Existing `cards.secrets` field stays in `createCharacter()` defaults for now; slice 6 will remove it cleanly.

## Schema changes

In `src/js/schema.js`:

- Remove `birthTime` from `createCharacter()`'s default object.
- Add `languages: []` (array of `{ name, level }` objects) to `createCharacter()`.
- Add `akaAliasIndices: []` to `createCharacter()`.
- Add `meta.knownLanguages: []` to the meta default if there is one. If meta is loaded fresh from disk and lacks the field, defensively set `meta.knownLanguages ??= []`.
- Export a constant:
  ```js
  export const LANGUAGE_LEVELS = ["Broken", "Accented", "Native"];
  ```

No migration code needed.

## Character sheet changes

In `src/js/views/character-sheet.js`:

### Remove birth time

Find the birth time input markup and remove it. Tidy any row that becomes lopsided.

### Death date conditional

Extract the deceased + death date area into a small helper `renderMortalityRow(character)`. It returns either:
- Just the deceased checkbox row (when `character.deceased === false`)
- The deceased checkbox row + a death date input row (when `character.deceased === true`)

The deceased checkbox's change handler:
1. Sets `character.deceased = checked`
2. If unchecked, also sets `character.deathDate = null`
3. Calls `replaceMortalityRow()` which swaps the rendered block in place

### Sun sign + expander

Find the zodiac row (sun read-only + moon dropdown + rising dropdown). Restructure:

- Sun sign always displayed (read-only, computed from birthday).
- Below the sun sign: a button `+ More astrological info` (class `btn-link`, EB Garamond italic, `--text-muted`).
- Clicking it reveals a sub-section with: moon dropdown, rising dropdown, time of birth input (`type="time"`), place of birth text input.
- Sub-section initially expanded if any of those fields are non-empty; collapsed if all empty.

In this slice, all four sub-fields appear in the editor when the expander is open. The "only show filled fields when reading the sheet" idea is part of slice 6.5 (printed view). For now, the expander itself is enough.

### A.k.a. checkboxes per alias

Find the `makeNameList` helper for aliases. Currently it has one checkbox per alias for "Display as primary name". Add a **second** checkbox next to it: "Display as a.k.a."

- "Primary" remains radio behavior across aliases (only one can be primary), persists to `displayAliasIndex`.
- "A.k.a." is independent and can be set on multiple aliases simultaneously. Persists to `akaAliasIndices: number[]`. Add/remove indices as boxes are toggled.

The character card's a.k.a. line in `characters.js`:

```js
const akas = (character.akaAliasIndices || [])
  .map(i => character.aliases?.[i])
  .filter(Boolean);
// Render "a.k.a. " + akas.join(", ") only if akas.length > 0
```

Remove the existing auto-show-first-alias behavior. A.k.a. lines now appear only when explicitly toggled.

### Languages card

Add a new card in the right column (slot it above Skills). Title "Languages".

- List existing `character.languages` entries as rows: `{name} — {level}    [×]`
- Below: a combobox with `meta.knownLanguages` options (alphabetized), plus a final option `+ Add new language…`
- Picking "+ Add new" prompts (via `prompt()`) for the name, pushes onto `meta.knownLanguages` (sorted, de-duplicated), and selects it in the combobox.
- A level dropdown sits next to the combobox: Broken / Accented / Native (use LANGUAGE_LEVELS).
- An "Add" button pushes `{ name, level }` to `character.languages`.
- Removing an entry from a character does not touch `meta.knownLanguages`.

Save meta on knownLanguages change. Save the character on language list change.

### `knowsSupernatural` checkbox

Add a small checkbox in the identity block (near the owner select). Label: "Knows the supernatural". Persists to `character.knowsSupernatural`.

### Secrets card placeholder

Find the existing Secrets card in the right column (currently a textarea). Replace the textarea with a placeholder paragraph:

```
"Secrets will be tracked in the Secrets tab (coming next)."
```

Keep the card structure. Slice 6 fills it in.

## Relationship dialog change

In `relationship-dialog.js`, find the disable logic for the edit button on deceased rows. Remove it. The frozen styling and bottom-sorting stay; edit is allowed.

In `sheet.css`, find the `.rel-row--frozen .btn-small:not(.btn-small--danger)` rule. Remove the `pointer-events: none` and any color override that greys the edit button. The opacity reduction on the row itself stays.

## Characters overview: persistent filter panel

The biggest change in this slice. Current filter bar has owner toggles + faction dropdown + deceased toggle inline. Replace with:

**Inline (always visible):**
- Search text input (left)
- Owner toggle chips
- "Clear all filters" button (visible only when any non-default value is active)
- "Filter by..." button (right)

**Inside the "Filter by..." popover:**
- Faction filter (existing dropdown-and-chips control)
- Language filter (same control type, but options from `meta.knownLanguages`; matches characters who speak any selected language)
- Knows the supernatural: three-state control. "All" / "Only knows" / "Only doesn't know". Either three radio chips or a cycle button.
- Deceased toggle

Popover anchors below the button. Clicking outside closes it.

### Filter persistence

Add to `src/js/filters.js`:

- `createFilterBar(config, { persistKey } = {})` — when `persistKey` is provided:
  - On init, read `localStorage.getItem('oxford-filters-' + persistKey)`; if present, parse it and merge with defaults so old saved state doesn't break when new facets are added.
  - On every state change, write the current state to localStorage.

For Characters overview, pass `persistKey: "characters"`. For Factions overview, pass `persistKey: "factions"`.

### Clear all

Add a small "Clear filters" button (text-only, `btn-link` style). Show it only when at least one filter has a non-default value. Click resets all filters to defaults and clears the localStorage entry for that key.

### Language filter application

`applyFilters` in `characters.js` gains a language check: if any languages are in the active facet, keep only characters who have at least one matching language in `character.languages[].name` (case-insensitive).

## Files to touch

- `src/js/schema.js` (drop birthTime, add languages, akaAliasIndices, LANGUAGE_LEVELS, meta.knownLanguages)
- `src/js/views/character-sheet.js` (mortality row, sun expander, two checkboxes per alias, languages card, knowsSupernatural checkbox, secrets card placeholder, remove birth time)
- `src/js/views/characters.js` (a.k.a. rendering update, new filter panel control wiring, language filter, clear-all)
- `src/js/views/factions.js` (add persistKey to filter bar)
- `src/js/views/relationship-dialog.js` (remove disable-on-deceased; surgical)
- `src/js/filters.js` (persistKey support, "Filter by" panel control type, clear-all helper)
- `src/js/components/combobox.js` (ensure "+ Add new" option support if not already there)
- `src/css/sheet.css` (mortality row, sun expander, languages card, double a.k.a. checkbox)
- `src/css/characters.css` (filter panel layout, clear-all button, popover)
- `src/index.html` (no new CSS files unless preferred)
- `ROADMAP.md` (mark slice 5.5 done)

## Out of scope

- Secrets system (slice 6)
- Printed character sheet view (slice 6.5)
- Auto-calculated zodiac from birth time + place
- Faction-to-faction relationships
- Any data migration

## Definition of done

- Birth time field gone everywhere
- Death date row only shows when deceased is checked; clears on uncheck
- Sun sign always displayed; "+ More astrological info" expander reveals moon/rising/time of birth/place of birth
- Each alias has two independent checkboxes; a.k.a. line on the card only shows for explicitly ticked aliases
- Languages card works: add, remove, level selection, new-language registration
- "Knows the supernatural" checkbox on the sheet
- Secrets card on the sheet is a placeholder
- Edit button on relationship rows with deceased characters now works
- Characters overview: inline owner toggles + search, "Filter by..." button reveals faction/language/supernatural/deceased
- "Clear all filters" button appears when any filter is non-default
- Filter state persists across app restarts (per overview)
- Languages filter works
- ROADMAP.md updated
