# Slice 2.8: Relationship redesign + searchable dropdowns + alias-as-primary

Read CLAUDE.md and ROADMAP.md. Slice 2.7 and 2.7.1 must be done.

**Medium effort.** This slice touches multiple files but each change is focused. Use surgical edits where possible.

## Files to read first

- `src/js/schema.js`
- `src/js/views/relationship-dialog.js`
- `src/js/views/character-sheet.js`
- `src/js/views/faction-page.js`
- `src/css/sheet.css`
- `src/css/dialog.css`
- `ROADMAP.md`

Do not read other files unless you need to wire up something.

## Goal

Four changes bundled into one slice:

1. **Alias-as-primary checkbox** on the character sheet. When checked next to an alias, that alias becomes the displayName everywhere.
2. **Alphabetized, searchable dropdowns** wherever the user picks a character (relationship dialog, faction leader, faction member picker, character sheet's "add faction" select).
3. **Multi-label relationships** with separate structural type, social labels (plural), platonic feeling, romantic feeling. Replaces the single `type` + `closeness` model.
4. **Deceased relationships freeze and sort last** on the character's relationship list, displayed greyed, not editable.

---

## 1. Alias-as-primary

### Schema

Add one field to the character schema in `src/js/schema.js`:

```js
displayAliasIndex: number | null   // index into the aliases array, or null to use the real name
```

In `createCharacter()`, default to `null`.

In the migration (bump schemaVersion to 4 with a no-op pass for existing characters; just `if (!("displayAliasIndex" in c)) c.displayAliasIndex = null`).

Update `displayName()`:

```js
export function displayName(character) {
  if (character.displayAliasIndex != null && character.aliases?.[character.displayAliasIndex]) {
    return character.aliases[character.displayAliasIndex];
  }
  const parts = [character.firstName, character.middleName, character.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (character.aliases?.length) return character.aliases[0];
  return "(unnamed)";
}
```

### UI in the aliases list

In the character sheet's aliases editor (the `makeNameList` helper in `character-sheet.js`), add a tiny checkbox next to each alias chip. Label/tooltip: "Display as primary name". Checking one unchecks any other (radio behavior, but rendered as checkbox per the user's spec). Persists via `displayAliasIndex` on the character. Trigger a debounced save and re-render the sheet header so the name updates live.

---

## 2. Searchable, alphabetized dropdowns

Create a small reusable combobox in `src/js/components/combobox.js`. The signature:

```js
// Returns a DOM element. Calls onChange(value) when the user picks an item.
export function createCombobox({ items, value, placeholder, onChange, onSearch }) {
  // items: [{ value: string, label: string }]
  // value: currently selected value, or "" for none
  // placeholder: shown when empty
  // onChange: called with the picked value
  // onSearch: optional, called as the user types so the caller can refresh items dynamically
}
```

Behavior:
- Looks like a styled `<input type="text">` with a small chevron icon on the right
- Click or focus opens a dropdown panel below it
- Typing filters the list in realtime (case-insensitive, matches anywhere in label)
- Up/Down arrow keys navigate options, Enter picks, Esc closes
- Click an option to pick
- Selecting clears the input and shows the picked label as the "value"
- Click outside to close
- Empty filter shows all items, alphabetized by label

Style it to match the theme: `--bg-surface` background, `--border` 1px border, `--gold` focus ring (same as the global form input styling). Dropdown panel uses `--bg-raised` background with `--border` border. Hovered/keyboard-selected item gets `--accent-soft` background. Max height ~240px with custom-themed scrollbar (already global).

### Where to swap in the combobox

Replace existing native `<select>` elements at these four sites:

1. **`relationship-dialog.js`** — the "Other character" picker. Items: all characters except the current one, sorted alphabetically by displayName, label is displayName, value is character id.

2. **`character-sheet.js`** — the "Add faction…" select. Items: factions the character isn't already in, sorted alphabetically.

3. **`faction-page.js`** — the leader picker. Items: all characters, sorted alphabetically, plus a "— No leader —" option at the top.

4. **`faction-page.js`** — wherever members are picked or added. If there's an "add member" select, swap it. Items: characters not currently members, alphabetized.

