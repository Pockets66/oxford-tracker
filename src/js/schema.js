const FACTION_PALETTE = [
  "#5b7fa6", "#7a5b9a", "#5b9a7a", "#9a7a5b", "#a65b5b",
  "#5b8a9a", "#8a9a5b", "#9a5b8a", "#6b8a6b", "#7a6b9a",
];

export const LANGUAGE_LEVELS = ["Broken", "Accented", "Native"];

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

export const STRUCTURAL_TYPES = [
  "Parent", "Child", "Sibling",
  "Spouse", "Ex-spouse", "Fiancé(e)",
  "Lover", "Ex-lover",
  "Mentor", "Student",
  "Other family",
];

export const STRUCTURAL_PAIRS = {
  "Parent":      "Child",
  "Child":       "Parent",
  "Sibling":     "Sibling",
  "Spouse":      "Spouse",
  "Ex-spouse":   "Ex-spouse",
  "Fiancé(e)":   "Fiancé(e)",
  "Lover":       "Lover",
  "Ex-lover":    "Ex-lover",
  "Mentor":      "Student",
  "Student":     "Mentor",
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
    languages: [],
    deathDate: null,
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
    location: "",
    factionIds: [],
    characters: [],
    plotlineIds: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
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

// Migration v3→v4: add displayAliasIndex to characters; migrate relationships
// from {type, closeness} to {structuralType, socialLabels, platonic, romantic}.
export function migrateToV4(characters, relationships) {
  for (const c of characters) {
    if (!("displayAliasIndex" in c)) c.displayAliasIndex = null;
    if (!("deathDate" in c))         c.deathDate = null;
  }
  migrateRelationships(relationships);
}

export function migrateRelationships(relationships) {
  const closeToPlat = {
    "Inseparable": "Inseparable",
    "Close":       "Cares for",
    "Familiar":    "Likes",
    "Acquaintance": "Acquaintance",
    "Distant":     "Distant",
    "Estranged":   "Estranged",
  };
  const romanticStructural = new Set(["Lover", "Ex-lover", "Spouse", "Ex-spouse", "Fiancé(e)"]);

  for (const r of relationships) {
    if ("structuralType" in r) continue;
    const oldType     = r.type      ?? "";
    const oldCloseness = r.closeness ?? "";

    r.structuralType = STRUCTURAL_TYPES.includes(oldType) ? oldType : null;
    r.socialLabels   = SOCIAL_LABELS.includes(oldType) ? [oldType] : [];
    r.platonic       = closeToPlat[oldCloseness] ?? null;
    r.romantic       = (oldCloseness === "Inseparable" && romanticStructural.has(oldType))
      ? "In Love" : null;

    delete r.type;
    delete r.closeness;
  }
}
