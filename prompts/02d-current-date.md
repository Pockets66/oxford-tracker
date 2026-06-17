# Slice 2.7: Campaign current date + age auto-calculation + death date

Read CLAUDE.md and ROADMAP.md. Slice 2.6 must be done and committed.

## Files to read first

Read ONLY these files before writing. Do not browse other files in the project; this slice is well-scoped and you have everything you need from this list:

- `src/js/schema.js`
- `src/js/app.js`
- `src/js/views/character-sheet.js`
- `src/js/views/characters.js`
- `src/css/theme.css`
- `src/css/layout.css`
- `src/index.html`
- `ROADMAP.md`

That is everything. Do not open the relationship dialog, factions views, or any CSS file not listed.

## Goal

1. A campaign "current date" lives in `meta.json` and is shown in the topbar with a date picker, day-of-week display, and ±1 day arrows.
2. Character ages auto-compute from birthday and the current date.
3. Characters can have a death date. Dead characters' ages freeze at the death date.
4. The current date updates app state and re-renders relevant views without a page reload.

## Schema changes

Update `src/js/schema.js`.

**meta.json** gains a field. The schema for meta is now:

```js
{
  schemaVersion: 3,
  currentDate: string | null   // "YYYY-MM-DD", null means unset
}
```

If `currentDate` is missing on load, default it to today's real date (use `new Date().toISOString().slice(0,10)`) and write meta back.

**Character schema** gains one field:

```js
{
  // ... existing fields ...
  deathDate: string | null   // "YYYY-MM-DD", null means not dead (or dead but date unknown)
}
```

No schemaVersion bump needed for adding a single nullable field. Just initialize `deathDate: null` for any character missing it on load. (If you do want to bump, that's fine, bump to 4 and run a no-op migration.)

## Age computation helper

Add to `src/js/schema.js`:

```js
export function computeAge(character, currentDateIso) {
  // Returns integer age, or null if cannot compute.
  // If no birthday, return null.
  // The "as-of" date is the character's deathDate if set, else currentDateIso.
  // Age is integer years from birthday to that as-of date.
  // Handles leap years correctly by checking month/day comparison.
}
```

The `dayOfWeek(isoDate)` helper goes in a new module `src/js/dates.js`:

```js
export function dayOfWeek(isoDate) {
  // Returns "Monday", "Tuesday", etc, accurate for any year.
  // Parse the date as local (not UTC) to avoid off-by-one for timezones.
}

export function addDays(isoDate, n) {
  // Returns a new ISO date string with n days added (can be negative).
}

export function formatLongDate(isoDate) {
  // Returns "17 June 2026" style.
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
```

JavaScript's built-in Date object handles all of this correctly when you parse `YYYY-MM-DD` as `new Date(year, monthIndex, day)`. Do NOT use `new Date(isoString)` directly; that parses as UTC and can shift the date by a day for users in negative timezones. Always split the string and construct from parts.

## Topbar UI

Modify `src/index.html` to add a current-date widget. It goes between the tabs and the settings gear. Markup roughly:

```html
<div id="current-date-widget" class="current-date-widget">
  <button id="date-prev" class="date-nudge" title="Previous day">‹</button>
  <div class="date-display">
    <span id="date-dow" class="date-dow">Wednesday</span>
    <input type="date" id="date-picker" class="date-picker" />
    <span id="date-long" class="date-long">17 June 2026</span>
  </div>
  <button id="date-next" class="date-nudge" title="Next day">›</button>
</div>
```

The date picker input shows the raw `YYYY-MM-DD` value but is styled small. The long-form display sits beside or below it (your choice on layout, lean clean). Day of week sits above or to the left, in EB Garamond italic, slightly muted but readable.

Wire it up in `src/js/app.js`:

- On boot, after loading meta, set the widget to `meta.currentDate`. Compute and display day of week and long form.
- Date picker `change` event → update meta.currentDate, save meta, dispatch a `current-date-change` event on window with the new date.
- Prev arrow → addDays(-1), same flow
- Next arrow → addDays(+1), same flow

Views that need to re-render on date change subscribe to `current-date-change`. For this slice, the character sheet (if currently open) and the characters overview cards both need to re-render age columns. Wire those subscriptions in their respective view modules.

## Character sheet changes

In `character-sheet.js`:

**Age field becomes mode-aware.**

- If `character.birthday` is set: age field is **read-only**, displayed as computed value. Style it as muted text or a disabled input. Add small text underneath: "Auto-calculated from birthday". If `character.deathDate` is also set, the muted text reads "Frozen at death".
- If `character.birthday` is NOT set: age field is editable as before, plain number input. (User can manually enter age for characters where birthday is unknown.)

When the user sets a birthday, the manually-entered age is discarded and replaced by computed. Show a brief notification or just silently swap; either is fine.

**Add a death date row.** Below the birthday row, a new row: a `<input type="date" id="death-date">` labeled "Death date". Only shown when `character.deceased === true`. When deceased toggle flips to true, the row appears (animate or not, doesn't matter). When deceased flips back to false, deathDate is cleared and the row hides.

Saving a death date triggers an age recomputation.

## Character card changes

In `characters.js`, the card rendering uses `computeAge(character, currentDate)` instead of reading `character.age` directly.

If age is null (no birthday and no manual age), show "Age: ?" or omit the field entirely (your call, lean omit for cleanness).

If character is deceased AND deathDate is set, show "Age at death: 24" instead of "Age: 24".

Subscribe to `current-date-change` and re-render the grid when it fires.

## CSS

Add styles for the current-date-widget to `theme.css` or a new small `src/css/topbar-date.css` (your call, lean adding to layout.css since the topbar is already styled there).

Visual target:
- Compact, sits comfortably in the topbar without crowding
- Day of week in EB Garamond italic, `--text-muted`
- Long-form date in EB Garamond regular, `--text`
- The native date input small, theme-styled (use the same pattern from slice 2.5 for date pickers), maybe hide the visible text of the native input and just use it as the click target behind the formatted display
- Arrow buttons: small, ghost style, `--text-muted` text color, `--accent` on hover
- The whole widget aligned center-vertical in the topbar

A clean layout pattern: stack day-of-week (small, top) above the date-picker + long-form (slightly larger, bottom), with the arrows flanking the whole stack.

## Files to create

- `src/js/dates.js`

## Files to touch

- `src/js/schema.js` (computeAge, deathDate init)
- `src/js/app.js` (load currentDate from meta, wire date widget, dispatch event)
- `src/js/views/character-sheet.js` (age mode-aware, deathDate row, subscribe to date change)
- `src/js/views/characters.js` (use computeAge, subscribe to date change)
- `src/index.html` (date widget markup in topbar)
- `src/css/layout.css` (widget styling)
- `ROADMAP.md` (add Slice 2.7 status: done)

## Out of scope

- Scenes with dates (will use currentDate when scenes exist, but no scenes yet)
- Plotline timeline integration (will reference currentDate in Slice 7)
- Birthday displayed on cards
- Any change to factions, relationships, anomalies

## Definition of done

- Topbar shows current date with day of week, arrows on either side
- Date picker changes the campaign date and persists across app restarts
- Arrows nudge ±1 day
- Day of week is correct for any date you pick (e.g. set to 1969-07-20, should show "Sunday")
- Character ages on cards auto-update when current date changes, no reload needed
- Character sheet age field is read-only when birthday is set, editable when not
- Setting deceased = true reveals the death date input
- Setting a death date freezes the character's age at that date
- "Age at death" shown on cards for deceased characters with death date
- ROADMAP.md updated
