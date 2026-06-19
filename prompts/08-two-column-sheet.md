# Slice 8: Two-column printed sheet with per-card inline editing

Read CLAUDE.md and ROADMAP.md. Slice 7.5 (plotlines) must be done. **Large slice, three checkpoints.** Prefer surgical edits in existing files. Use str_replace for targeted changes; do not rewrite entire files.

**Migration policy:** No migration. Throwaway data.

## Files to read first

Read ONLY these. Do not browse the rest of the project.

- `src/js/views/character-sheet.js`
- `src/js/schema.js`
- `src/css/printed-sheet.css`
- `src/css/sheet.css`
- `ROADMAP.md`

The combobox, dialog patterns, and dates module are unchanged; you do not need to re-read them.

## Goal

Replace the current single-column printed view + giant edit modal with a two-column card layout where each card has its own pencil icon and edits inline. Also add a button row directly below the main identity card with three placeholder buttons (Relationship Web works, Faction Web and Personal Timeline are placeholders wired in Slice 9).

## Schema changes

Surgical edits in `src/js/schema.js`:

1. **Languages:** find `LANGUAGE_LEVELS` and change to `["Broken", "Accented", "Advanced", "Native"]` (insert "Advanced" between Accented and Native).

2. **Default native language:** in `createCharacter()`, change `languages: []` to `languages: [{ name: "English", level: "Native" }]`.

That's it for schema.

## New layout

Two columns. Left column ~60% width, right column ~40%. Stacks on viewports below 1100px.

### Left column (main cards, wider)

1. **Identity card.** First, Middle, Last name; Previous names; Aliases (with the existing primary/a.k.a. checkboxes); DOB (date picker); Current age (auto-computed, read-only); Place of birth; Deceased checkbox; Date of death (only when deceased is checked).
2. **Button row** (not a card, just a row of buttons immediately below the Identity card): three small buttons styled to match the Oxford aesthetic. See "Button row" below.
3. **Summary card.** Single textarea, shorter (3-4 rows). Header label "Summary". This is the text that appears on the small overview cards.
4. **Background card.** Single textarea, taller (10+ rows, autoresize). Header label "Background".

### Right column (secondary cards, narrower, stacked top to bottom)

1. **Zodiac card.** Sun (auto-computed, read-only display). Below: a small `+ More astrological info` expander that reveals moon, rising, time of birth, place of birth (if you want time-of-birth here; existing schema already has these fields). Only filled sub-fields render in read-only mode. In edit mode all fields are visible inside the expanded section.
2. **Languages card.** List of languages with level. Native language(s) appear first (sorted by level priority: Native > Advanced > Accented > Broken; alphabetical within tier). Add/remove/edit inline.
3. **Skills card.** Free text (existing `character.cards.skills`).
4. **Factions and Relationships card.** Factions chips at the top. Below them, an alphabetized list of relationships (existing rendering, preserved). This combines what used to be two sections.
5. **Current card.** Current plotlines involving the character at the top, then secrets known by the character, then secrets being kept from the character. Three small subsections within one card.

### Card structure

Every card uses the same DOM shape:

```html
<section class="sheet-card" data-card="identity">
  <header class="sheet-card-header">
    <h3 class="sheet-card-title">Identity</h3>
    <button class="sheet-card-edit" title="Edit identity">
      <svg>…pencil…</svg>
    </button>
  </header>
  <div class="sheet-card-body">
    <!-- read-only view OR edit form, toggled by data-card-mode attribute -->
  </div>
</section>
```

The pencil icon (reuse the SVG from the old edit button) appears on hover at the top right of each card. Clicking it:

- Switches the card's body from read-only render to edit-form render
- Adds Save and Cancel buttons at the bottom of the card body
- "Save" commits changes (the existing debounced-save still applies, so by the time the user clicks Save the data is already persisted; Save just returns to read-only)
- "Cancel" restores the card to read-only WITHOUT discarding data (since changes already debounced-saved). Actually, this is a UX problem — see "Editing model" below.

### Editing model

The current sheet has debounced autosave. With per-card editing, two reasonable patterns:

**Pattern A — autosave + close:** changes apply live as you type (debounced). Save/Close button just dismisses the editor. No Cancel possible (changes already saved). This matches current behavior.

**Pattern B — staged + commit:** changes are held in local state until Save. Cancel discards. More work, more code, but matches user expectations of "edit / cancel."

Lean **Pattern A** for this slice. Simpler. If the user wants real cancel later we add it as Pattern B in a follow-up. The "Save" button label is therefore "Done" rather than "Save" (since saving already happened). No Cancel button. Just a "Done" button or a Close X.

Use "Done" as the label. Clicking it returns the card to read-only mode.

Pressing Escape while editing a card also returns it to read-only mode.

Clicking the pencil on another card while one is open: close the current edit mode, open the new one. Only one card in edit mode at a time.

### Read-only rendering rules

Same as the current printed view: only filled fields render. Empty cards render with a muted placeholder ("Click the pencil to add…") so the card structure stays visible and the user knows it's there.

## Button row

Directly below the Identity card, before the Summary card:

```html
<div class="sheet-button-row">
  <button class="sheet-action-btn" data-action="relationship-web">
    <svg>…web icon…</svg>
    <span>Relationships</span>
  </button>
  <button class="sheet-action-btn" data-action="faction-web" disabled title="Coming in Slice 9">
    <svg>…network icon…</svg>
    <span>Factions</span>
  </button>
  <button class="sheet-action-btn" data-action="personal-timeline" disabled title="Coming in Slice 9">
    <svg>…clock or scroll icon…</svg>
    <span>Timeline</span>
  </button>
</div>
```

