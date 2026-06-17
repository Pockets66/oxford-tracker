import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { save } from "../storage.js";
import { syncFactionMembership } from "../schema.js";

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function mountFactionPage(container, appData, id) {
  const faction = appData.factions.find(f => f.id === id);
  if (!faction) {
    container.append(el("p", { class: "placeholder-view" }, ["Faction not found."]));
    return;
  }

  let savedPill = null;

  function showSavedPill() {
    if (savedPill) savedPill.remove();
    savedPill = el("span", { class: "saved-pill" }, ["Saved"]);
    container.append(savedPill);
    setTimeout(() => { savedPill?.remove(); savedPill = null; }, 2000);
  }

  function persist() {
    faction.updatedAt = new Date().toISOString();
    save("factions", appData.factions).then(showSavedPill);
  }

  function persistBoth() {
    faction.updatedAt = new Date().toISOString();
    Promise.all([
      save("factions", appData.factions),
      save("characters", appData.characters),
    ]).then(showSavedPill);
  }

  const debouncedSave = debounce(persist, 400);

  function handleDelete() {
    if (!confirm(`Delete "${faction.name}"? This cannot be undone.`)) return;
    const idx = appData.factions.findIndex(f => f.id === id);
    if (idx !== -1) appData.factions.splice(idx, 1);
    syncFactionMembership(appData.characters, appData.factions);
    Promise.all([
      save("factions", appData.factions),
      save("characters", appData.characters),
    ]).then(() => navigate("factions"));
  }

  // ── Header ──
  const nameInput = el("input", { type: "text", class: "sheet-name-input", placeholder: "Faction name" });
  nameInput.value = faction.name;
  nameInput.addEventListener("input", () => { faction.name = nameInput.value; debouncedSave(); });

  const colorPicker = el("input", { type: "color", class: "faction-color-picker" });
  colorPicker.value = faction.color || "#5b7fa6";
  colorPicker.addEventListener("input", () => { faction.color = colorPicker.value; debouncedSave(); });

  const header = el("div", { class: "sheet-header" }, [
    el("a", { class: "sheet-back", href: "#/factions" }, ["← Factions"]),
    nameInput,
    el("div", { class: "sheet-header-controls" }, [
      el("label", { class: "faction-color-label" }, ["Color ", colorPicker]),
      el("button", { class: "btn-danger", onclick: handleDelete }, ["Delete"]),
    ]),
  ]);

  // ── Text fields ──
  const summaryTa = el("textarea", { class: "sheet-textarea" });
  summaryTa.value = faction.summary ?? "";
  summaryTa.addEventListener("input", () => { faction.summary = summaryTa.value; debouncedSave(); });

  const agendaTa = el("textarea", { class: "sheet-textarea" });
  agendaTa.value = faction.agenda ?? "";
  agendaTa.addEventListener("input", () => { faction.agenda = agendaTa.value; debouncedSave(); });

  const notesTa = el("textarea", { class: "sheet-textarea" });
  notesTa.value = faction.notes ?? "";
  notesTa.addEventListener("input", () => { faction.notes = notesTa.value; debouncedSave(); });

  // ── Leader ──
  const leaderSelect = el("select", { class: "sheet-owner-select" });
  leaderSelect.append(el("option", { value: "" }, ["— No leader —"]));
  for (const c of appData.characters) {
    const opt = el("option", { value: c.id }, [c.name || "Unnamed"]);
    if (faction.leaderId === c.id) opt.selected = true;
    leaderSelect.append(opt);
  }

  const leaderLink = el("a", { class: "faction-leader-link" });
  function updateLeaderLink() {
    if (faction.leaderId) {
      const leader = appData.characters.find(c => c.id === faction.leaderId);
      leaderLink.href = `#/characters/${faction.leaderId}`;
      leaderLink.textContent = `→ ${leader?.name ?? "Unknown"}`;
      leaderLink.style.display = "";
    } else {
      leaderLink.style.display = "none";
    }
  }
  updateLeaderLink();
  leaderSelect.addEventListener("change", () => {
    faction.leaderId = leaderSelect.value || null;
    updateLeaderLink();
    debouncedSave();
  });

  // ── Members ──
  const membersEl = el("div", { class: "faction-members" });

  function renderMembers() {
    clear(membersEl);
    const chipRow = el("div", { class: "sheet-faction-chips" });
    if (faction.memberIds.length) {
      for (const memberId of faction.memberIds) {
        const character = appData.characters.find(c => c.id === memberId);
        chipRow.append(el("span", { class: "faction-member-chip" }, [
          el("a", { class: "faction-member-name", href: `#/characters/${memberId}` },
            [character?.name ?? "Unknown"]),
          el("button", { class: "faction-chip-remove", onclick: () => removeMember(memberId) }, ["×"]),
        ]));
      }
    } else {
      chipRow.append(el("span", { class: "sheet-empty-note" }, ["No members yet."]));
    }

    const nonMembers = appData.characters.filter(c => !faction.memberIds.includes(c.id));
    const addSelect = el("select", { class: "sheet-add-faction-select" });
    addSelect.append(el("option", { value: "" }, ["Add member…"]));
    for (const c of nonMembers) {
      addSelect.append(el("option", { value: c.id }, [c.name || "Unnamed"]));
    }
    addSelect.addEventListener("change", () => {
      if (!addSelect.value) return;
      addMember(addSelect.value);
    });

    membersEl.append(chipRow);
    if (nonMembers.length) membersEl.append(addSelect);
  }

  function addMember(charId) {
    if (faction.memberIds.includes(charId)) return;
    faction.memberIds.push(charId);
    syncFactionMembership(appData.characters, appData.factions);
    persistBoth();
    renderMembers();
  }

  function removeMember(charId) {
    const idx = faction.memberIds.indexOf(charId);
    if (idx !== -1) faction.memberIds.splice(idx, 1);
    syncFactionMembership(appData.characters, appData.factions);
    persistBoth();
    renderMembers();
  }

  renderMembers();

  container.append(
    header,
    el("div", { class: "sheet-body" }, [
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Summary"]),
        summaryTa,
      ]),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Agenda"]),
        agendaTa,
      ]),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Leader"]),
        el("div", { class: "sheet-row" }, [leaderSelect, leaderLink]),
      ]),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Members"]),
        membersEl,
      ]),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Notes"]),
        notesTa,
      ]),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Scenes"]),
        el("p", { class: "sheet-empty-note" }, ["Populated in Slice 6."]),
      ]),
      el("section", { class: "sheet-section" }, [
        el("h3", { class: "sheet-section-title" }, ["Plotlines"]),
        el("p", { class: "sheet-empty-note" }, ["Populated in Slice 7."]),
      ]),
    ])
  );
}
