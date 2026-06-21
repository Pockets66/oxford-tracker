# Slice 14a.4: Full chart modal (structure + interpretations)

Read CLAUDE.md and ROADMAP.md. Slice 14a.3 must be done. **Small slice.** Surgical edits only.

**Migration policy:** No migration.

## Pre-slice setup (the user does this BEFORE running the slice)

The user will drop a pre-generated JSON file into the project at `src/js/data/astrology-interpretations.json`. The slice imports from this file. Do NOT generate interpretation content — it already exists in the JSON file.

If the JSON file is not present when the slice runs, stop and tell the user to drop it in first.

## Files to read first

ONLY these:

- `src/js/views/character-sheet.js`
- `src/js/util/astrology.js`
- `src/css/astrology.css` (may not exist; create if not)
- `src/index.html`
- `src/js/data/astrology-interpretations.json` (must exist; user provides)
- `ROADMAP.md`

## Goal

Build the modal that opens when the user clicks "View full chart" on the Zodiac card. Show a printed-style natal chart with planets, angles, houses, and aspects in structured tables. Each section includes interpretation text from the pre-generated JSON.

## New files

- `src/js/views/natal-chart-modal.js` (the modal)
- `src/css/astrology.css` (if not already created in 14a.3)

## Files to touch

- `src/js/views/character-sheet.js` — surgical: add a "View full chart" button to the Zodiac card's read-only mode (only render if `character.natalChart` is non-null); wire its click handler
- `src/index.html` — link `astrology.css`
- `ROADMAP.md`

## Add the "View full chart" button

In `src/js/views/character-sheet.js`, find the Zodiac card's read-only render. After the planet lines from 14a.3, add a small button:

```js
if (character.natalChart) {
  // ... existing summary rendering ...
  el("button", {
    class: "btn-small zodiac-view-full",
    onclick: async () => {
      const { openNatalChartModal } = await import("./natal-chart-modal.js");
      openNatalChartModal(character, appData);
    },
  }, ["View full chart"])
}
```

The button only renders when there's actual chart data to show.

## natal-chart-modal.js

The modal. At the top, import the interpretations JSON directly:

```js
import { el } from "../dom.js";
import { displayName } from "../schema.js";
import { formatLongDate } from "../dates.js";
import INTERPRETATIONS from "../data/astrology-interpretations.json" assert { type: "json" };
```

If the `assert { type: "json" }` syntax causes issues in the Electron environment, fall back to a fetch-based load at module level:

```js
let INTERPRETATIONS = null;
async function loadInterpretations() {
  if (INTERPRETATIONS) return INTERPRETATIONS;
  const resp = await fetch("./js/data/astrology-interpretations.json");
  INTERPRETATIONS = await resp.json();
  return INTERPRETATIONS;
}
```

Use whichever works.

### API

```js
export async function openNatalChartModal(character, appData) {
  await loadInterpretations(); // if using fetch
  // Build overlay + modal frame; mount the chart content; wire close handlers.
}

function closeChartModal() { ... }
```

### Modal frame

- Full-screen overlay with `--bg` at 90% opacity, z-index 2100
- Centered modal: 80vw × 80vh max, 1100px × 800px preferred; `--bg-surface` background; `--gold` 1px border
- Top bar inside modal:
  - Left: character displayName in EB Garamond 1.4rem
  - Right: Close X button
- Body: scrollable content area

### Body layout

Single column, centered, max-width 700px inside the body. Sections top to bottom:

**1. Header**
```
Natal Chart
{character displayName} · {formatLongDate(birthday)}
{birthTime if set} · {city name if set}
```
Centered. EB Garamond italic subtitle, muted color.

**2. Planets section**
Label "Planets" in small caps. Then a table:
```
☉ Sun         Libra        25° 48'    7th house
☽ Moon        Cancer       12° 18'    4th house
☿ Mercury     Scorpio       3° 06'    7th house
...
```
Use Unicode glyphs: ☉ Sun, ☽ Moon, ☿ Mercury, ♀ Venus, ♂ Mars, ♃ Jupiter, ♄ Saturn, ♅ Uranus, ♆ Neptune, ♇ Pluto.

