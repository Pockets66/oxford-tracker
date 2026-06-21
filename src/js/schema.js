const FACTION_PALETTE = [
  "#5b7fa6", "#7a5b9a", "#5b9a7a", "#9a7a5b", "#a65b5b",
  "#5b8a9a", "#8a9a5b", "#9a5b8a", "#6b8a6b", "#7a6b9a",
];

export const LANGUAGE_LEVELS = ["Broken", "Accented", "Advanced", "Native"];

export const STATUS_TIERS = [
  { name: "Redacted",         minKnown: 0,  maxKnown: 1  },
  { name: "Deep",             minKnown: 2,  maxKnown: 3  },
  { name: "Conspiracy",       minKnown: 4,  maxKnown: 6  },
  { name: "Hot Goss",         minKnown: 7,  maxKnown: 10 },
  { name: "Spilled Tea",      minKnown: 11, maxKnown: 14 },
  { name: "Yesterday's News", minKnown: 15, maxKnown: Infinity },
];

export function statusSlug(name) {
  return name.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");
}

export function computeStatus(secret) {
  if (secret.statusOverride) return secret.statusOverride;
  const n = (secret.knownToIds ?? []).length;
  return STATUS_TIERS.find(t => n >= t.minKnown && n <= t.maxKnown)?.name ?? "Redacted";
}

export function createSecret() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    summary: "",
    body: "",
    ownerCharacterIds: [],
    ownerFactionIds: [],
    knownToIds: [],
    knownToFactionIds: [],
    hiddenFromIds: [],
    characterTagIds: [],
    tags: [],
    statusOverride: null,
    archived: false,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Relationship constants ────────────────────────────────────────────────────

// Ordered worst → best. Index = spectrum position.
export const RELATIONSHIP_BANDS = [
  "Nemesis", "Bad Blood", "Cold", "Neutral", "Friendly", "Close", "Inseparable",
];

export const RELATIONSHIP_LINKS = {
  Family:     ["Parent", "Child", "Sibling", "Spouse", "ExSpouse", "Family"],
  Romantic:   ["Crush", "Dating", "Fiancé(e)", "SignificantOther", "Lover", "FormerLover", "ExPartner"],
  Friendship: ["BestFriend", "Friend", "Acquaintance"],
  Work:       ["Colleague", "ExColleague", "Boss", "Subordinate", "Mentor", "Protégé", "Client", "Patron", "Dependent"],
  Education:  ["Professor", "Student", "Classmate", "Alumnus"],
  Rivalry:    ["Rival", "Adversary"],
  Living:     ["Roommate"],
};

export const RELATIONSHIP_LINKS_FLAT = Object.values(RELATIONSHIP_LINKS).flat();

export function createRelationship() {
  const now = new Date().toISOString();
  return {
    id:              crypto.randomUUID(),
    from:            "",
    to:              "",
    band:            "Neutral",
    links:           [],
    notes:           "",
    lastChangedDate: null,
    createdAt:       now,
    updatedAt:       now,
  };
}

// ── Factories ────────────────────────────────────────────────────────────────

export function createCharacter() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    firstName: "New Character",
    middleName: "",
    lastName: "",
    previousNames: [],
    aliases: [],
    displayAliasIndex: null,
    akaAliasIndices: [],
    age: null,
    birthday: null,
    birthTime: null,
    birthCityId: null,
    placeOfBirth: "",
    languages: [{ name: "English", level: "Native" }],
    deathDate: null,
    birthSymbol: null,
    birthColor:  null,
    deathSymbol: null,
    deathColor:  null,
    zodiac:      { sun: null, moon: null, rising: null },
    natalChart:  null,
    owner: "NPC",
    deceased: false,
    factionIds: [],
    summary: "",
    background: "",
    cards: { skills: "", notes: "" },
    createdAt: now,
    updatedAt: now,
  };
}