The existing native `<select>` elsewhere (owner select, zodiac sign dropdowns) can stay as-is. Those have small fixed lists and don't benefit from search.

---

## 3. Multi-label relationships

### Schema change (v3 → v4 migration)

The relationship edge currently looks like:
```js
{ id, from, to, type, closeness, notes, createdAt, updatedAt }
```

New shape:
```js
{
  id, from, to,
  structuralType: string | null,    // one of: Parent, Child, Sibling, Spouse, Ex-spouse, Fiancé(e), Lover, Ex-lover, Mentor, Student, Other family
  socialLabels: string[],           // any of: Best friend, Friend, Rival, Enemy, Nemesis, Acquaintance, Colleague, Classmate, Roommate, Crush, Other
  platonic: string | null,          // one of the platonic feelings below
  romantic: string | null,          // one of the romantic feelings below
  notes, createdAt, updatedAt
}
```

### Constant lists

In `src/js/schema.js` add these exported constants:

```js
export const STRUCTURAL_TYPES = [
  "Parent", "Child", "Sibling",
  "Spouse", "Ex-spouse", "Fiancé(e)",
  "Lover", "Ex-lover",
  "Mentor", "Student",
  "Other family",
];

export const STRUCTURAL_PAIRS = {
  "Parent": "Child",
  "Child": "Parent",
  "Sibling": "Sibling",
  "Spouse": "Spouse",
  "Ex-spouse": "Ex-spouse",
  "Fiancé(e)": "Fiancé(e)",
  "Lover": "Lover",
  "Ex-lover": "Ex-lover",
  "Mentor": "Student",
  "Student": "Mentor",
  "Other family": "Other family",
};

export const SOCIAL_LABELS = [
  "Best friend", "Friend", "Rival", "Enemy", "Nemesis",
  "Acquaintance", "Colleague", "Classmate", "Roommate",
  "Crush", "Other",
];

export const PLATONIC_FEELINGS = [
  "Despises", "Dislikes", "Distrusts",
  "Estranged", "Distant", "Tolerates",
  "Acquaintance", "Likes", "Trusts",
  "Cares for", "Inseparable",
];

export const ROMANTIC_FEELINGS = [
  "Complicated", "Awkward", "Crush",
  "Dating", "Sweethearts", "In Love",
];
```

### Migration of existing relationship data

Add to schema.js: `migrateRelationships(relationships)`. Maps old shape to new:

For each edge:
- If it has the new shape (has `structuralType` key), skip.
- Otherwise read old `type` and `closeness`:
  - If old `type` is in STRUCTURAL_TYPES, set `structuralType: type`. Else set `structuralType: null`.
  - If old `type` is in SOCIAL_LABELS, set `socialLabels: [type]`. Else `socialLabels: []`.
  - Map old closeness:
    - "Inseparable" → `platonic: "Inseparable"`, and if structuralType is Lover/Spouse/Fiancé(e), also `romantic: "In Love"`
    - "Close" → `platonic: "Cares for"`
    - "Familiar" → `platonic: "Likes"`
    - "Acquaintance" → `platonic: "Acquaintance"`
    - "Distant" → `platonic: "Distant"`
    - "Estranged" → `platonic: "Estranged"`
  - `notes` carries over unchanged.
  - Delete old `type` and `closeness` keys.

Run this migration in `app.js` once on boot when schemaVersion < 4. Bump to 4.

### Relationship dialog rewrite

Restructure `relationship-dialog.js`:

Dialog fields:
- **Other character** (searchable combobox; alphabetized)
- **Structural type** (single-select dropdown of STRUCTURAL_TYPES plus blank)
- **Social labels** (multi-select checkboxes, all SOCIAL_LABELS shown, checked toggles inclusion)
- **Platonic feeling** (dropdown of PLATONIC_FEELINGS plus blank)
- **Romantic feeling** (dropdown of ROMANTIC_FEELINGS plus blank)
- **Notes** (textarea)
- Buttons: Save, Cancel, Delete (edit mode only)

### Auto-paired reciprocal

