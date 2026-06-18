# Roadmap

Slices are built in order. Each one ships something usable. Mark a slice complete by adding a `**Status: done**` line under it with the date, plus any followups discovered.

## Slice 1: Scaffolding and storage

Tab shell, File System Access integration, JSON read/write plumbing, empty data files, welcome screen, settings panel for opening or switching the data folder. No entity features yet, just the skeleton everything else hangs from.

Prompt: `prompts/01-scaffolding.md`

## Slice 1.5: Oxford aesthetic pass

CSS overhaul plus a small theme toggle. Aged paper, Oxford blue, oxblood, gold leaf. Serif headings. Light and dark themes both supported. JS untouched except for theme persistence.

Prompt: `prompts/01b-oxford-styling.md`

**Status: done** — 2026-06-17

## Slice 1.6: Electron conversion

Wrap the app as a native desktop application. Replace File System Access API with Node fs through a secure preload bridge. Data folder is automatic, no permission prompts. Removes welcome overlay. Adds `npm start` and a Windows installer build.

Prompt: `prompts/01c-electron.md`

**Status: done** — 2026-06-17

Followups:
- App icon deferred — add `src/assets/icon.ico` and uncomment the `icon` line in `package.json` when ready.
- Settings view (gear button currently wired to nothing): display data folder path, export/import shortcuts, app version. Add as a future slice.

## Future slice: Settings view

Data folder location display, theme override, export/import shortcuts, app version display. Settings button in the topbar routes here.

## Slice 2: Characters CRUD

Characters tab with overview card grid and per character detail page. Add, edit, delete. Fields cover the character sheet basics (name, age, birthday, zodiac, owner, deceased toggle, factions placeholder, notes sections for secrets, family, skills, fears, weaknesses). Owner color coding via CSS variables. Deceased characters render greyed out.

Prompt: `prompts/02-characters.md`

**Status: done** — 2026-06-17

Followups:
- Faction chips on the card and sheet show raw IDs until Slice 3 resolves names.
- Owner select allows only a single owner; multi-owner ("Bree, Jack") must be typed manually into the data for now — a multi-select owner picker is a natural Slice 8 polish item.
- `.btn-primary` and `.btn-danger` live in `characters.css` for now; move to a shared `buttons.css` when a second slice needs them.

## Slice 2.5: Character sheet redesign + filter bar redesign + theme polish

Schema migration (v1 → v2): drop `sheet`, add `background`, `cards`, `birthTime`, `placeOfBirth`. Two-column character sheet layout with large background canvas and side cards (Current Plots, Skills, Secrets, Notes). Relationship add/edit dialog writing to `relationships.json`. Owner filter rebuilt as five colored circular toggle chips. Faction filter rebuilt as dropdown-then-chip (OR semantics). Dark theme now default. Scrollbars, inputs, selects, textareas all styled to match the Oxford aesthetic.

Prompt: `prompts/02b-sheet-and-filters.md`

**Status: done** — 2026-06-17

Followups:
- Current Plots card is empty until Slice 7 adds character tags on plotlines.
- The Relationship Web visualization (Slice 4) will visualize the edges written by this dialog.

## Slice 2.6: Structured names and aliases

Replace single `name` field with `firstName`, `middleName`, `lastName`, plus `previousNames[]` and `aliases[]` string arrays. `displayName(character)` helper used everywhere. Schema migration v2→v3 splits existing names on whitespace. Character sheet header shows three name inputs; expandable lists below for previous names and aliases. Character cards show `displayName` as title plus first alias as "a.k.a." line. Relationship dialog and faction-page character dropdowns show displayName + first alias in parentheses. Search (characters overview) matches across display name, aliases, and previous names.

Prompt: `prompts/02c-names.md`

**Status: done** — 2026-06-17

## Slice 3: Factions CRUD

Factions tab with overview cards and per faction page. Add, edit, delete. Fields: name, agenda, leader (character link), members (character links), attached scenes and plotlines (populated later). Character cards now show real faction chips that link to faction pages.

Prompt: `prompts/03-factions.md`

**Status: done** — 2026-06-17

Followups:
- Faction-to-faction relationships (rivalries, alliances) not yet modelled. Add as a future slice.
- The member select on the faction page lists all characters with no search; replace with a searchable dropdown in Slice 8 polish when the cast grows large.

