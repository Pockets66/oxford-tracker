# Slice 14a.2: Astrology compute utility + identity card cleanup

Read CLAUDE.md and ROADMAP.md. Slice 14a.1 must be done. **Small, focused slice.** Surgical edits only.

**Migration policy:** No migration.

## Files to read first

ONLY these:

- `src/js/schema.js`
- `src/js/views/character-sheet.js`
- `src/css/sheet.css`
- `package.json`
- `ROADMAP.md`

## Goal

Two things:

1. Install the astrology library and build a pure-compute utility that produces a natal chart structure from birth data. No UI changes for the chart yet.
2. Cleanup: move birthday from Identity card to Zodiac card. Remove placeOfBirth from Identity (it's redundant; the city in Zodiac handles location).

## Part 1: Identity card cleanup

In `src/js/views/character-sheet.js`:

1. **Find the Identity card's edit-mode render.** Locate the row containing the birthday input.

2. **Remove the birthday row entirely from the Identity card.** Also remove the "FROM BIRTHDAY" age helper text under the age field (it stops making sense once birthday lives elsewhere; just show the auto-computed age value without the explanation).

3. **Find the place-of-birth row** in the Identity card. Remove it entirely. (The Zodiac card already has the birth city which handles this.)

4. **In the Zodiac card's edit-mode render**, add the birthday input row at the TOP of the card (before the time and city inputs added in 14a.1). Move the existing birthday change handler to this new location. The order in the card should be:
   - Birthday (date input)
   - Birth time (time input)
   - Birth city (combobox)
   - Then the existing zodiac fields (sun read-only, moon dropdown, rising dropdown if expanded)

5. **In the Zodiac card's read-only view**, prepend the birthday display before the sun sign line if birthday is set:
   ```
   19 October 1995
   Libra
   Born 22:03 in Düsseldorf, Germany
   ```
   Use `formatLongDate(character.birthday)` from `dates.js` for the date line. EB Garamond, slightly muted.

6. **Identity card read-only view**: ensure birthday and place-of-birth are no longer rendered there. Age (auto-computed from birthday in zodiac) still shows.

## Part 2: Install the astrology library

Add to `package.json` via `npm install astronomia`. This is the recommended library; it's pure JS and offline-capable. If for any reason astronomia doesn't install cleanly, try `swisseph-wasm` as a fallback. Either way, install one library and adapt the wrapper to it.

After install, verify it imports correctly with a small smoke test. Do NOT run the app or write tests; just confirm `package.json` has the entry and `node_modules/<lib>/` exists.

## Part 3: Build the compute utility

Create a new file `src/js/util/astrology.js` with this exported API:

```js
// Returns the natal chart structure described below, or null if no birthday.
// Partial charts are valid: any of birthTime, lat, lng, timezone can be missing.
export async function computeNatalChart({ birthday, birthTime, lat, lng, timezone }) { ... }
```

Returned structure:

```js
{
  computedAt: "<iso datetime>",
  inputs: { birthday, birthTime, lat, lng, timezone },
  bodies: {
    sun:     { sign: "Libra",   degree: 25.8, house: 7 | null, approximate: false },
    moon:    { sign: "Cancer",  degree: 12.3, house: 4 | null, approximate: true },
    mercury: { sign, degree, house, approximate },
    venus:   { ... },
    mars:    { ... },
    jupiter: { ... },
    saturn:  { ... },
    uranus:  { ... },
    neptune: { ... },
    pluto:   { ... },
  },
  angles: {
    ascendant: { sign, degree } | null,
    midheaven: { sign, degree } | null,
  },
  houses: [
    { number: 1, sign, cusp },
    ...
    { number: 12, sign, cusp },
  ] | null,
  aspects: [
    { from: "sun", to: "moon", type: "Sextile", orb: 2.3 },
    ...
  ],
}
```

### Computation rules

1. **Convert local birth time to UTC** using the provided timezone. If birthTime is missing, use 12:00 noon local time of the birth date as a placeholder, and flag affected bodies as `approximate: true` (Moon and any body that moves more than ~0.5° per day in the relevant time window).

2. **Compute planet positions** for that UTC moment using the library. Convert ecliptic longitude into sign + degree-within-sign. Signs in order starting at 0° Aries: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces.

3. **Houses and angles**: only compute if birthTime, lat, lng, and timezone are ALL present. Use Placidus house system. For latitudes > 66.5° or < -66.5°, fall back to Whole Sign (each house equals one sign starting from the Ascendant sign). Set `bodies[x].house` based on which house the planet falls in.

4. **Aspects**: compute pairwise between all 10 bodies. Major aspects only: Conjunction (0°), Sextile (60°), Square (90°), Trine (120°), Opposition (180°). Orbs:
   - Sun or Moon involved: 8° orb
   - Mercury/Venus/Mars to inner planets: 6° orb
   - Jupiter/Saturn: 5° orb
   - Outer planets (Uranus, Neptune, Pluto): 4° orb
   
   Skip aspects outside the orb. Report the actual orb (degrees of deviation from exact).

5. **Approximate flag**: Set `bodies.moon.approximate = true` when birthTime is missing. Other bodies stay accurate because they move slowly enough that noon-vs-exact-time is negligible.

### Sub-helpers (keep internal, do not export):

- `longitudeToSign(degrees)` → returns `{ sign, degreeInSign }`
- `whichHouse(planetLongitude, houseCusps)` → returns house number 1-12
- `aspectBetween(longA, longB)` → returns `{ type, orb } | null`

### Timezone handling

JavaScript's built-in `Intl.DateTimeFormat` knows IANA timezones. For converting "1995-10-19 22:03 in Europe/Berlin" to a UTC Date object, write a small helper using `Intl`. If the library or environment doesn't support a clean conversion path, manually offset using the timezone's hour offset for that date (compute via `Intl.DateTimeFormat`).

Sample implementation pattern:

```js
function localToUtc(dateStr, timeStr, timezone) {
  // dateStr: "1995-10-19", timeStr: "22:03"
  // timezone: "Europe/Berlin"
  // Returns a JS Date in UTC.
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = (timeStr || "12:00").split(":").map(Number);
  
  // Create a Date interpreted as if it were UTC, then adjust.
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  
  // Get the timezone offset at that moment.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "2-digit", hour12: false,
  });
  const tzHour = parseInt(formatter.format(naive));
  const offsetHours = tzHour - hour;
  
  return new Date(naive.getTime() - offsetHours * 3600 * 1000);
}
```

Refine as needed.

## Part 4: Storage of computed chart

Add `natalChart: null` to `createCharacter()`'s defaults in `src/js/schema.js` (surgical str_replace, just add the field).

DO NOT compute or store the chart in this slice. That's 14a.3. This slice only:
- Cleans up the Identity/Zodiac split
- Installs the library
- Provides the compute utility
- Adds the schema field

## Out of scope

- Calling `computeNatalChart` from anywhere in the app (14a.3)
- Updating the Zodiac card to display computed data beyond what's already there (14a.3)
- Full chart modal (14a.4)
- Synastry (14b)

## Definition of done

- Identity card no longer shows birthday or place-of-birth
- Zodiac card edit mode has birthday at the top, then birth time, then birth city
- Zodiac card read-only mode shows birthday line above sun sign
- `astronomia` (or fallback) installed in package.json
- `src/js/util/astrology.js` exports `computeNatalChart`
- `character.natalChart` field exists in schema defaults
- ROADMAP.md updated
