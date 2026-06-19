# Slice 11: Relationships rework — bands, links, bulk dialog

Read CLAUDE.md and ROADMAP.md. Slice 10 (global timeline) must be done. **Large slice. Three checkpoints.** Surgical edits where the file already exists; new files where new logic lives.

**Migration policy:** No migration. Throwaway data. The schema change is destructive.

## Files to read first

ONLY these:

- `src/js/schema.js`
- `src/js/views/relationship-dialog.js`
- `src/js/views/character-sheet.js` (specifically the Factions and Relationships card section, after slice 8)
- `src/js/views/relationship-web.js`
- `src/js/components/combobox.js`
- `src/css/dialog.css`
- `src/css/sheet.css`
- `ROADMAP.md`

## Goal

Replace the current relationship model (`structuralType` + `socialLabels` + `platonic` + `romantic`) with a simpler, more expressive one: a single ordered **band** plus a multi-select **links** array. Add a bulk dialog that combines adding new relationships and editing existing ones, with reciprocal-from-them fields in the same dialog so you don't have to switch sheets. Add a read-only "Incoming relationships" panel showing who has this character in their list.

## Schema rework

In `src/js/schema.js`:

### New constants

```js
// Ordered worst → best. Index is the spectrum position.
export const RELATIONSHIP_BANDS = [
  "Nemesis",
  "Bad Blood",
  "Cold",
  "Neutral",
  "Friendly",
  "Close",
  "Inseparable",
];

// Flat list of structural ties / roles. Multi-select on a relationship.
export const RELATIONSHIP_LINKS = {
  Family: [
    "Parent", "Child", "Sibling", "Spouse", "ExSpouse", "Family",
  ],
  Romantic: [
    "Crush", "Dating", "Fiancé(e)", "SignificantOther",
    "Lover", "FormerLover", "ExPartner",
  ],
  Friendship: [
    "BestFriend", "Friend", "Acquaintance",
  ],
  Work: [
    "Colleague", "ExColleague", "Boss", "Subordinate",
    "Mentor", "Protégé", "Client", "Patron", "Dependent",
  ],
  Education: [
    "Professor", "Student", "Classmate", "Alumnus",
  ],
  Rivalry: [
    "Rival", "Adversary",
  ],
  Living: [
    "Roommate",
  ],
};

// Flat array for iteration / validation.
export const RELATIONSHIP_LINKS_FLAT = Object.values(RELATIONSHIP_LINKS).flat();
```

### New relationship shape

```js
export function createRelationship() {
  return {
    id: uuid(),
    from: "",                   // character id (the holder)
    to: "",                     // character id (the target)
    band: "Neutral",            // one of RELATIONSHIP_BANDS
    links: [],                  // subset of RELATIONSHIP_LINKS_FLAT
    notes: "",
    lastChangedDate: null,      // YYYY-MM-DD, optional, useful for timeline integration later
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}
```

### Deletions

- Remove all references to `structuralType`, `socialLabels`, `platonic`, `romantic`, the old `STRUCTURAL_TYPES`, `STRUCTURAL_PAIRS`, `SOCIAL_LABELS`, `PLATONIC_FEELINGS`, `ROMANTIC_FEELINGS` constants from `schema.js`.
- Remove the old `migrateRelationships` function entirely.

The existing relationships in user-data are wiped or rewritten by hand. Don't bother migrating.

## Files to create

- `src/js/views/relationship-bulk-dialog.js` — the new combined add+edit dialog
- `src/css/relationship-bulk.css`

## Files to touch

