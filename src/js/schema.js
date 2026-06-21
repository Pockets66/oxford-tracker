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
    placeOfBirth: "",
    languages: [{ name: "English", level: "Native" }],
    deathDate: null,
    birthSymbol: null,
    birthColor:  null,
    deathSymbol: null,
    deathColor:  null,
    zodiac: { sun: null, moon: null, rising: null },
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
