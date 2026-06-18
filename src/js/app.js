import { loadAll, save } from "./storage.js";
import { navigate, initRouter } from "./router.js";
import { qs, el, clear } from "./dom.js";
import { mountCharacters } from "./views/characters.js";
import { mountCharacterSheet } from "./views/character-sheet.js";
import { mountFactions } from "./views/factions.js";
import { mountFactionPage } from "./views/faction-page.js";
import { mountScenes } from "./views/scenes.js";
import { mountScenePage } from "./views/scene-page.js";
import { mountSecrets } from "./views/secrets.js";
import { mountSecretPage } from "./views/secret-page.js";
import { migrateCharacters, migrateNamesToV3, migrateToV4 } from "./schema.js";
import { dayOfWeek, addDays, formatLongDate, todayIso } from "./dates.js";

const TABS = [
  { id: "characters", label: "Characters" },
  { id: "scenes",     label: "Scenes" },
  { id: "plotlines",  label: "Plotlines" },
  { id: "factions",   label: "Factions" },
  { id: "secrets",    label: "Secrets" },
  { id: "anomalies",  label: "Anomalies" },
];

const COMING_SLICE = {
  plotlines: "Slice 8",
  anomalies: "Slice 10",
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

  if (tab === "scenes") {
    if (id) { mountScenePage(main, appData, id); }
    else     { mountScenes(main, appData); }
    return;
  }

  if (tab === "factions") {
    if (id) {
      mountFactionPage(main, appData, id);
    } else {
      mountFactions(main, appData);
    }
    return;
  }

  if (tab === "secrets") {
    if (id) {
      mountSecretPage(main, appData, id);
    } else {
      mountSecrets(main, appData);
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
  const savedTheme = localStorage.getItem("oxford-theme") || "dark";
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

  // Load data, run migrations if needed, then boot.
  try {
    appData = await loadAll();
    let version = appData.meta?.schemaVersion ?? 1;
    if (version < 2) { migrateCharacters(appData.characters);  version = 2; }
    if (version < 3) { migrateNamesToV3(appData.characters);   version = 3; }
    if (version < 4) { migrateToV4(appData.characters, appData.relationships); version = 4; }

    let needCharSave = false;
    let needRelSave  = false;
    let needMetaSave = false;

    if ((appData.meta?.schemaVersion ?? 1) < version) {
      appData.meta = { ...appData.meta, schemaVersion: version };
      needCharSave = true;
      needRelSave  = true;
      needMetaSave = true;
    }

    if (!appData.meta?.currentDate) {
      appData.meta = { ...appData.meta, currentDate: todayIso() };
      needMetaSave = true;
    }

    appData.meta.knownLanguages ??= [];
    appData.secrets ??= [];
    appData.scenes  ??= [];

    const writes = [];
    if (needCharSave) writes.push(save("characters", appData.characters));
    if (needRelSave)  writes.push(save("relationships", appData.relationships));
    if (needMetaSave) writes.push(save("meta", appData.meta));
    if (writes.length) await Promise.all(writes);

    // Wire date widget.
    wireDateWidget();

    initRouter();
  } catch (err) {
    showBanner(`Could not load data: ${err.message}`);
  }
}

function wireDateWidget() {
  const picker  = qs("#date-picker");
  const dowEl   = qs("#date-dow");
  const longEl  = qs("#date-long");
  const prevBtn = qs("#date-prev");
  const nextBtn = qs("#date-next");

  function setDate(iso) {
    appData.meta.currentDate = iso;
    picker.value   = iso;
    dowEl.textContent  = dayOfWeek(iso);
    longEl.textContent = formatLongDate(iso);
    save("meta", appData.meta);
    window.dispatchEvent(new CustomEvent("current-date-change", { detail: { date: iso } }));
  }

  picker.addEventListener("change", () => { if (picker.value) setDate(picker.value); });
  qs("#date-picker-btn").addEventListener("click", () => {
    if (picker.showPicker) picker.showPicker();
    else picker.click();
  });
  prevBtn.addEventListener("click", () => setDate(addDays(appData.meta.currentDate, -1)));
  nextBtn.addEventListener("click", () => setDate(addDays(appData.meta.currentDate, +1)));

  setDate(appData.meta.currentDate);
}

init();