## Slice 2.7: Campaign current date + age auto-calculation + death date

Campaign date lives in `meta.json` and is shown in the topbar with day-of-week, a date picker, and ±1 day arrows. Character ages auto-compute from birthday and the campaign date. Dead characters' ages freeze at their death date. Date changes re-render the character grid and open character sheet without a reload.

Prompt: `prompts/02d-current-date.md`

**Status: done** — 2026-06-17

Visual polish (2.7.1): hid raw input, calendar SVG icon, day-of-week enlarged and centered.

Followups:
- Scenes will use `currentDate` for ordering/filtering in Slice 6.
- Plotline timeline will reference `currentDate` as a "now" marker in Slice 7.

## Slice 2.8: Relationship redesign + searchable dropdowns + alias-as-primary

Schema v3→v4: relationships migrated from `{type, closeness}` to `{structuralType, socialLabels[], platonic, romantic}`. Character schema gains `displayAliasIndex`. Combobox component for all character/faction pickers (searchable, alphabetized, keyboard-navigable). Relationship dialog rewritten: structural type, social labels checkboxes, platonic/romantic feelings; auto-paired reciprocal on structural save. Alias list gets primary-name checkbox. Deceased relationships sort last and freeze the edit button.

Prompt: `prompts/02e-relationships-and-dropdowns.md`

**Status: done** — 2026-06-18

## Slice 4: Relationship Web

Per character relationship view rendered with Cytoscape. Center node is the character. Connected nodes are linked characters. Each pair has two directional edges with labels (type and closeness from each side). Relationships are created and edited via the dialog added in Slice 2.5 — the web view only visualizes the edges already stored in `relationships.json`. Clicking any other node re-centers the web on that character. A "Character Sheet" button on the web view closes it and routes to the sheet.

**Status: done** — 2026-06-18

Notes: Cytoscape 3.34.0 vendored at `src/vendor/cytoscape.esm.min.js` (ESM .mjs build). Modal opened via "Web" button in the Relationships section header. Re-centering opens a new `openRelationshipWeb()` invocation and closes the old modal cleanly.

## Slice 4.1: Relationship Web 2-hop toggle

**Status: done** — 2026-06-18

