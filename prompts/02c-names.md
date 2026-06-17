# Slice 2.6: Structured names and aliases

Read CLAUDE.md and ROADMAP.md. Slice 2.5 must be done and committed. This slice is a small focused schema change plus UI to match.

## Goal

Replace the single `name` field on characters with structured name parts (first, middle, last), plus two separate lists for previous names and aliases/codenames.

## Schema change

Update `src/js/schema.js`. The new character name fields:

```js
{
  // ... everything else unchanged ...
  firstName: string,         // required
  middleName: string,        // optional, "" if none
  lastName: string,          // optional, "" if none
  previousNames: string[],   // old legal names (maiden names, deadnames, etc)
  aliases: string[],         // active codenames or nicknames they currently use
  // remove the old `name` field
}
```

Add a helper to schema.js:

```js
export function displayName(character) {
  // Returns "First Last" if both present, otherwise whatever combination exists.
  // If only firstName is set, returns just firstName.
  // If no name parts but at least one alias exists, returns the first alias.
  // If nothing, returns "(unnamed)".
}
```

Every place in the app that previously read `character.name` must now call `displayName(character)` instead. Find all those sites: character cards, character sheet header, dropdowns in the relationship dialog, faction member chips, leader display on faction page, any tooltips, any search-by-name filters.

Bump `schemaVersion` to 3 in `meta.json` after migration.

## Migration

In the boot migration helper (which already exists from Slice 2.5 for version 1→2), add a 2→3 step:

- If `name` exists, split it: first whitespace-separated token → `firstName`, last token → `lastName` (if more than one token), everything in between → `middleName`. Single-token names become `firstName` only.
- Initialize `previousNames: []` and `aliases: []` if missing.
- Delete the old `name` field after copying.
- Save migrated array to disk, write new schemaVersion to meta.

Test mentally with examples:
- "Oakland" → firstName: "Oakland", lastName: "", middleName: ""
- "Erwin Thompson-Hayes" → firstName: "Erwin", lastName: "Thompson-Hayes"
- "Erwin Lawrence Thompson-Hayes" → firstName: "Erwin", middleName: "Lawrence", lastName: "Thompson-Hayes"

(The migration cannot know that "Oakland" is a nickname for "Erwin Thompson-Hayes". The user will fix those by hand. That is fine.)

## Character sheet UI

Replace the single name input in the character sheet header with a row of three smaller inputs labeled First, Middle, Last. Below them, two small expandable sections:

**Previous names** (collapsed by default, header shows count like "Previous names (0)"). When expanded, shows the list as removable chips plus a small input + "Add" button to append a new one.

**Aliases / codenames** (same UI pattern, separate list).

Both stored as plain string arrays. No dedup logic needed, no sorting.

The character card overview shows `displayName(character)` as the main title. If `aliases.length > 0`, show the first alias under the name in smaller italic muted text, prefixed with "a.k.a." For example:

```
Erwin Thompson-Hayes
a.k.a. Redwood
```

If you want to also show a previous-names indicator on the card, do it as a tiny grey chip "+1 prev" in the corner. Optional. Tasteful.

## Relationship dialog dropdown

The "Other character" dropdown in the relationship dialog already lists characters by name. Update it to list by `displayName(character)`, and to also search across aliases and previousNames when the user types. So typing "Redwood" should find Oakland. Typing a former name should find the right character.

## Out of scope

- Any change to relationship data
- Any change to factions
- Any change to scenes, plotlines, anomalies (none exist yet anyway)
- No name search on the Characters overview filter bar beyond what already exists; the existing search box just needs to also match aliases and previousNames, not just first/middle/last

## Definition of done

- Schema is version 3, migration runs cleanly on existing data
- Character sheet shows First, Middle, Last as separate inputs
- Previous names and aliases are editable lists
- Cards display via `displayName()` plus first alias as "a.k.a." line if present
- Relationship dialog dropdown searches across aliases and previous names
- Characters overview search matches aliases and previous names
- ROADMAP.md updated with Slice 2.6 status: done