Format degrees as "D° M'" where M is integer minutes (degree fractional × 60, rounded).

House column shown only if houses are computed (otherwise show "—").

Under each planet row, an italic interpretation line:
```js
INTERPRETATIONS.bodies?.[body]?.[sign] || ""
```

If the interpretation is empty, omit the line. (Most won't be empty since the JSON has all 120.)

**3. Angles section** (only if angles exist)
```
↑ Ascendant   Scorpio   14° 12'
↗ Midheaven   Leo       23° 42'
```
Same format. Interpretation lookups: `INTERPRETATIONS.angles?.ascendant?.[sign]` and `INTERPRETATIONS.angles?.midheaven?.[sign]`.

**4. Houses section** (only if houses exist)
```
House  Sign on cusp   Cusp
  1    Scorpio        14° 12'
  2    Sagittarius    18° 30'
  ...
```
Under each row, an interpretation: `INTERPRETATIONS.houses?.[number]`.

**5. Aspects section**
Label "Aspects" in small caps. Table:
```
☉ Sun ⚹ Moon       Sextile     2.3° orb
☽ Moon ☐ Mars     Square      3.1° orb
...
```

Use aspect glyphs: ☌ Conjunction, ⚹ Sextile, ☐ Square, △ Trine, ☍ Opposition.

Sort by orb ascending (tightest first). Cap at 25 aspects displayed; if there are more, add "+ N more aspects" expander.

Under each aspect, interpretation lookup with key fallback:

```js
function aspectKey(body1, aspectType, body2) {
  // Try both orderings since JSON may key either way
  const a = `${body1}-${aspectType}-${body2}`;
  const b = `${body2}-${aspectType}-${body1}`;
  return INTERPRETATIONS.aspects?.[a] || INTERPRETATIONS.aspects?.[b] || "";
}
```

If empty, omit the line. (The JSON has ~57 aspect entries; many aspects won't have interpretations, and that's fine.)

### Close handlers

- Esc key
- Backdrop click (but not modal-itself click)
- X button

All call `closeChartModal()` which removes the overlay and unbinds the keydown listener.

## CSS

In `src/css/astrology.css` (create if not exists):

```css
.natal-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.natal-modal {
  width: min(80vw, 1100px);
  height: min(80vh, 800px);
  background: var(--bg-surface);
  border: 1px solid var(--gold);
  display: flex;
  flex-direction: column;
}
.natal-modal-header {
  padding: 0.8rem 1.2rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.natal-modal-title {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.4rem;
  color: var(--text);
}
.natal-modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.4rem;
  cursor: pointer;
}
.natal-modal-close:hover { color: var(--accent); }

.natal-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 3rem;
  display: flex;
  justify-content: center;
}
.natal-modal-content {
  max-width: 700px;
  width: 100%;
}

.natal-section-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 1.6rem 0 0.5rem;
  border-bottom: 1px solid var(--gold-soft);
  padding-bottom: 0.3rem;
}

.natal-planet-row,
.natal-angle-row,
.natal-house-row,
.natal-aspect-row {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1rem;
  color: var(--text);
  padding: 0.4rem 0;
  border-bottom: 1px dotted var(--border);
}
.natal-interpretation {
  font-style: italic;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 0.2rem;
  padding-left: 1.5rem;
}
```

Tune as needed.

## Out of scope

- Generating interpretation content (it's in the JSON the user provided)
- Synastry / compatibility (14b)
- Print-to-PDF export
- A graphical chart wheel

## Definition of done

- `src/js/data/astrology-interpretations.json` is read by the modal
- "View full chart" button appears on the Zodiac card when chart data exists
- Clicking it opens the modal
- Modal shows planets with interpretations, angles (if available), houses (if available), and aspects with interpretations where available
- Modal closes via Esc, backdrop, X
- Aspects limited to 25 with expander for more
- ROADMAP.md updated
