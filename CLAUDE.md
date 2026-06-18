# Oxford Tracker

A local desktop app (Electron) for tracking characters, scenes, plotlines, factions, and anomalies in the Oxford RP setting. Single user, runs in its own window, stores data as JSON files in a `user-data/` folder next to the app.

## Stack

Electron shell wrapping vanilla HTML, CSS, and JavaScript. No build step for the renderer, no bundler, no framework. Libraries pulled in via CDN or vendored into `src/vendor/`:

- **Cytoscape.js** for the relationship web and faction graph
- **vis-timeline** for plotline timelines

The main process (`main.js`) is plain Node. The preload (`preload.js`) exposes a narrow `window.oxford` API to the renderer. Do not add React, Vue, Tailwind, or any other dependency without being asked.

## File layout

```
oxford-tracker/
  CLAUDE.md           you are here
  ROADMAP.md          slice list, current status, what is next
  package.json        Electron entry, scripts, build config
  main.js             Electron main process (window + IPC handlers)
  preload.js          secure bridge to renderer
  prompts/            one .md per slice, fed to you as the work order
  src/
    index.html        single page, tab shell
    css/              one file per major area
    js/               one module per major area, plus storage.js and app.js
    data/             seed JSON shipped with the repo
  user-data/          gitignored, where the running app writes
  .gitignore
```

## How work happens

Work is delivered in slices. Each slice has a prompt file in `prompts/` describing exactly what to build. You will be asked to execute one slice at a time.

**You do not rewrite the app on every slice.** without extended thinking: read only the relevant files, add or modify only what the current prompt asks for, leave everything else alone. If you think an earlier file needs refactoring to support the new slice, say so first and wait for confirmation. Do not silently restructure.



When a slice is done, append a short note to ROADMAP.md under that slice marking it complete and listing any followups discovered along the way.

Claude Code cannot see the running app. Do not attempt screenshots, browser automation, or visual verification. Trust the code. The user will report back if something looks wrong.

## Data model rules

All persistent data lives in JSON files inside the user's chosen data folder. The app reads them on load and writes them on change. File layout inside the data folder:

```
characters.json     array of character objects
factions.json       array of faction objects
scenes.json         array of scene objects
plotlines.json      array of plotline objects
relationships.json  array of directed edges
anomalies.json      array of anomaly objects
meta.json           schema version, last opened, etc
```

Every entity has a stable `id` (use `crypto.randomUUID()`). Cross references use ids, never names. When the user changes a name the id does not change, so all links survive.

Relationships are stored as directed edges. Each edge is `{ id, from, to, nature, notes }`. When the user adds a relationship from A to B, the app prompts for the reciprocal nature and writes both edges. Editing one edge does not auto edit the other, since asymmetry is the whole point (A has a crush, B sees a friend).

## Migration policy

This project is in development. The `user-data/` folder holds throwaway test
data. Schema changes do NOT require migration code. New fields apply only to
freshly-created entities; existing entities will be replaced wholesale by the
final data import after all slices are complete.

If a slice prompt seems to need migration logic, skip it. The final import
will provide all data in the latest schema shape.

## UI rules

- Tabs across the top: Characters, Scenes, Plotlines, Factions, Anomalies. Plus a Settings affordance for opening or switching the data folder.
- Every reference to another entity is a clickable link that routes to that entity's page. Character names in scene cards, plotline names on scene pages, faction names on character cards, all of it.
- Diagrams must not overlap labels. Use Cytoscape's built in layout options (`cose`, `cose-bilkent` if vendored, or `breadthfirst`) and tune `nodeRepulsion` and `idealEdgeLength` until labels breathe.
- Color coding for character ownership uses CSS variables defined in `css/theme.css`. Owners and their colors:

- Bree: green
- Jack: yellow
- Nicole: blue
- Caiden: red
- NPC: neutral grey

Combinations get a split left border via linear gradient (two colors for two owners, evenly divided).

## Faction graph (the Venn replacement)

The user chose a clustered graph instead of a real Venn. Factions render as large labeled nodes. Characters render as small nodes connected to every faction they belong to. Characters with multi faction membership sit between their factions naturally via the force layout. Do not call this a Venn in code or UI copy. Call it the Faction Map.

## Save behavior

Every mutation writes the affected JSON file immediately. No save button. The renderer calls `storage.save(entityType, data)` which uses the `window.oxford` bridge to invoke a Node `fs.writeFile` in the main process. If a write fails, surface a banner at the top of the app.

The data folder is created and seeded automatically on first launch. There is no folder picker. In development the folder is `<repo>/user-data/`. In a packaged build it sits next to the installed exe.

## Coding conventions

- ES modules. `<script type="module" src="js/app.js">` in index.html, everything else imported from there.
- No semicolons omitted. Use them.
- Two space indent.
- Function and variable names in camelCase, classes in PascalCase, constants in UPPER_SNAKE.
- Keep functions small. If a file passes 300 lines, split it.
- DOM access goes through small helpers in `js/dom.js`. Do not sprinkle `document.querySelector` everywhere.

## Edit style

Always prefer surgical edits via str_replace over file rewrites. Even when several
changes are needed in one file, make them as separate str_replace operations rather
than writing the file from scratch. A full file rewrite is only acceptable when:

- A new file is being created
- The file's entire structure is being reorganized (rare)
- More than 70% of the existing file would be changed anyway

Otherwise: find the relevant block, change just that block, leave everything else.
This preserves comments, formatting, and any user edits that may have been made
between slices.

## Git

The repo lives on GitHub. Do not commit anything in `user-data/`. The seed data in `src/data/` is committed. Do not run git commands unless asked.

## When in doubt

Ask before doing. Smaller diffs beat clever ones. If the user's prompt is ambiguous, list your reading and pick one, do not invent requirements.
