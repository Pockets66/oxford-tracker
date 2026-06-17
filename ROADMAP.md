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

## Slice 3: Factions CRUD

Factions tab with overview cards and per faction page. Add, edit, delete. Fields: name, agenda, leader (character link), members (character links), attached scenes and plotlines (populated later). Character cards now show real faction chips that link to faction pages.

Prompt: `prompts/03-factions.md`

## Slice 4: Relationship Web

Per character relationship view rendered with Cytoscape. Center node is the character. Connected nodes are linked characters. Each pair has two directional edges with labels (nature of the relationship from each side). Adding a relationship from A to B prompts for the reciprocal label and writes both edges. Clicking any other node re-centers the web on that character. A "Character Sheet" button on the web view closes it and routes to the sheet.

## Slice 5: Faction Map

Cytoscape graph view on the Factions tab showing every faction as a large node and every character as a small node connected to its factions. Multi faction characters naturally sit between their factions via the force layout. Click a character to go to their sheet. Click a faction to go to the faction page. Tune layout so labels do not overlap.

## Slice 6: Scenes CRUD

Scenes tab with card preview grid and per scene page. Fields: title, summary, body, status (draft, in progress, complete), **story beats** (what needs to happen, free text or list), **goals** (what we want out of this scene), attached plotlines (chosen later), characters with role per character (Key Actor, Observer, Background). Character add control uses a smart dropdown: if the scene has a faction attached, prioritize that faction's members. Otherwise prioritize characters who already know other characters in the scene (via the relationships graph).

Filter bar from `filters.js`:

- Text search across title, summary, body, story beats, goals
- Included characters facet, multi select (matches any character attached in any role)
- Included actors facet, multi select with Bree, Jack, Nicole, Caiden, NPC (matches scenes containing any character owned by that actor)
- Status facet
- Attached plotline facet (populated in slice 7)

## Slice 7: Plotlines with timeline

Plotlines tab with sub-tab per plotline. Each plotline shows a vis-timeline. Scenes and standalone events sit on the timeline and can be dragged to reorder. Each item has a complete toggle. A progress indicator at the top of the plotline fills as items complete. Scenes on the timeline are click through to the scene page.

## Slice 8: Cross linking pass

Audit every entity view. Every character name, faction name, scene title, plotline title, and anomaly title appearing anywhere in the app must be a clickable link to that entity's page. Add a global search box in the header. Add breadcrumb or back navigation.

## Slice 9: Anomalies tab

Foley's Book of Anomalies. Overview cards plus per anomaly page. Fields: name, Primary P with level, Secondary Ps with levels (multiple), lore, related characters, related scenes. Sub-tabs across the top organized by P. Schema lets us add more Ps later without code changes.

## Slice 10: Export, import, polish, search

Export the full data folder as a single zipped bundle. Import the same. Global search box that finds across characters, scenes, plotlines, factions, anomalies. Visual polish pass: typography, spacing, color tuning, diagram label tuning.

## Followups bucket

Anything discovered mid slice that does not belong to the current slice lands here. Move items into a slice when you are ready to do them.