When saving a new edge from A → B:
- If `structuralType` is set: silently create the reciprocal edge B → A with `structuralType: STRUCTURAL_PAIRS[type]`. Do NOT copy social labels or feelings (those are asymmetric by design). Leave the reciprocal's feelings and social labels blank.
- If `structuralType` is null: just save the A → B edge, no reciprocal. (The user can manually add the reverse from B's sheet if they want.)
- If editing an existing edge that has a paired structural type and the user changes the structural type: update the reciprocal edge's structural type to match the new pair. Do not touch the reciprocal's feelings/social labels/notes.

Delete with reciprocal cleanup: same dialog pattern as before. "Also remove the reciprocal from {OtherName}?" checkbox defaults to yes when there is a paired reciprocal in the data.

### Relationship row display

On the character sheet, render each relationship row as:

```
{Other name as link} — {structuralType ? structuralType : ""}{socialLabels.length ? ", " + socialLabels.join(", ") : ""}
{platonic}{romantic ? " · " + romantic : ""}
[edit] [delete]
```

The "— " separator only appears if there is a structuralType OR socialLabels. The second line only appears if at least one of platonic or romantic is set. Empty feeling shows nothing (no "no romantic" filler text).

Example outputs:
- `Arthur Blackwood — Best friend, Colleague`  
  `Trusts · In Love`
- `Ruvarashe — Lover`  
  `Inseparable · In Love`
- `Brian — Colleague`  
  `Likes`
- `Drew — Mentor`  
  `Distant`  (no romantic line for Foley → Drew)
- `Someone — Acquaintance`  
  (no feeling line if both blank)

---

## 4. Deceased relationship freezing

In `character-sheet.js`, in the `renderRelationships` function:

- Sort the relationships list: living first (alphabetical by other-character displayName), then deceased (alphabetical by other-character displayName).
- For rows where the other character is deceased: add a class `rel-row--frozen` to the row. The edit and delete buttons are still present but the entire row gets `opacity: 0.55` and a tooltip on the row: "Frozen at this character's death." Edit button on a frozen row is disabled (greyed and unclickable). Delete button remains active (you can still remove the relationship entirely if you want).

In `sheet.css` add:

```css
.rel-row--frozen {
  opacity: 0.55;
}
.rel-row--frozen .btn-small:not(.btn-small--danger) {
  pointer-events: none;
  border-color: var(--border);
  color: var(--text-muted);
}
```

---

## Files to touch

- `src/js/schema.js` (constants, displayName update, schemaVersion 4, migrateRelationships, character displayAliasIndex)
- `src/js/app.js` (call migrateRelationships on boot, bump version)
- `src/js/views/relationship-dialog.js` (rewrite the form, auto-paired reciprocal, use combobox)
- `src/js/views/character-sheet.js` (render new row format, sort/freeze deceased, aliases checkbox UI, use combobox for add-faction)
- `src/js/views/faction-page.js` (use combobox for leader and members)
- `src/css/dialog.css` (style for new fields, multi-select checkboxes)
- `src/css/sheet.css` (frozen row style, alias checkbox)
- `src/css/components.css` NEW or add to dialog.css (combobox styles)
- `src/index.html` (link new CSS if you added components.css)
- `ROADMAP.md` (mark slice done)

### Files to create

- `src/js/components/combobox.js`

## Out of scope

- The relationship web visualization (Slice 4)
- Faction-to-faction relationships (future slice)
- Any change to scenes or plotlines or anomalies
- Sorting characters overview or factions overview by anything (separate concern)

## Definition of done

- Aliases list shows a checkbox per alias; checking one makes that alias the displayName everywhere (cards, sheet header, dropdowns, faction chips)
- All four character/faction dropdowns are searchable, alphabetized, keyboard-navigable
- Relationship dialog has the new five-field layout (other character, structural type, social labels multi-check, platonic, romantic)
- Saving a relationship with a structural type silently creates the reciprocal (Parent/Child mirrors, Sibling/Sibling, etc.)
- Existing relationship data migrated from `type` + `closeness` to the new shape, schemaVersion is 4
- Relationship rows on the sheet render as documented (two lines max, omit blanks)
- Deceased relationships sort to the bottom, render greyed, edit disabled
- ROADMAP.md updated
