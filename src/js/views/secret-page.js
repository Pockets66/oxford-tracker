import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { computeStatus, STATUS_TIERS, statusSlug, displayName } from "../schema.js";

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Constraint-safe mutation helpers ────────────────────────────────────────

function addOwnerChar(s, id) {
  if (!s.ownerCharacterIds.includes(id)) s.ownerCharacterIds.push(id);
  if (!s.knownToIds.includes(id)) s.knownToIds.push(id);
  s.hiddenFromIds = s.hiddenFromIds.filter(i => i !== id);
}

function removeOwnerChar(s, id) {
  s.ownerCharacterIds = s.ownerCharacterIds.filter(i => i !== id);
}

function addOwnerFaction(s, id) {
  if (!s.ownerFactionIds.includes(id)) s.ownerFactionIds.push(id);
  if (!s.knownToFactionIds.includes(id)) s.knownToFactionIds.push(id);
}

function removeOwnerFaction(s, id) {
  s.ownerFactionIds = s.ownerFactionIds.filter(i => i !== id);
}

function addKnownToChar(s, id) {
  if (!s.knownToIds.includes(id)) s.knownToIds.push(id);
  s.hiddenFromIds = s.hiddenFromIds.filter(i => i !== id);
}

function removeKnownToChar(s, id) {
  s.knownToIds = s.knownToIds.filter(i => i !== id);
  s.ownerCharacterIds = s.ownerCharacterIds.filter(i => i !== id);
}

function addKnownToFaction(s, id) {
  if (!s.knownToFactionIds.includes(id)) s.knownToFactionIds.push(id);
}

function removeKnownToFaction(s, id) {
  s.knownToFactionIds = s.knownToFactionIds.filter(i => i !== id);
  s.ownerFactionIds = s.ownerFactionIds.filter(i => i !== id);
}

function addHiddenFromChar(s, id) {
  if (!s.hiddenFromIds.includes(id)) s.hiddenFromIds.push(id);
  s.knownToIds = s.knownToIds.filter(i => i !== id);
  s.ownerCharacterIds = s.ownerCharacterIds.filter(i => i !== id);
}

function removeHiddenFromChar(s, id) {
  s.hiddenFromIds = s.hiddenFromIds.filter(i => i !== id);
}

function addCharTag(s, id) {
  if (!s.characterTagIds.includes(id)) s.characterTagIds.push(id);
}

function removeCharTag(s, id) {
  s.characterTagIds = s.characterTagIds.filter(i => i !== id);
}

// ── Generic char picker (chips + select) ────────────────────────────────────

function makeCharPicker(secret, appData, getIds, addFn, removeFn, excludeFn, onSave) {
  const chipsEl = el("div", { class: "secret-picker-chips" });
  const wrapEl  = el("div", { class: "secret-section" });

  function render() {
    clear(chipsEl);
    for (const cId of getIds()) {
      const c = appData.characters.find(ch => ch.id === cId);
      chipsEl.append(el("span", { class: "secret-picker-chip" }, [
        c ? displayName(c) : cId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          removeFn(secret, cId);
          render();
          onSave();
        }}, ["×"]),
      ]));
    }
  }

  const sel = el("select", { class: "secret-picker-select" });

  function rebuildSelect() {
    clear(sel);
    sel.append(el("option", { value: "" }, ["Add character…"]));
    for (const c of [...appData.characters].sort((a, b) => displayName(a).localeCompare(displayName(b)))) {
      if (!getIds().includes(c.id) && !excludeFn(c.id)) {
        sel.append(el("option", { value: c.id }, [displayName(c)]));
      }
    }
  }
  rebuildSelect();
  sel.addEventListener("change", () => {
    const val = sel.value;
    if (!val) return;
    addFn(secret, val);
    render();
    rebuildSelect();
    sel.value = "";
    onSave();
  });

  render();
  wrapEl.append(chipsEl, el("div", { class: "secret-picker-add" }, [sel]));
  return { el: wrapEl, render, rebuildSelect };
}

// ── Generic faction picker ───────────────────────────────────────────────────

