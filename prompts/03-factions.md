# Slice 3: Factions CRUD

Read CLAUDE.md. Confirm Slice 2 is done. Do not refactor anything from Slices 1 or 2 unless flagged first.

## Goal

Factions tab works fully. Character cards and sheets now show faction chips that link to faction pages, and a real faction picker appears on the character sheet.

## Faction schema

Add to `src/js/schema.js`:

```js
{
  id: string,
  name: string,
  summary: string,         // one liner for the card
  agenda: string,          // longer
  leaderId: string | null, // character id
  memberIds: string[],     // character ids, source of truth for membership
  sceneIds: string[],      // populated in slice 6
  plotlineIds: string[],   // populated in slice 7
  notes: string,
  color: string,           // hex chosen by user via color picker, used in chips and the faction map
  createdAt: string,
  updatedAt: string
}
```

`memberIds` on the faction is the source of truth. The character's `factionIds` is a derived mirror kept in sync whenever membership changes. Write a tiny helper `syncFactionMembership(characters, factions)` in schema.js that rebuilds `character.factionIds` from `faction.memberIds`. Call it after any membership edit.

## Files

### New

- `src/js/views/factions.js` (overview)
- `src/js/views/faction-page.js` (single faction)
- `src/css/factions.css`

### Touch

- `src/js/views/characters.js` to make faction chips real links and pull names from the factions store
- `src/js/views/character-sheet.js` to add the faction picker
- `src/js/app.js` for two new routes (`#/factions`, `#/factions/<id>`)
- `src/index.html` to link the new CSS

## Overview view

Card grid. Each card:

- Name in the faction's color
- Summary
- Member count
- Leader name (links to character)

Click routes to the faction page. "New faction" button at the top. Filter bar from `filters.js`:

- Text search across name, summary, agenda
- Member count facet, multi select with bucketed options (1 to 3, 4 to 9, 10+)
- "Has leader" toggle

When a new faction is created, default its color to a pleasant random hex so the card grid stays varied until the user picks one.

## Faction page

Form layout:

- Name, color picker (native `<input type="color">`, shows current swatch next to it), summary, agenda, notes
- Leader: a single character select
- Members: a multi select with search. Adding a member writes to `memberIds` and updates the matching character via `syncFactionMembership`
- Member list rendered as character chips, each linking to the character sheet, with an x to remove
- Scenes and plotlines sections show "populated in slice 6 / 7" placeholders

Same debounced save pattern as characters. Delete button at the top with confirm. On delete, remove the faction's id from every character's `factionIds`.

## Character sheet updates

Replace the faction placeholder section with a real picker:

- List of current factions as chips with x to remove
- An "Add faction" select listing all factions not yet attached
- Adding or removing here writes to the faction's `memberIds` and re-runs `syncFactionMembership`

Faction chips on the character card and sheet now link to `#/factions/<id>` and use the faction's color as the chip background. The faction facet on the Characters filter bar (added empty in Slice 2) now populates with real faction options.

## Out of scope

- Faction map (slice 5)
- Faction to faction relationships (followup, file under "future slice" in ROADMAP)
- Scenes and plotlines attachment to factions

## Definition of done

- Create, edit, delete factions
- Add and remove members from either the faction page or the character sheet, both sides update
- Deleting a faction cleans up character `factionIds`
- Faction chips on characters link to faction pages and render in faction colors
- Leader select shows characters and routes through
- ROADMAP.md updated