Styled to match the Oxford aesthetic. NOT emojis. Use inline SVG icons (simple line-art). Suggested icons:

- **Relationships**: a small node-and-line graph (3 dots connected by lines). Reuse a Cytoscape-ish icon.
  ```svg
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="6" cy="12" r="2.5"/>
    <circle cx="18" cy="6" r="2.5"/>
    <circle cx="18" cy="18" r="2.5"/>
    <line x1="8" y1="11" x2="16" y2="7"/>
    <line x1="8" y1="13" x2="16" y2="17"/>
  </svg>
  ```
- **Factions**: a hub-and-spokes (one center node with 5-6 satellites).
  ```svg
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="12" cy="12" r="3"/>
    <circle cx="4" cy="6" r="1.5"/>
    <circle cx="20" cy="6" r="1.5"/>
    <circle cx="4" cy="18" r="1.5"/>
    <circle cx="20" cy="18" r="1.5"/>
    <line x1="10" y1="11" x2="5" y2="7"/>
    <line x1="14" y1="11" x2="19" y2="7"/>
    <line x1="10" y1="13" x2="5" y2="17"/>
    <line x1="14" y1="13" x2="19" y2="17"/>
  </svg>
  ```
- **Timeline**: a horizontal line with three small markers.
  ```svg
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <circle cx="7" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="17" cy="12" r="1.5" fill="currentColor"/>
  </svg>
  ```

Button styling: `--bg-surface` background, `--border` 1px border, sharp corners, EB Garamond italic for the label, `--text-muted` color, gold border + text on hover. Disabled buttons are 40% opacity and not clickable.

The Relationships button wires to the existing `openRelationshipWeb()` function (find where it's currently wired and move that handler to this button).

## Old code to remove

- The full-screen edit modal that wraps the existing editor. Delete the modal markup, the openCharacterEditor function, the modal close handlers. The pencil at the top-right of the page goes away (each card has its own pencil now).
- The "Edit" button on the printed-sheet topbar. The topbar keeps the back link only.
- The single-column section rendering. Replace with the two-column card grid.

## Checkpoint structure

### Checkpoint 1 — Layout shell + read-only rendering

- Schema edits (Advanced, English default)
- Build the two-column card layout in character-sheet.js. All cards render in read-only mode. No edit functionality yet, no pencil icons functional, no edit forms.
- New CSS for the layout in `src/css/sheet.css` (replace the existing single-column rules; surgical where possible) and `src/css/printed-sheet.css` (update card-level styles).
- Old edit modal code removed.
- Button row rendered below Identity, with the Relationships button wired to the existing handler. Other two buttons disabled.
- **STOP. Commit. User tests.**

### Checkpoint 2 — Per-card editing

- Add the pencil icon to each card header (visible on hover).
- Clicking the pencil swaps the card body from read-only to edit form, with a "Done" button at the bottom.
- Edit forms reuse the existing field implementations (combobox for languages, name inputs, textareas, etc.). Each card has its own focused form covering only that card's data.
- Debounced autosave continues to work (already in place).
- Escape closes the open card. Opening a new card closes the previous.
- **STOP. Commit. User tests.**

### Checkpoint 3 — Polish + zodiac expander + native language sorting

- Zodiac card: sun read-only; "+ More astrological info" expander reveals moon, rising, time of birth, place of birth (in edit mode; in read-only mode only the filled sub-fields appear, smaller font under the sun).
- Languages card: native language(s) appear first when displayed in read-only mode, sorted by tier (Native > Advanced > Accented > Broken), alphabetical within tier.
- Current card: three subsections (plotlines, secrets known, hidden from me). Each subsection has a small label. Empty subsections show nothing (no placeholder).
- Final visual pass: card spacing, hover states, edit mode transitions.
- **STOP. Done. Update ROADMAP.**

## Files to touch

- `src/js/schema.js` — surgical (LANGUAGE_LEVELS, default languages)
- `src/js/views/character-sheet.js` — substantial rewrite of the render layer, but the data layer (load/save/debounce) is preserved. Lean: extract small `renderCardX(character, ...)` functions, one per card. Each takes a `mode: "read" | "edit"` argument.
- `src/css/printed-sheet.css` — restructured for two-column card layout
- `src/css/sheet.css` — most of its rules now power the in-card edit forms; some may be removable
- `ROADMAP.md`

## Files NOT to touch

- All view files for factions, scenes, plotlines, secrets, characters list
- The relationship-dialog
- The combobox
- The router
- app.js
- main.js
- preload.js
- storage.js

## Out of scope

- Faction Web modal (Slice 9)
- Personal Timeline modal (Slice 9)
- Global Timeline tab (Slice 10)
- Cancel/discard editing (Pattern B in editing model)
- Relations rework

## Definition of done

- Languages have 4 levels: Broken, Accented, Advanced, Native
- New characters default to English (Native)
- Character page renders as two columns of cards as specified
- Each card has a pencil that opens an inline edit form
- "Done" button or Escape returns the card to read-only
- Only one card can be in edit mode at a time
- Button row exists below Identity with three buttons (Relationships works; others disabled)
- Old edit modal is gone, top-right pencil is gone
- ROADMAP.md updated with all three checkpoints
