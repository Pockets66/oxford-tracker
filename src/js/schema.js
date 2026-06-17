const FACTION_PALETTE = [
  "#5b7fa6", "#7a5b9a", "#5b9a7a", "#9a7a5b", "#a65b5b",
  "#5b8a9a", "#8a9a5b", "#9a5b8a", "#6b8a6b", "#7a6b9a",
];

export function createCharacter() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    firstName: "New Character",
    middleName: "",
    lastName: "",
    previousNames: [],
    aliases: [],
    age: null,
    birthday: null,
    birthTime: null,
    placeOfBirth: "",
    zodiac: { sun: null, moon: null, rising: null },
    owner: "NPC",
    deceased: false,
    factionIds: [],
    summary: "",
    background: "",
    cards: { skills: "", secrets: "", notes: "" },
    createdAt: now,
    updatedAt: now,
  };
}

export function displayName(character) {
  const parts = [character.firstName, character.middleName, character.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (character.aliases?.length) return character.aliases[0];
  return "(unnamed)";
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