- `src/js/schema.js` — surgical (replace constants + createRelationship)
- `src/js/views/character-sheet.js` — surgical (replace the Factions and Relationships card's relationship rendering and the +Add button handler; add the Incoming relationships subsection)
- `src/js/views/relationship-web.js` — surgical (edge labels now built from band + links instead of structuralType/socialLabels; tooltip shows band + links + notes)
- `src/js/views/relationship-dialog.js` — DELETE this file. The bulk dialog replaces it.
- `src/css/sheet.css` — surgical (relationship row rendering uses band + links)
- `src/css/dialog.css` — surgical (any unused old rules can be cleaned)
- `src/index.html` — link `relationship-bulk.css`
- `ROADMAP.md`

## Checkpoint structure

### Checkpoint 1 — Schema + simple display

The smallest possible viable change. Get the data model swapped and the existing UI showing the new fields.

- Update `src/js/schema.js` with the new constants and `createRelationship`. Remove the old constants and migration.
- In `character-sheet.js`, update the relationship row rendering inside the Factions and Relationships card to display band + links + notes. The row format:
  ```
  {Other character name as link} — {comma-joined links} · {band}
  {notes if any, smaller italic muted}
  ```
  Sorting: living first (alphabetical), deceased last (alphabetical), within each group sort by `RELATIONSHIP_BANDS.indexOf(band)` descending (Inseparable at top, Nemesis at bottom).
- In `relationship-web.js`, update `edgeLabel()` to return `band` (instead of the old structural-or-social). Update `feelingsString()` to return `links.join(", ") + (notes ? " · " + notes : "")` for the tooltip.
- DELETE `src/js/views/relationship-dialog.js`.
- In `character-sheet.js`, the "+ Add relationship" button is temporarily a no-op (calls a stub) and the per-row edit pencil also stubbed. We'll wire the bulk dialog in checkpoint 2.
- **STOP. Commit. User tests.** Existing relationship data will look weird since old fields are gone, but new data created next checkpoint will be clean.

### Checkpoint 2 — Bulk dialog (add and edit modes)

Build `relationship-bulk-dialog.js`. Single file, both modes inside.

**API:**

```js
export function openRelationshipBulkDialog({
  mode,            // "add" | "edit"
  holderId,        // character id whose sheet this is
  appData,
  prefilledTargetIds, // optional, only for "edit" mode: which existing rels to start selected
  onClose,         // callback after save / cancel
}) { ... }
```

**Modal layout (vertical sections, top to bottom):**

1. **Header**: "Add relationships to {holder name}" or "Edit relationships of {holder name}"
2. **Candidate list** (Add mode): all characters except the holder and characters already with a relationship from holder. Filter row above: text search, faction dropdown, owner toggle chips (same as Characters overview). Each row has a checkbox + character name + small subtitle (factions). Selection count under the list: "5 selected of 38 visible."

   **Existing relationships list** (Edit mode): the holder's existing outgoing relationships. Each row has a checkbox + target name + current band + current links. Same filter row.

3. **Apply-to-selected section** — the form whose values get applied to all selected:
   - Band slider: 7-stop labeled control. Visually: a horizontal segmented bar with the 7 band labels. Click any segment to set. The currently-selected segment is highlighted with `--accent`. A label below the slider shows the picked band in larger EB Garamond italic.
   - Links: multi-select. Render as grouped checkboxes (one section per category from RELATIONSHIP_LINKS: Family, Romantic, Friendship, etc.). Checked = the link will be applied. Each category collapsible.
   - Notes: textarea.
   - In Add mode only: **"How they feel back"** section — a second band slider + links + notes for the reciprocal. Default values: band = same as the outgoing, links = empty, notes = empty. A checkbox "Skip reciprocal" hides this section entirely (no reciprocal written).
   - In Edit mode only: skip the "how they feel back" section. Bulk edit is one-directional.
   - **Apply button** (label: "Add N relationships" in add mode, "Update N relationships" in edit mode). Disabled if zero selected.
   - **Cancel button**.
   - In Edit mode: also a **Remove selected** button (red, with confirm).

**Logic:**

- Add mode: on Apply, create new relationship records for each selected target with the applied fields. If reciprocal not skipped, also create reverse records (to → from) with the reciprocal fields. Set `lastChangedDate` to `meta.currentDate`.
- Edit mode: on Apply, mutate selected existing relationships in place (band, links, notes overwritten; `lastChangedDate` set to current date; `updatedAt` bumped). The reciprocal side is NOT touched in bulk edit (would be surprising).
- Both modes call onClose with a summary of changes after save.

**Filtering:**

Inline filter row: text search, faction multi-select (using the existing combobox), owner toggle chips. Filter state is local to the dialog, doesn't persist. The "selection count" line at the bottom of the list reflects current filter visibility.

**Wire it up in character-sheet.js:**

- The "+ Add relationship" button on the Factions and Relationships card opens the dialog in "add" mode with `holderId = character.id`.
- The "Edit" pencil on the relationships subsection header (a separate small button next to "+ Add") opens the dialog in "edit" mode with all existing rels pre-loaded.
- The per-row inline edit pencil that existed before is removed. Editing happens through the bulk dialog now (in edit mode you can select just one row if you want).

**STOP. Commit. User tests.**

### Checkpoint 3 — Incoming relationships panel + polish

Add a read-only "Incoming relationships" subsection inside the Factions and Relationships card on the character sheet. Below the outgoing relationships list, separated by a thin gold-soft rule and a small label "Incoming":

- For each relationship where `relationship.to === character.id`, render a row:
  ```
  {Other character name as link} — {their links toward me} · {their band toward me}
  ```
- Same sort order as outgoing (deceased last, band-descending).
- Empty state: "No one has this character in their list."

This panel is read-only. To change how someone feels about this character, navigate to their sheet.

Visual polish:

- Style the band slider with sharp segments, oxford-blue active, muted-text labels. Keyboard support: left/right arrow keys move band selection when slider has focus.
- Style link checkboxes with the same gold-focus, no-rounded-corners pattern as other form controls.
- The bulk dialog should be large (about 80vw × 80vh) to comfortably hold the candidate list + the apply form side by side or stacked. Side-by-side at wide widths (>1100px), stacked below.

**STOP. Done. Update ROADMAP.**

## Display rules summary

**Character sheet relationship row:**

Row 1: `{Name} — {Link1, Link2, …} · {Band}`
Row 2 (if notes): `{notes}`

Band is rendered in EB Garamond italic, slightly tinted by valence:
- Nemesis, Bad Blood: `--danger` muted
- Cold: `--text-muted`
- Neutral: `--text-muted`
- Friendly, Close: `--success` muted
- Inseparable: `--gold`

Deceased rows: opacity 0.55, sort last.

**Relationship web edge label:** the band (e.g. "Friendly", "Inseparable").
**Relationship web edge tooltip:** `{Links comma-joined}{notes ? " · " + notes : ""}`. If no links and no notes: just the band again.

## Sorting and grouping on the card

Within the holder's outgoing relationships, group as:

1. Living, sorted by band descending (Inseparable first, then Close, etc.), within each band alphabetical by target name.
2. Deceased, same secondary sort.

Skip grouping headers; the visual sort is enough.

## Out of scope

- Numeric -100..+100 score (defer to a future slice if needed)
- Auto-decay or relationship dynamics
- Group/multi-character relationships (e.g. "these three are friends" as one entry)
- Secret relationships flag (the schema has notes; that's enough for now)
- Cross-character bulk relationship operations (e.g. "everyone in Faction X gets `Colleague + Friendly` toward each other")

## Definition of done

- Schema uses `band`, `links`, `notes`, `lastChangedDate` only. Old fields gone.
- Character sheet shows relationships in the new format, sorted by band within living-vs-deceased.
- Bulk dialog opens in Add and Edit modes from the character sheet.
- Add mode lets the user pick multiple targets with filters, apply band/links/notes once, and optionally specify reciprocal fields in the same dialog.
- Edit mode lets the user bulk-update existing relationships (band/links/notes) or remove them.
- The bulk dialog filters candidates by search, faction, and owner.
- Relationship web edges show the band as label and links+notes as tooltip.
- Incoming relationships panel on the character sheet shows who has this character in their list (read-only).
- ROADMAP.md updated with all three checkpoints.
