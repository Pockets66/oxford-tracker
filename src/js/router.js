const TABS = ["characters", "scenes", "plotlines", "factions", "anomalies"];

function parsePath() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  return {
    tab: parts[0] || "characters",
    id: parts[1] || null,
  };
}

export function navigate(path) {
  location.hash = `/${path}`;
}

export function currentRoute() {
  return parsePath();
}

window.addEventListener("hashchange", () => {
  window.dispatchEvent(new CustomEvent("route-change", { detail: parsePath() }));
});

// Fire on first load so app boots into the right state.
export function initRouter() {
  if (!location.hash) {
    location.hash = "/characters";
  }
  window.dispatchEvent(new CustomEvent("route-change", { detail: parsePath() }));
}