function makeFactionPicker(secret, appData, getIds, addFn, removeFn, onSave) {
  const chipsEl = el("div", { class: "secret-picker-chips" });
  const wrapEl  = el("div", { class: "secret-section" });

  function render() {
    clear(chipsEl);
    for (const fId of getIds()) {
      const f = appData.factions.find(f2 => f2.id === fId);
      chipsEl.append(el("span", { class: "secret-picker-chip" }, [
        f?.name ?? fId,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          removeFn(secret, fId);
          render();
          onSave();
        }}, ["×"]),
      ]));
    }
  }

  const sel = el("select", { class: "secret-picker-select" });
  sel.append(el("option", { value: "" }, ["Add faction…"]));
  for (const f of appData.factions) {
    sel.append(el("option", { value: f.id }, [f.name]));
  }
  sel.addEventListener("change", () => {
    const val = sel.value;
    if (!val || getIds().includes(val)) { sel.value = ""; return; }
    addFn(secret, val);
    render();
    sel.value = "";
    onSave();
  });

  render();
  wrapEl.append(chipsEl, el("div", { class: "secret-picker-add" }, [sel]));
  return { el: wrapEl, render };
}

export function mountSecretPage(container, appData, id) {
  const secret = (appData.secrets ?? []).find(s => s.id === id);
  if (!secret) {
    container.append(el("p", { class: "sheet-empty-note" }, ["Secret not found."]));
    return;
  }

  const allRenders = [];
  function renderAll() { for (const fn of allRenders) fn(); }

  const persist = debounce(async () => {
    secret.updatedAt = new Date().toISOString();
    await save("secrets", appData.secrets);
  }, 400);

  // ── Back button ──
  const backBtn = el("button", { class: "btn-link secret-page-back" }, ["← All secrets"]);
  backBtn.addEventListener("click", () => navigate("secrets"));

  // ── Title ──
  const titleInput = el("input", {
    type: "text", class: "secret-page-title", placeholder: "Secret title…",
  });
  titleInput.value = secret.title ?? "";
  titleInput.addEventListener("input", () => { secret.title = titleInput.value; persist(); });

  // ── Archived toggle + Delete ──
  const archiveBtn = el("button", { class: "btn-small" }, [secret.archived ? "Unarchive" : "Archive"]);
  archiveBtn.addEventListener("click", async () => {
    secret.archived = !secret.archived;
    archiveBtn.textContent = secret.archived ? "Unarchive" : "Archive";
    archivedNote.style.display = secret.archived ? "" : "none";
    await save("secrets", appData.secrets);
  });

  const deleteBtn = el("button", { class: "btn-small btn-small--danger" }, ["Delete"]);
  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${secret.title || "(untitled)"}"? This cannot be undone.`)) return;
    appData.secrets = appData.secrets.filter(s => s.id !== id);
    await save("secrets", appData.secrets);
    navigate("secrets");
  });

  const archivedNote = el("div", { class: "secret-archived-note" }, ["This secret is archived."]);
  archivedNote.style.display = secret.archived ? "" : "none";

  // ── Summary ──
  const summaryTa = el("textarea", { class: "sheet-textarea", rows: "3", placeholder: "Short summary…" });
  summaryTa.value = secret.summary ?? "";
  summaryTa.addEventListener("input", () => { secret.summary = summaryTa.value; persist(); });

  // ── Body ──
  const bodyTa = el("textarea", { class: "sheet-textarea sheet-textarea--bg", placeholder: "Full text of the secret…" });
  bodyTa.value = secret.body ?? "";
  bodyTa.addEventListener("input", () => { secret.body = bodyTa.value; persist(); });

  function onMutation() { renderAll(); persist(); }

  // ── Owner character picker ──
  const ownerCharPicker = makeCharPicker(
    secret, appData,
    () => secret.ownerCharacterIds,
    addOwnerChar,
    removeOwnerChar,
    () => false,
    onMutation
  );

  // ── Owner faction picker ──
  const ownerFacPicker = makeFactionPicker(
    secret, appData,
    () => secret.ownerFactionIds,
    addOwnerFaction,
    removeOwnerFaction,
    onMutation
  );

  // ── Known-to character picker ──
  function refreshStatus() {
    const s = computeStatus(secret);
    statusChip.textContent = s;
    statusChip.className = `status-chip status-chip--${statusSlug(s)}`;
  }

  const knownToCharPicker = makeCharPicker(
    secret, appData,
    () => secret.knownToIds,
    addKnownToChar,
    removeKnownToChar,
    id => secret.hiddenFromIds.includes(id),
    () => { renderAll(); refreshStatus(); persist(); }
  );

  // ── Known-to faction picker ──
  const knownToFacPicker = makeFactionPicker(
    secret, appData,
    () => secret.knownToFactionIds,
    addKnownToFaction,
    removeKnownToFaction,
    onMutation
  );

  // ── Hidden-from character picker ──
  const hiddenFromPicker = makeCharPicker(
    secret, appData,
    () => secret.hiddenFromIds,
    addHiddenFromChar,
    removeHiddenFromChar,
    id => secret.knownToIds.includes(id),
    onMutation
  );

  // ── Character tags picker ──
  const charTagPicker = makeCharPicker(
    secret, appData,
    () => secret.characterTagIds,
    addCharTag,
    removeCharTag,
    () => false,
    onMutation
  );

  // Register all char picker render functions for cross-talk.
  allRenders.push(
    ownerCharPicker.render,
    ownerCharPicker.rebuildSelect,
    knownToCharPicker.render,
    knownToCharPicker.rebuildSelect,
    hiddenFromPicker.render,
    hiddenFromPicker.rebuildSelect,
    charTagPicker.render,
    charTagPicker.rebuildSelect,
  );

  // ── Status ──
  const computedStatus = computeStatus(secret);
  const statusChip = el("span", { class: `status-chip status-chip--${statusSlug(computedStatus)}` }, [computedStatus]);

  const overrideSel = el("select", { class: "sheet-input" });
  overrideSel.append(el("option", { value: "" }, ["(auto-computed)"]));
  for (const tier of STATUS_TIERS) {
    const opt = el("option", { value: tier.name }, [tier.name]);
    if (secret.statusOverride === tier.name) opt.selected = true;
    overrideSel.append(opt);
  }
  overrideSel.addEventListener("change", () => {
    secret.statusOverride = overrideSel.value || null;
    const s = computeStatus(secret);
    statusChip.textContent = s;
    statusChip.className = `status-chip status-chip--${statusSlug(s)}`;
    persist();
  });

  // ── Tags ──
  const tagsChipsEl = el("div", { class: "secret-tags-chips" });

  function renderTagChips() {
    clear(tagsChipsEl);
    for (const tag of secret.tags ?? []) {
      tagsChipsEl.append(el("span", { class: "secret-tag-chip" }, [
        tag,
        el("button", { class: "filter-faction-chip-remove", onclick: () => {
          secret.tags = secret.tags.filter(t => t !== tag);
          renderTagChips();
          persist();
        }}, ["×"]),
      ]));
    }
  }
  renderTagChips();

  const tagInput = el("input", { type: "text", class: "sheet-input", placeholder: "Add tag…", style: "width:140px" });
  const tagAddBtn = el("button", { class: "btn-small" }, ["Add"]);
  function addTag() {
    const val = tagInput.value.trim();
    if (!val || (secret.tags ?? []).includes(val)) { tagInput.value = ""; return; }
    secret.tags = [...(secret.tags ?? []), val];
    tagInput.value = "";
    renderTagChips();
    persist();
  }
  tagAddBtn.addEventListener("click", addTag);
  tagInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } });

  // ── Notes ──
  const notesTa = el("textarea", { class: "sheet-textarea", placeholder: "Notes…" });
  notesTa.value = secret.notes ?? "";
  notesTa.addEventListener("input", () => { secret.notes = notesTa.value; persist(); });

  function section(title, ...children) {
    return el("div", { class: "secret-section" }, [
      el("div", { class: "secret-section-title" }, [title]),
      ...children,
    ]);
  }

  container.append(
    backBtn,
    el("div", { class: "secret-page-header" }, [
      titleInput,
      el("div", { class: "secret-page-controls" }, [archiveBtn, deleteBtn]),
    ]),
    archivedNote,
    el("div", { class: "secret-page-body" }, [
      section("Summary", summaryTa),
      section("Full text", bodyTa),
      section("Owner characters", ownerCharPicker.el),
      section("Owner factions", ownerFacPicker.el),
      section("Known to — characters", knownToCharPicker.el),
      section("Known to — factions", knownToFacPicker.el),
      section("Hidden from", hiddenFromPicker.el),
      section("Character mentions", charTagPicker.el),
      section("Status",
        el("div", { class: "secret-status-row" }, [
          statusChip,
          el("label", { class: "filter-popover-label" }, ["Override:"]),
          overrideSel,
        ])
      ),
      section("Tags",
        tagsChipsEl,
        el("div", { class: "secret-tag-input-row" }, [tagInput, tagAddBtn])
      ),
      section("Notes", notesTa),
    ])
  );
}
