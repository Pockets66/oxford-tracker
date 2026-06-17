# Slice 2: Characters CRUD

Read CLAUDE.md. Confirm Slice 1 is marked done in ROADMAP.md before starting. Do not modify storage.js, router.js, or dom.js unless a specific need comes up and you have flagged it first.

## Goal

The Characters tab fully works for adding, editing, viewing, and deleting characters. No relationships, no faction membership UI yet (faction field exists in the data but renders as plain text chips until Slice 3).

## Character schema

Add to `src/js/schema.js` (new file) a documented object describing the character shape:

```js
{
  id: string,              // uuid
  name: string,
  age: number | null,
  birthday: string | null, // ISO date or freeform
  zodiac: {
    sun: string | null,
    moon: string | null,
    rising: string | null
  },
  owner: string,           // one of "Bree", "Jack", "Caiden", "Nicole", "NPC", or comma joined for shared
  deceased: boolean,
  factionIds: string[],    // empty for now, populated in slice 3
  summary: string,         // short, shown on card
  sheet: {
    secrets: string,
    family: string,
    skills: string,
    fears: string,
    weaknesses: string,
    notes: string
  },
  createdAt: string,
  updatedAt: string
}
```

A `createCharacter()` factory in schema.js returns a new object with defaults and a fresh uuid.

## Files

### New files

- `src/js/views/characters.js` (overview grid)
- `src/js/views/character-sheet.js` (single character editor)
- `src/js/schema.js`
- `src/css/characters.css`

### Files to touch

- `src/js/app.js` to register the two routes (`#/characters` and `#/characters/<id>`)
- `src/index.html` to link `characters.css`

That is it. Do not refactor storage, router, or app boot.

## Overview view

Grid of cards. Each card shows:

- Name (large)
- Age, birthday line
- Zodiac line (sun moon rising, with em-dashes... wait, no dashes anywhere, use slashes or commas)
- Owner badge in the owner color
- Summary text, truncated to 3 lines
- Faction chips (just names from `factionIds`, no link yet, no styling beyond a chip background)

Card click routes to `#/characters/<id>`. Deceased characters render at 50 percent opacity with a "Deceased" tag.

Top of grid: a "New character" button. Below it, the filter bar built from `filters.js` with this config:

- Text search across name and summary
- Owner facet, multi select with options Bree, Jack, Nicole, Caiden, NPC
- Faction facet, multi select with options pulled from the factions store (will be empty until Slice 3, that is fine)
- Deceased toggle, default on (shows deceased characters; turning off hides them)

Subscribe to the filter bar and re-render the card grid on each change.

## Character sheet view

Editable form for every field in the schema. Layout:

- Header with name input, owner select, deceased checkbox, delete button
- Identity block: age, birthday, zodiac trio
- Summary textarea
- Sheet sections, each a labeled textarea: secrets, family, skills, fears, weaknesses, notes
- Faction chips section (read only display from `factionIds`, real picker comes in Slice 3)

No save button. Debounce changes by 400ms then persist via `storage.save('characters', allCharacters)`. Show a small "Saved" pill that fades after each successful write.

Delete shows a confirm dialog. On confirm, remove from the array, write, route back to `#/characters`.

A "Back to characters" link at the top of the sheet.

## Owner color coding

In `theme.css` the variables already exist from Slice 1. Use them:

```css
.character-card[data-owner="Bree"] { border-left: 4px solid var(--owner-bree); }
```

For shared owners (e.g. `"Bree, Jack"`), split the left border evenly using a linear gradient. Implement this with a small helper that parses the owner string and generates the gradient.

## Out of scope

- Faction picker (slice 3 adds this)
- Relationship web (slice 4)
- Any cross linking to scenes or plotlines

## Definition of done

- New character button creates a character and routes into its sheet
- Editing any field persists within half a second of stopping typing
- Reloading restores the character intact
- Deleting works and removes the card
- Owner colors render, including shared owners
- Deceased toggle greys the card
- Filter bar works: search narrows the grid, owner facet filters, faction facet is present (empty options until slice 3), deceased toggle hides or shows greyed cards
- ROADMAP.md updated with status and any followups
