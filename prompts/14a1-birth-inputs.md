# Slice 14a.1: Birth time and city inputs

Read CLAUDE.md and ROADMAP.md. **Small, focused slice. One checkpoint.** Surgical edits only.

**Migration policy:** No migration.

## Files to read first

ONLY these:

- `src/js/schema.js`
- `src/js/views/character-sheet.js`
- `src/js/components/combobox.js`
- `src/css/sheet.css`
- `ROADMAP.md`

## Goal

Add birth time and birth city to the character sheet. Seed a curated city database with `+ Add new city` support. No chart computation yet; just the inputs.

## Schema additions (surgical str_replace)

In `src/js/schema.js`:

1. Find `createCharacter` and add two new fields next to the existing `birthday` field:
   ```js
   birthTime: null,        // "HH:MM" 24-hour, optional
   birthCityId: null,      // id from meta.knownCities, or null
   ```

2. Find the meta-default logic (where `meta.knownLanguages` is initialized). Add:
   ```js
   if (!meta.knownCities) meta.knownCities = seedCities();
   ```

3. Add a new exported function `seedCities()` near the bottom of `schema.js` that returns the seed array. Use this content (each entry needs a fresh uuid):

```js
export function seedCities() {
  const cities = [
    // United Kingdom and Ireland
    ["Oxford, England",       51.7520,  -1.2577, "Europe/London"],
    ["London, England",       51.5074,  -0.1278, "Europe/London"],
    ["Cambridge, England",    52.2053,   0.1218, "Europe/London"],
    ["Edinburgh, Scotland",   55.9533,  -3.1883, "Europe/London"],
    ["Cardiff, Wales",        51.4816,  -3.1791, "Europe/London"],
    ["Manchester, England",   53.4808,  -2.2426, "Europe/London"],
    ["Dublin, Ireland",       53.3498,  -6.2603, "Europe/Dublin"],
    // Continental Europe
    ["Paris, France",          48.8566,   2.3522, "Europe/Paris"],
    ["Berlin, Germany",        52.5200,  13.4050, "Europe/Berlin"],
    ["Düsseldorf, Germany",    51.2277,   6.7735, "Europe/Berlin"],
    ["Munich, Germany",        48.1351,  11.5820, "Europe/Berlin"],
    ["Amsterdam, Netherlands", 52.3676,   4.9041, "Europe/Amsterdam"],
    ["Rome, Italy",            41.9028,  12.4964, "Europe/Rome"],
    ["Madrid, Spain",          40.4168,  -3.7038, "Europe/Madrid"],
    ["Copenhagen, Denmark",    55.6761,  12.5683, "Europe/Copenhagen"],
    ["Vienna, Austria",        48.2082,  16.3738, "Europe/Vienna"],
    ["Zurich, Switzerland",    47.3769,   8.5417, "Europe/Zurich"],
    ["Prague, Czechia",        50.0755,  14.4378, "Europe/Prague"],
    ["Stockholm, Sweden",      59.3293,  18.0686, "Europe/Stockholm"],
    ["Oslo, Norway",           59.9139,  10.7522, "Europe/Oslo"],
    ["Helsinki, Finland",      60.1699,  24.9384, "Europe/Helsinki"],
    ["Brussels, Belgium",      50.8503,   4.3517, "Europe/Brussels"],
    ["Lisbon, Portugal",       38.7223,  -9.1393, "Europe/Lisbon"],
    ["Warsaw, Poland",         52.2297,  21.0122, "Europe/Warsaw"],
    ["Budapest, Hungary",      47.4979,  19.0402, "Europe/Budapest"],
    ["Athens, Greece",         37.9838,  23.7275, "Europe/Athens"],
    // Canada
    ["Toronto, Ontario",       43.6532, -79.3832, "America/Toronto"],
    ["Montreal, Quebec",       45.5017, -73.5673, "America/Montreal"],
    ["Quebec City, Quebec",    46.8139, -71.2080, "America/Montreal"],
    ["Vancouver, BC",          49.2827, -123.1207, "America/Vancouver"],
    ["Calgary, Alberta",       51.0447, -114.0719, "America/Edmonton"],
    ["Edmonton, Alberta",      53.5461, -113.4938, "America/Edmonton"],
    ["Ottawa, Ontario",        45.4215, -75.6972, "America/Toronto"],
    ["Halifax, Nova Scotia",   44.6488, -63.5752, "America/Halifax"],
    // United States
    ["New York, NY",           40.7128, -74.0060, "America/New_York"],
    ["Boston, MA",             42.3601, -71.0589, "America/New_York"],
    ["Washington, DC",         38.9072, -77.0369, "America/New_York"],
    ["Philadelphia, PA",       39.9526, -75.1652, "America/New_York"],
    ["Atlanta, GA",            33.7490, -84.3880, "America/New_York"],
    ["Miami, FL",              25.7617, -80.1918, "America/New_York"],
    ["Chicago, IL",            41.8781, -87.6298, "America/Chicago"],
    ["Minneapolis, MN",        44.9778, -93.2650, "America/Chicago"],
    ["Houston, TX",            29.7604, -95.3698, "America/Chicago"],
    ["Dallas, TX",             32.7767, -96.7970, "America/Chicago"],
    ["Denver, CO",             39.7392, -104.9903, "America/Denver"],
    ["Salt Lake City, UT",     40.7608, -111.8910, "America/Denver"],
    ["Phoenix, AZ",            33.4484, -112.0740, "America/Phoenix"],
    ["Los Angeles, CA",        34.0522, -118.2437, "America/Los_Angeles"],
    ["San Francisco, CA",      37.7749, -122.4194, "America/Los_Angeles"],
    ["Oakland, CA",            37.8044, -122.2712, "America/Los_Angeles"],
    ["Seattle, WA",            47.6062, -122.3321, "America/Los_Angeles"],
    ["Portland, OR",           45.5152, -122.6784, "America/Los_Angeles"],
    ["Honolulu, HI",           21.3099, -157.8581, "Pacific/Honolulu"],
    ["Anchorage, AK",          61.2181, -149.9003, "America/Anchorage"],
    // Other
    ["Harare, Zimbabwe",       -17.8252,  31.0335, "Africa/Harare"],
    ["Wellington, New Zealand",-41.2865, 174.7762, "Pacific/Auckland"],
  ];
  return cities.map(([name, lat, lng, timezone]) => ({
    id: crypto.randomUUID(),
    name, lat, lng, timezone,
  }));
}
```

