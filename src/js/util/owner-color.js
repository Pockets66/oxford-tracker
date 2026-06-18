export function ownerColor(owner) {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const map = {
    Bree:   v("--owner-bree"),
    Jack:   v("--owner-jack"),
    Nicole: v("--owner-nicole"),
    Caiden: v("--owner-caiden"),
    NPC:    v("--owner-npc"),
  };
  const first = (owner || "NPC").split(",")[0].trim();
  return map[first] || map.NPC;
}