"2nd-degree connections" checkbox in the web modal topbar. Toggles between 1-hop (center's direct rels only) and 2-hop (adds edges among the connected characters). 2-hop edges render at 55% opacity / 1px width. Toggle state persists within a session (module-level variable). Re-centering on a node preserves the current toggle state.

## Slice 5: Faction Map

Cytoscape graph view on the Factions tab showing every faction as a large node and every character as a small node connected to its factions. Multi faction characters naturally sit between their factions via the force layout. Click a character to go to their sheet. Click a faction to go to the faction page. Tune layout so labels do not overlap.

**Status: done** — 2026-06-18

List/Map toggle on the Factions overview (List default). Map lazy-loads Cytoscape via dynamic import. Factions are 80px colored nodes; characters are 28px owner-colored nodes connected by faction-colored edges. Deceased nodes dim to 45% opacity. Search filters both views. `knowsSupernatural: false` added to new characters (no migration; data import handles existing characters). `ownerColor` extracted to `src/js/util/owner-color.js` and shared with relationship web.

## Slice 5.5: Character sheet polish + persistent filter panel

**Status: done** — 2026-06-18

Eight improvements delivered:
1. `birthTime` removed from schema defaults and character sheet UI.
2. Death date row shows/hides dynamically on the deceased toggle.
3. Sun sign always visible in the main identity row; Moon / Rising / Place of birth moved behind "+ More astrological info" expander (auto-expanded when any field is set).
4. Aliases list gains two checkboxes per chip: "Display as primary name" (`displayAliasIndex`) and "Show as a.k.a." (`akaAliasIndices`). Character cards use `akaAliasIndices` for the a.k.a. line.
5. Languages card in the right column: combobox from `meta.knownLanguages`, "+ Add new language…" option writes back to meta, level dropdown (Broken / Accented / Native via `LANGUAGE_LEVELS`).
6. "Knows supernatural" checkbox added to the character sheet header controls.
7. Secrets card shows a placeholder note (secrets tracking deferred to a future slice).
8. Edit button on relationship rows no longer disabled for deceased characters — the row stays dimmed but the dialog opens normally.

Filter panel (Characters overview):
- Inline bar: search + owner toggles + "Clear filters" (shown only when any filter is non-default) + "Filter by ▾" button.
- Popover (below "Filter by ▾"): faction dropdown-chip, language dropdown-chip, supernatural 3-state cycle button, Show deceased toggle.
- Filter state persists via `localStorage` (key `oxford-filters-characters`).
- Factions overview filter bar now persists via `localStorage` (key `oxford-filters-factions`).

Followups:
- Language filter popover won't update its dropdown if new languages are added in the same session without a page reload (stale options). Refresh popover on re-open in a later pass.
- "Only show filled fields in read mode" on the character sheet is deferred to Slice 6.5.

## Slice 6: Secrets system

Secrets tab between Factions and Anomalies. Schema: `createSecret()`, `STATUS_TIERS` (6 tiers from Redacted to Yesterday's News), `computeStatus()` (auto from `knownToIds.length`, overridable), `statusSlug()`. New `src/data/secrets.json` seed. `main.js` `ENTITY_FILES` updated. Router + tab nav updated.

Overview: Active/Archived toggle, filter bar (search, owner dropdown-chip with optgroups for chars + factions, status toggle chips that turn their tier color when active), card grid. Cards show title, status chip, summary excerpt, owner names, known count, hidden count.

Secret page: title input, Archive/Delete controls, summary textarea, full body textarea, owner-characters picker, owner-factions picker, known-to-characters picker (adding here removes from hidden-from and vice versa), known-to-factions picker, hidden-from picker (constraint: can't overlap with known-to), character mentions picker, auto-computed status chip with optional override dropdown, tags chips, notes textarea.

Character sheet: "Secrets known" and "Hidden from me" cards in the right column (replace the old placeholder card). Each renders a linked list of relevant active secrets.

Characters filter sidebar: "Knows secret" facet (dropdown-chip, OR semantics, filters by `knownToIds`).

`cards.secrets` removed from `createCharacter()` schema default.

**Status: done** — 2026-06-18

Followups:
- Known-to and hidden-from pickers don't exclude characters already in the opposite list from the dropdown (they enforce the constraint on add, but the select still shows them as options). Tighten the exclusion function in a later pass.
- Character sheet secrets cards are static on mount; adding a secret while the sheet is open won't reflect until re-navigation.
- Secret counts on the overview card may drift if secrets are edited and the overview isn't re-mounted.

## Slice 7: Scenes CRUD

Scenes tab with card preview grid and per scene page. Fields: title, summary, body, status (draft, in progress, complete), **story beats** (what needs to happen, free text or list), **goals** (what we want out of this scene), attached plotlines (chosen later), characters with role per character (Key Actor, Observer, Background). Character add control uses a smart dropdown: if the scene has a faction attached, prioritize that faction's members. Otherwise prioritize characters who already know other characters in the scene (via the relationships graph).

Filter bar from `filters.js`:

- Text search across title, summary, body, story beats, goals
- Included characters facet, multi select (matches any character attached in any role)
- Included actors facet, multi select with Bree, Jack, Nicole, Caiden, NPC (matches scenes containing any character owned by that actor)
- Status facet
- Attached plotline facet (populated in slice 8)

## Slice 8: Plotlines with timeline

Plotlines tab with sub-tab per plotline. Each plotline shows a vis-timeline. Scenes and standalone events sit on the timeline and can be dragged to reorder. Each item has a complete toggle. A progress indicator at the top of the plotline fills as items complete. Scenes on the timeline are click through to the scene page.

## Slice 9: Cross linking pass

Audit every entity view. Every character name, faction name, scene title, plotline title, and anomaly title appearing anywhere in the app must be a clickable link to that entity's page. Add a global search box in the header. Add breadcrumb or back navigation.

## Slice 10: Anomalies tab

Foley's Book of Anomalies. Overview cards plus per anomaly page. Fields: name, Primary P with level, Secondary Ps with levels (multiple), lore, related characters, related scenes. Sub-tabs across the top organized by P. Schema lets us add more Ps later without code changes.

## Slice 11: Export, import, polish, search

Export the full data folder as a single zipped bundle. Import the same. Global search box that finds across characters, scenes, plotlines, factions, anomalies. Visual polish pass: typography, spacing, color tuning, diagram label tuning.

## Followups bucket

Anything discovered mid slice that does not belong to the current slice lands here. Move items into a slice when you are ready to do them.