## Zodiac card edit UI (surgical str_replace)

In `src/js/views/character-sheet.js`:

1. Find the Zodiac card's edit-mode rendering. Locate the row(s) where birthday is edited.

2. After the birthday input row, add two new rows:

**Birth time row** (label + time input):
```js
el("label", { class: "field-label" }, ["Birth time (optional)"]),
el("input", {
  type: "time",
  value: character.birthTime || "",
  onchange: (e) => {
    character.birthTime = e.target.value || null;
    saveCharacter(character);
  },
}),
```

**Birth city row** (label + combobox):
```js
el("label", { class: "field-label" }, ["Birth city"]),
// combobox built below
```

3. For the birth city combobox, use the existing `createCombobox` component. The items list comes from `appData.meta.knownCities`, alphabetized by name, plus a special "+ Add new city" item at the bottom.

Add this builder near the city row:

```js
const cityItems = [
  ...appData.meta.knownCities
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ value: c.id, label: c.name })),
  { value: "__add__", label: "+ Add new city" },
];

const cityCombobox = createCombobox({
  items: cityItems,
  value: character.birthCityId || "",
  placeholder: "Choose a city",
  onChange: (value) => {
    if (value === "__add__") {
      openAddCityDialog(appData, (newCity) => {
        appData.meta.knownCities.push(newCity);
        saveMeta(appData.meta);
        character.birthCityId = newCity.id;
        saveCharacter(character);
        // Re-render the card so the combobox refreshes with the new city
        rerenderZodiacCard();
      });
    } else {
      character.birthCityId = value || null;
      saveCharacter(character);
    }
  },
});
```

4. Add the `openAddCityDialog` helper function in `character-sheet.js`. It opens a small inline dialog asking for:
   - Name (text input)
   - Latitude (number input, -90 to 90)
   - Longitude (number input, -180 to 180)
   - Timezone (text input with placeholder "e.g. Europe/London")
   
   Two buttons: Cancel and Save. Save validates non-empty name and numeric lat/lng, generates a uuid, and calls the success callback with the new city object.

   Style the dialog like the existing relationship dialog (gold border, sharp corners, modal).

## Zodiac card read-only display (small additions)

In the read-only render of the Zodiac card, if `character.birthCityId` is set, look up the city in `appData.meta.knownCities` and display the name underneath the sun sign in muted text:

```
Libra
Born in Oxford, England
```

If `character.birthTime` is set:

```
Libra
Born 08:42 in Oxford, England
```

If birthTime is set but no city: "Born 08:42".
If only city: "Born in Oxford, England".
If neither: no extra line.

## CSS

In `src/css/sheet.css`, ensure the new rows match existing field-row styling. No new CSS classes needed unless layout breaks. If it does, add a small surgical rule.

## Out of scope

- Astrology library install (slice 14a.2)
- Chart computation (slice 14a.2)
- Computed Zodiac summary (slice 14a.3)
- Full chart modal (slice 14a.4)
- Synastry (slice 14b)

## Definition of done

- Birth time input on the Zodiac card (edit mode)
- Birth city combobox on the Zodiac card (edit mode)
- City list seeded with 54 cities
- "+ Add new city" inline dialog works
- Read-only Zodiac card shows "Born [time] in [city]" if either is set
- ROADMAP.md updated with Slice 14a.1 status: done