export function displayName(character) {
  if (character.displayAliasIndex != null && character.aliases?.[character.displayAliasIndex]) {
    return character.aliases[character.displayAliasIndex];
  }
  const parts = [character.firstName, character.middleName, character.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (character.aliases?.length) return character.aliases[0];
  return "(unnamed)";
}

export function computeAge(character, currentDateIso) {
  if (!character.birthday) return null;
  const asOf = character.deathDate ?? currentDateIso;
  if (!asOf) return null;
  const [by, bm, bd] = character.birthday.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age--;
  return age >= 0 ? age : null;
}

export function createFaction() {
  const now = new Date().toISOString();
  const color = FACTION_PALETTE[Math.floor(Math.random() * FACTION_PALETTE.length)];
  return {
    id: crypto.randomUUID(),
    name: "New Faction",
    summary: "",
    agenda: "",
    leaderId: null,
    memberIds: [],
    sceneIds: [],
    plotlineIds: [],
    notes: "",
    color,
    createdAt: now,
    updatedAt: now,
  };
}

// Rebuilds every character's factionIds from the authoritative faction.memberIds.
export function syncFactionMembership(characters, factions) {
  for (const c of characters) c.factionIds = [];
  for (const f of factions) {
    for (const memberId of f.memberIds) {
      const c = characters.find(ch => ch.id === memberId);
      if (c && !c.factionIds.includes(f.id)) c.factionIds.push(f.id);
    }
  }
}

export const SCENE_STATUSES = ["Draft", "In progress", "Complete"];
export const SCENE_ROLES    = ["Key Actor", "Observer", "Background"];

export function createScene() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    summary: "",
    body: "",
    storyBeats: "",
    goals: "",
    status: "Draft",
    sceneDate: null,
    symbol: null,
    color:  null,
    location: "",
    factionIds: [],
    characters: [],
    plotlineIds: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function createPlotline() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    summary: "",
    body: "",
    color: "#4a6b8a",
    isSecret: false,
    characterIds: [],
    factionIds: [],
    items: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function createTimelineEvent() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    date: null,
    symbol: null,
    color:  null,
    characterIds: [],
    factionIds: [],
    plotlineIds: [],
    kind: "event",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Anomaly constants ─────────────────────────────────────────────────────────

export const ANOMALY_CATEGORIES = [
  { name: "Paradoxical",   description: "Time-loop entities, rifts, beings that exist and don't exist depending on observation." },
  { name: "Parasites",     description: "Soul-leeches that drain without killing outright." },
  { name: "Pathological",  description: "Conditions like vampirism-as-disease, cursed bloodlines producing involuntary monstrous transformation." },
  { name: "Patrons",       description: "Bargaining entities where the deal is the point." },
  { name: "Penitents",     description: "Revenants with unfinished business, oath-bound spirits." },
  { name: "Pest",          description: "Imps, soured brownies, poltergeists that just throw cutlery." },
  { name: "Phantom",       description: "Standard ghosts, residual hauntings." },
  { name: "Plague",        description: "Hive-mind possession events, contagious hauntings, entities that jump host to host." },
  { name: "Polluters",     description: "Land-tainting entities, gone-wrong river spirits, cursed groves." },
  { name: "Portents",      description: "Omen-bearing entities that appear before events." },
  { name: "Possessors",    description: "Spirits that hijack a living body." },
  { name: "Predators",     description: "Entities in active hunt mode." },
  { name: "Preternatural", description: "Outer entities, things that came through from elsewhere." },
  { name: "Pretenders",    description: "Doppelgangers, changelings wearing human shape." },
  { name: "Primordial",    description: "Old gods, dragons in the sense of beings that predate human reckoning." },
  { name: "Progenitors",   description: "Originators in a lineage: the first vampire who turns others, alpha werewolves who make more." },
  { name: "Puppeteers",    description: "Entities that operate victims from a distance without entering them." },
];

export const ANOMALY_CLASSES = [
  { roman: "I",    label: "Reality-breaking" },
  { roman: "II",   label: "Catastrophic" },
  { roman: "III",  label: "Lethal" },
  { roman: "IV",   label: "Hazardous" },
  { roman: "V",    label: "Threatening" },
  { roman: "VI",   label: "Disruptive" },
  { roman: "VII",  label: "Unsettling" },
  { roman: "VIII", label: "Curious" },
  { roman: "IX",   label: "Mild" },
  { roman: "X",    label: "Negligible" },
];

export const ANOMALY_STATUSES = ["Active", "Contained", "Dormant", "Eradicated", "Unknown"];

export function createAnomaly() {
  const now = new Date().toISOString();
  return {
    id:              crypto.randomUUID(),
    title:           "",
    primaryCategory: null,
    primaryClass:    null,
    secondaryTypes:  [],
    status:          "Unknown",
    location:        "",
    discoveryDate:   null,
    symbol:          null,
    color:           null,
    lore:            "",
    observations:    [],
    characterIds:    [],
    sceneIds:        [],
    plotlineIds:     [],
    secretIds:       [],
    tags:            [],
    notes:           "",
    archived:        false,
    createdAt:       now,
    updatedAt:       now,
  };
}

export function anomalyOverallClass(anomaly) {
  const classes = [anomaly.primaryClass, ...(anomaly.secondaryTypes ?? []).map(t => t.class)].filter(Boolean);
  if (!classes.length) return null;
  const orderedRomans = ANOMALY_CLASSES.map(c => c.roman);
  let lowest    = classes[0];
  let lowestIdx = orderedRomans.indexOf(lowest);
  for (const c of classes) {
    const idx = orderedRomans.indexOf(c);
    if (idx < lowestIdx) { lowest = c; lowestIdx = idx; }
  }
  return lowest;
}

// ── Migrations ───────────────────────────────────────────────────────────────

// Migration v1→v2: old `sheet` shape → new `background` + `cards` shape.
export function migrateCharacters(characters) {
  for (const c of characters) {
    if (!("birthTime" in c))    c.birthTime = null;
    if (!("placeOfBirth" in c)) c.placeOfBirth = "";
    if (!("background" in c)) {
      const parts = [c.sheet?.family, c.sheet?.notes].filter(Boolean);
      c.background = parts.join("\n\n");
    }
    if (!("cards" in c)) {
      c.cards = {
        skills:  c.sheet?.skills  ?? "",
        secrets: c.sheet?.secrets ?? "",
        notes:   "",
      };
    }
    delete c.sheet;
  }
}

// Migration v2→v3: single `name` → structured firstName/middleName/lastName + aliases/previousNames.
export function migrateNamesToV3(characters) {
  for (const c of characters) {
    if ("name" in c) {
      const parts = (c.name || "").trim().split(/\s+/).filter(Boolean);
      c.firstName  = parts[0]  ?? "";
      c.lastName   = parts.length > 1 ? parts[parts.length - 1] : "";
      c.middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
      delete c.name;
    }
    if (!("firstName" in c))     c.firstName     = "";
    if (!("middleName" in c))    c.middleName    = "";
    if (!("lastName" in c))      c.lastName      = "";
    if (!("previousNames" in c)) c.previousNames = [];
    if (!("aliases" in c))       c.aliases       = [];
  }
}

// Migration v3→v4: add displayAliasIndex to characters.
export function migrateToV4(characters, _relationships) {
  for (const c of characters) {
    if (!("displayAliasIndex" in c)) c.displayAliasIndex = null;
    if (!("deathDate" in c))         c.deathDate = null;
  }
}

// ── City seed data ────────────────────────────────────────────────────────────

export function seedCities() {
  const cities = [
    // United Kingdom and Ireland
    ["Oxford, England",        51.7520,   -1.2577, "Europe/London"],
    ["London, England",        51.5074,   -0.1278, "Europe/London"],
    ["Cambridge, England",     52.2053,    0.1218, "Europe/London"],
    ["Edinburgh, Scotland",    55.9533,   -3.1883, "Europe/London"],
    ["Cardiff, Wales",         51.4816,   -3.1791, "Europe/London"],
    ["Manchester, England",    53.4808,   -2.2426, "Europe/London"],
    ["Dublin, Ireland",        53.3498,   -6.2603, "Europe/Dublin"],
    // Continental Europe
    ["Paris, France",          48.8566,    2.3522, "Europe/Paris"],
    ["Berlin, Germany",        52.5200,   13.4050, "Europe/Berlin"],
    ["Düsseldorf, Germany",    51.2277,    6.7735, "Europe/Berlin"],
    ["Munich, Germany",        48.1351,   11.5820, "Europe/Berlin"],
    ["Amsterdam, Netherlands", 52.3676,    4.9041, "Europe/Amsterdam"],
    ["Rome, Italy",            41.9028,   12.4964, "Europe/Rome"],
    ["Madrid, Spain",          40.4168,   -3.7038, "Europe/Madrid"],
    ["Copenhagen, Denmark",    55.6761,   12.5683, "Europe/Copenhagen"],
    ["Vienna, Austria",        48.2082,   16.3738, "Europe/Vienna"],
    ["Zurich, Switzerland",    47.3769,    8.5417, "Europe/Zurich"],
    ["Prague, Czechia",        50.0755,   14.4378, "Europe/Prague"],
    ["Stockholm, Sweden",      59.3293,   18.0686, "Europe/Stockholm"],
    ["Oslo, Norway",           59.9139,   10.7522, "Europe/Oslo"],
    ["Helsinki, Finland",      60.1699,   24.9384, "Europe/Helsinki"],
    ["Brussels, Belgium",      50.8503,    4.3517, "Europe/Brussels"],
    ["Lisbon, Portugal",       38.7223,   -9.1393, "Europe/Lisbon"],
    ["Warsaw, Poland",         52.2297,   21.0122, "Europe/Warsaw"],
    ["Budapest, Hungary",      47.4979,   19.0402, "Europe/Budapest"],
    ["Athens, Greece",         37.9838,   23.7275, "Europe/Athens"],
    // Canada
    ["Toronto, Ontario",       43.6532,  -79.3832, "America/Toronto"],
    ["Montreal, Quebec",       45.5017,  -73.5673, "America/Montreal"],
    ["Quebec City, Quebec",    46.8139,  -71.2080, "America/Montreal"],
    ["Vancouver, BC",          49.2827, -123.1207, "America/Vancouver"],
    ["Calgary, Alberta",       51.0447, -114.0719, "America/Edmonton"],
    ["Edmonton, Alberta",      53.5461, -113.4938, "America/Edmonton"],
    ["Ottawa, Ontario",        45.4215,  -75.6972, "America/Toronto"],
    ["Halifax, Nova Scotia",   44.6488,  -63.5752, "America/Halifax"],
    // United States
    ["New York, NY",           40.7128,  -74.0060, "America/New_York"],
    ["Boston, MA",             42.3601,  -71.0589, "America/New_York"],
    ["Washington, DC",         38.9072,  -77.0369, "America/New_York"],
    ["Philadelphia, PA",       39.9526,  -75.1652, "America/New_York"],
    ["Atlanta, GA",            33.7490,  -84.3880, "America/New_York"],
    ["Miami, FL",              25.7617,  -80.1918, "America/New_York"],
    ["Chicago, IL",            41.8781,  -87.6298, "America/Chicago"],
    ["Minneapolis, MN",        44.9778,  -93.2650, "America/Chicago"],
    ["Houston, TX",            29.7604,  -95.3698, "America/Chicago"],
    ["Dallas, TX",             32.7767,  -96.7970, "America/Chicago"],
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
    ["Harare, Zimbabwe",      -17.8252,   31.0335, "Africa/Harare"],
    ["Wellington, New Zealand",-41.2865, 174.7762, "Pacific/Auckland"],
  ];
  return cities.map(([name, lat, lng, timezone]) => ({
    id: crypto.randomUUID(),
    name, lat, lng, timezone,
  }));
}
