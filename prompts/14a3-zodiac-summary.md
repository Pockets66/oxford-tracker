# Slice 14a.3: Auto-compute chart + Zodiac card summary

Read CLAUDE.md and ROADMAP.md. Slices 14a.1 and 14a.2 must be done. **Small, focused slice.** Surgical edits only.

**Migration policy:** No migration.

## Files to read first

ONLY these:

- `src/js/util/astrology.js`
- `src/js/views/character-sheet.js`
- `src/js/schema.js`
- `src/css/sheet.css`
- `ROADMAP.md`

## Goal

Hook the compute function into the character sheet. When birthday, birth time, or birth city changes, recompute the chart (debounced) and store it. Display the computed Sun, Moon, planets, and angles on the Zodiac card's read-only view. Manual moon/rising overrides still win.

## Auto-compute on save

In `src/js/views/character-sheet.js`:

1. **Find the existing save flow** for the character (the debounced save function that fires on field changes). At the top of the file, import the compute helper:

```js
import { computeNatalChart } from "../util/astrology.js";
```

2. **Add a helper function** `recomputeChartIfReady(character, appData)`:

```js
async function recomputeChartIfReady(character, appData) {
  if (!character.birthday) {
    character.natalChart = null;
    return;
  }
  const city = character.birthCityId
    ? appData.meta.knownCities.find(c => c.id === character.birthCityId)
    : null;
  character.natalChart = await computeNatalChart({
    birthday: character.birthday,
    birthTime: character.birthTime || null,
    lat: city?.lat ?? null,
    lng: city?.lng ?? null,
    timezone: city?.timezone ?? null,
  });
}
```

3. **Wire it to the relevant field handlers.** Find the change handlers for `birthday`, `birthTime`, and `birthCityId` in the Zodiac card. After each one calls `saveCharacter(character)`, also call `await recomputeChartIfReady(character, appData)` and then `saveCharacter(character)` a second time to persist the computed chart. Surgical: just add the await line + second save after each existing handler.

Simpler pattern if cleaner: wrap the save in a helper that always recomputes:

```js
async function saveCharacterWithChart(character, appData) {
  await recomputeChartIfReady(character, appData);
  saveCharacter(character);
}
```

Use this wrapper instead of the bare `saveCharacter` for the three birth-data fields. Other field handlers keep using bare `saveCharacter`.

4. **On character page load**, compute the chart once if `character.birthday` exists but `character.natalChart` is null. This ensures characters with prior birth data get their chart populated. Place this in the mount function before the read-only render.

## Zodiac card read-only display

In `src/js/views/character-sheet.js`, find the Zodiac card's read-only rendering. Expand it to show the computed chart summary if `character.natalChart` is non-null.

Current expected output (from 14a.2):

```
19 October 1995
Libra
Born 22:03 in Düsseldorf, Germany
```

Expanded output:

```
19 October 1995
Libra                                ← sun, large
Born 22:03 in Düsseldorf, Germany   ← muted

Moon in Cancer · Rising Scorpio      ← shown if available
Mercury Scorpio · Venus Libra · Mars Sagittarius   ← inner planets line
Jupiter ♐ · Saturn ♑ · Uranus ♎ · Neptune ♑ · Pluto ♏   ← outer planets line, compact with glyphs
```

Display rules:

- **Sun sign**: from `character.natalChart.bodies.sun.sign` if available, else from existing `sunSignFromDate(birthday)`, else not shown.
- **Birthday + city line**: as already implemented in 14a.2.
- **Moon and Rising line**:
   - Moon: prefer `character.zodiac.moon` if set (manual override). Else use `character.natalChart.bodies.moon.sign` with "(approx.)" appended if `bodies.moon.approximate === true`.
   - Rising: prefer `character.zodiac.rising` if set. Else use `character.natalChart.angles.ascendant.sign` if non-null.
   - If neither moon nor rising data is available, omit the line.
   - If only one is available: show just that one ("Moon in Cancer" or "Rising Scorpio").
- **Inner planets line**: Mercury, Venus, Mars in their signs. Format: "Mercury Scorpio · Venus Libra · Mars Sagittarius". Omit any body that's null. Omit the whole line if all three are null.
- **Outer planets line**: Jupiter through Pluto, compact with planet glyphs (Unicode). Use these glyphs: ♃ Jupiter, ♄ Saturn, ♅ Uranus, ♆ Neptune, ♇ Pluto. Followed by the sign glyph for the sign. Sign glyphs in order: ♈ Aries, ♉ Taurus, ♊ Gemini, ♋ Cancer, ♌ Leo, ♍ Virgo, ♎ Libra, ♏ Scorpio, ♐ Sagittarius, ♑ Capricorn, ♒ Aquarius, ♓ Pisces.

  Format: "Jup ♐ · Sat ♑ · Ura ♎ · Nep ♑ · Plu ♏". Use the three-letter abbreviation for each body followed by the sign glyph.

  Omit any null. Omit the line if all null.

If `character.natalChart` is null (no birthday set, or compute failed), fall back to the existing read-only display (just sun-from-date and birthday/city line).

## CSS

In `src/css/sheet.css`, add styles for the new lines if needed. Suggested classes:

```css
.zodiac-line-moon-rising {
  margin-top: 0.4rem;
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1rem;
  color: var(--text);
}
.zodiac-line-inner-planets,
.zodiac-line-outer-planets {
  margin-top: 0.3rem;
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 0.9rem;
  color: var(--text-muted);
}
.zodiac-glyph {
  font-size: 1em;
  margin: 0 0.1em;
}
.zodiac-approx-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  margin-left: 0.3rem;
}
```

Add only what's actually needed. If the existing styles look fine, skip.

## Edge cases

- **No birthday**: nothing in `bodies`. Display falls back to the muted "Set birthday for chart" already implied. Don't break.
- **Birthday but no time, no city**: Sun sign and planet signs render (planets are positionally fine without exact time). Moon shows with "(approx.)". No houses, no rising.
- **Birthday + time, no city**: Sun, Moon (accurate), planets all render. Still no houses, no rising.
- **Birthday + time + city, but city has bad timezone string**: compute may fail. Catch the error in `recomputeChartIfReady`, log to console, set `natalChart` to null, don't crash.
- **Manual moon/rising overrides empty after computation**: the natal chart values win in display. If user sets a manual value later, that wins.

## Out of scope

- Aspects display (saved for 14a.4 modal)
- Houses display (saved for 14a.4 modal)
- Interpretive text (14a.4)
- Full chart modal (14a.4)
- Synastry (14b)

## Definition of done

- Changes to birthday, birth time, or birth city trigger automatic chart recomputation
- `character.natalChart` is populated and saved to disk
- Zodiac card read-only view shows: birthday, sun sign, born-line, moon/rising line, inner planets line, outer planets line
- Manual zodiac overrides on moon and rising still win over computed values
- Approximate Moon labeled with "(approx.)" when no birth time
- ROADMAP.md updated with slice 14a.3 status: done
