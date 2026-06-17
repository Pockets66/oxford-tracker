const FACTION_PALETTE = [
  "#5b7fa6", "#7a5b9a", "#5b9a7a", "#9a7a5b", "#a65b5b",
  "#5b8a9a", "#8a9a5b", "#9a5b8a", "#6b8a6b", "#7a6b9a",
];

export function createCharacter() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "New Character",
    age: null,
    birthday: null,
    zodiac: { sun: null, moon: null, rising: null },
    owner: "NPC",
    deceased: false,
    factionIds: [],
    summary: "",
    sheet: {
      secrets: "",
      family: "",
      skills: "",
      fears: "",
      weaknesses: "",
      notes: "",
    },
    createdAt: now,
    updatedAt: now,
  };
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
