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
