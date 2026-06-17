# Slice 2.7.1: Date widget visual polish (surgical)

**Low effort. Surgical edits only.** Use grep or str_replace to find specific blocks. Do not read whole files unless absolutely necessary. Do not read any file not listed below.

## Files to edit

- `src/index.html` — date widget markup block (search for `current-date-widget`)
- `src/css/layout.css` — date widget styles (search for `.date-dow`, `.date-display`, `.date-picker`, `.date-long`)
- `src/js/app.js` — one tiny addition (click handler for the new icon button)

## Three surgical changes

### Change 1: Hide the native date input visually, add a calendar icon button

In `src/index.html`, find the date widget block (contains `id="date-picker"`). Modify the markup so:

- The `<input type="date" id="date-picker">` stays in the DOM (the picker needs it) but becomes invisible.
- Add a button right before the long-form date span:
  ```html
  <button id="date-picker-btn" class="date-picker-btn" title="Pick a date" aria-label="Pick a date">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  </button>
  ```

### Change 2: Wire the icon button in app.js

Find where the date widget is wired in `src/js/app.js`. Add this handler next to the existing date-picker change handler:

```js
qs("#date-picker-btn").addEventListener("click", () => {
  const input = qs("#date-picker");
  if (input.showPicker) input.showPicker();
  else input.click();
});
```

### Change 3: CSS adjustments in layout.css

Find the existing `.date-dow`, `.date-long`, `.current-date-widget`, and `.date-display` rules.

**Update `.date-dow`:**
- `font-size: 1.15rem;`
- `color: var(--text);`
- Keep the EB Garamond italic
- `text-align: center;`

**Update the layout** so the widget shows two rows: day-of-week on top (centered), and picker-icon + long-form date below. Simplest approach: `.date-display` is a flex column. Wrap the picker icon and long-date in a sub-flex-row (you can add a new class like `.date-pick-row` with `display: flex; gap: 0.4rem; align-items: center; justify-content: center;`).

**Add `.date-picker-btn` styles:**
```css
.date-picker-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.15rem;
  display: inline-flex;
  align-items: center;
  transition: color 0.15s;
}
.date-picker-btn:hover { color: var(--accent); }
.date-picker-btn svg { display: block; }
```

**Hide the native input:**
```css
#date-picker {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
```

## Definition of done

- "17/07/2025" raw input is gone from the topbar
- Calendar SVG icon sits left of the long-form date
- Clicking the icon opens the native date picker
- Day of week is bigger and centered above the icon + long date row
- Arrows still work, no other regressions

ROADMAP.md: add one line under slice 2.7: "Visual polish (2.7.1): hid raw input, calendar SVG icon, day-of-week enlarged and centered."
