import { loadAll } from "./storage.js";
import { navigate, initRouter } from "./router.js";
import { qs, el, clear } from "./dom.js";
import { mountCharacters } from "./views/characters.js";
import { mountCharacterSheet } from "./views/character-sheet.js";

const TABS = [
  { id: "characters", label: "Characters" },
  { id: "scenes",     label: "Scenes" },
  { id: "plotlines",  label: "Plotlines" },
  { id: "factions",   label: "Factions" },
  { id: "anomalies",  label: "Anomalies" },
];

const COMING_SLICE = {
  scenes:    "Slice 6",
  plotlines: "Slice 7",
  factions:  "Slice 3",
  anomalies: "Slice 9",
};

let appData = null;

// ── View mounting ────────────────────────────────────────────────────────────

function mountView(tab, id) {
  const main = qs("#main");
  clear(main);

  if (tab === "characters") {
    if (id) {
      mountCharacterSheet(main, appData, id);
    } else {
      mountCharacters(main, appData);
    }
    return;
  }

  const label = TABS.find((t) => t.id === tab)?.label ?? tab;
  main.append(el("div", { class: "placeholder-view" }, [
    `${label} — coming in ${COMING_SLICE[tab] ?? "a future slice"}.`,
  ]));
}

// ── Tab highlight ─────────────────────────────────────────────────────────

function setActiveTab(tab) {
  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  }
}

// ── Error banner ─────────────────────────────────────────────────────────

function showBanner(message) {
  const banner = qs("#error-banner");
  qs("#error-text").textContent = message;
  banner.classList.add("visible");
}

function hideBanner() {
  qs("#error-banner").classList.remove("visible");
}

// ── Boot ─────────────────────────────────────────────────────────────────

async function init() {
  // Theme toggle.
  const savedTheme = localStorage.getItem("oxford-theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  const themeBtn = qs("#theme-toggle");
  themeBtn.textContent = savedTheme === "dark" ? "☀" : "☾";
  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    themeBtn.textContent = next === "dark" ? "☀" : "☾";
    localStorage.setItem("oxford-theme", next);
  });

  // Wire tab clicks.
  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => navigate(btn.dataset.tab));
  }

  // Wire error banner dismiss.
  qs("#banner-dismiss").addEventListener("click", hideBanner);

  // Listen for storage errors.
  window.addEventListener("storage-error", (e) => {
    showBanner(`Storage error (${e.detail.entityType}): ${e.detail.message}`);
  });

  // Listen for route changes.
  window.addEventListener("route-change", (e) => {
    const { tab, id } = e.detail;
    setActiveTab(tab);
    mountView(tab, id);
  });

  // Load data and boot.
  try {
    appData = await loadAll();
    initRouter();
  } catch (err) {
    showBanner(`Could not load data: ${err.message}`);
  }
}

init();
