import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import { displayName } from "../schema.js";

const REL_TYPES = {
  Family:   ["Parent", "Child", "Sibling", "Spouse", "Ex-spouse", "Other family"],
  Romantic: ["Lover", "Ex-lover", "Crush", "Fiancé(e)"],
  Social:   ["Friend", "Best friend", "Roommate", "Classmate", "Colleague", "Mentor", "Student"],
  Negative: ["Rival", "Enemy", "Nemesis"],
  Other:    ["Acquaintance", "Stranger", "Other"],
};

const CLOSENESS = ["Estranged", "Distant", "Acquaintance", "Familiar", "Close", "Inseparable"];

const RECIP = {
  "Parent": "Child",        "Child": "Parent",
  "Sibling": "Sibling",     "Spouse": "Spouse",       "Ex-spouse": "Ex-spouse",
  "Lover": "Lover",         "Ex-lover": "Ex-lover",
  "Friend": "Friend",       "Best friend": "Best friend",
  "Rival": "Rival",         "Enemy": "Enemy",
  "Mentor": "Student",      "Student": "Mentor",
  "Acquaintance": "Acquaintance",
};

function makeTypeSelect(selected) {
  const sel = el("select", { class: "dialog-select" });
  sel.append(el("option", { value: "" }, ["— Type —"]));
  for (const [group, types] of Object.entries(REL_TYPES)) {
    const grp = el("optgroup", { label: group });
    for (const t of types) {
      const opt = el("option", { value: t }, [t]);
      if (t === selected) opt.selected = true;
      grp.append(opt);
    }
    sel.append(grp);
  }
  return sel;
}

function makeClosenessSelect(selected) {
  const sel = el("select", { class: "dialog-select" });
  for (const c of CLOSENESS) {
    const opt = el("option", { value: c }, [c]);
    if (c === selected) opt.selected = true;
    sel.append(opt);
  }
  return sel;
}

function fieldRow(labelText, control) {
  return el("div", { class: "dialog-field" }, [
    el("span", { class: "dialog-field-label" }, [labelText]),
    control,
  ]);
}

export function openRelationshipDialog(appData, fromId, existingId, onDone) {
  const backdrop = el("div", { class: "dialog-backdrop" });
  document.body.append(backdrop);

  function onEsc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onEsc);

  function close() {
    document.removeEventListener("keydown", onEsc);
    backdrop.remove();
    onDone?.();
  }

  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });

  function buildBox(titleText, bodyChildren, footerChildren) {
    clear(backdrop);
    backdrop.append(el("div", { class: "dialog" }, [
      el("div", { class: "dialog-double-rule" }),
      el("h2", { class: "dialog-title" }, [titleText]),
      el("div", { class: "dialog-double-rule" }),
      el("div", { class: "dialog-body" }, bodyChildren.filter(Boolean)),
      el("div", { class: "dialog-footer" }, footerChildren),
    ]));
  }

  if (existingId) {
    showEdit();
  } else {
    showCreate();
  }

  function showCreate() {
    const fromChar = appData.characters.find(c => c.id === fromId);
    const charSel  = el("select", { class: "dialog-select" });
    charSel.append(el("option", { value: "" }, ["— Select character —"]));
    for (const c of appData.characters) {
      if (c.id === fromId) continue;
      const dn    = displayName(c);
      const aka   = c.aliases?.[0] ? ` (${c.aliases[0]})` : "";
      charSel.append(el("option", { value: c.id }, [dn + aka]));
    }
    const typeSel  = makeTypeSelect(null);
    const closeSel = makeClosenessSelect("Familiar");
    const notesTa  = el("textarea", { class: "dialog-notes" });
    const errEl    = el("p", { class: "dialog-error" });

    buildBox(
      `Relationship — ${fromChar ? displayName(fromChar) : "?"}`,
      [
        fieldRow("Character", charSel),
        fieldRow("Type", typeSel),
        fieldRow("Closeness", closeSel),
        fieldRow("Notes (optional)", notesTa),
        errEl,
      ],
      [
        el("button", { class: "btn-primary", onclick: () => {
          if (!charSel.value) { errEl.textContent = "Select a character."; return; }
          if (!typeSel.value) { errEl.textContent = "Select a type."; return; }
          const now = new Date().toISOString();
          appData.relationships.push({
            id: crypto.randomUUID(),
            from: fromId, to: charSel.value,
            type: typeSel.value, closeness: closeSel.value,
            notes: notesTa.value.trim(),
            createdAt: now, updatedAt: now,
          });
          save("relationships", appData.relationships);
          showReciprocal(charSel.value, typeSel.value, closeSel.value);
        }}, ["Save & set reciprocal"]),
        el("button", { class: "btn-secondary", onclick: close }, ["Cancel"]),
      ]
    );
  }

  function showReciprocal(toId, type, closeness) {
    const fromChar = appData.characters.find(c => c.id === fromId);
    const toChar   = appData.characters.find(c => c.id === toId);
    const typeSel  = makeTypeSelect(RECIP[type] ?? "");
    const closeSel = makeClosenessSelect(closeness);
    const notesTa  = el("textarea", { class: "dialog-notes" });

    buildBox(
      `Reciprocal — ${toChar ? displayName(toChar) : "?"} → ${fromChar ? displayName(fromChar) : "?"}`,
      [
        fieldRow("Type", typeSel),
        fieldRow("Closeness", closeSel),
        fieldRow("Notes (optional)", notesTa),
      ],
      [
        el("button", { class: "btn-primary", onclick: () => {
          if (typeSel.value) {
            const now = new Date().toISOString();
            appData.relationships.push({
              id: crypto.randomUUID(),
              from: toId, to: fromId,
              type: typeSel.value, closeness: closeSel.value,
              notes: notesTa.value.trim(),
              createdAt: now, updatedAt: now,
            });
            save("relationships", appData.relationships);
          }
          close();
        }}, ["Save"]),
        el("button", { class: "btn-secondary", onclick: close }, ["Skip"]),
      ]
    );
  }

  function showEdit() {
    const rel      = appData.relationships.find(r => r.id === existingId);
    if (!rel) { close(); return; }
    const fromChar = appData.characters.find(c => c.id === fromId);
    const toChar   = appData.characters.find(c => c.id === rel.to);
    const typeSel  = makeTypeSelect(rel.type);
    const closeSel = makeClosenessSelect(rel.closeness);
    const notesTa  = el("textarea", { class: "dialog-notes" });
    notesTa.value  = rel.notes ?? "";

    buildBox(
      `${fromChar ? displayName(fromChar) : "?"} → ${toChar ? displayName(toChar) : "?"}`,
      [
        fieldRow("Type", typeSel),
        fieldRow("Closeness", closeSel),
        fieldRow("Notes", notesTa),
      ],
      [
        el("button", { class: "btn-primary", onclick: () => {
          rel.type      = typeSel.value;
          rel.closeness = closeSel.value;
          rel.notes     = notesTa.value.trim();
          rel.updatedAt = new Date().toISOString();
          save("relationships", appData.relationships);
          close();
        }}, ["Save"]),
        el("button", { class: "btn-danger", onclick: () => showDeleteConfirm(rel) }, ["Delete"]),
        el("button", { class: "btn-secondary", onclick: close }, ["Cancel"]),
      ]
    );
  }

  function showDeleteConfirm(rel) {
    const toChar = appData.characters.find(c => c.id === rel.to);
    const recip  = appData.relationships.find(r => r.from === rel.to && r.to === rel.from);
    const check  = el("input", { type: "checkbox" });
    check.checked = true;

    buildBox(
      "Delete relationship",
      [
        el("p", { class: "dialog-confirm-text" }, ["This cannot be undone."]),
        recip ? el("label", { class: "dialog-label-inline" }, [
          check, ` Also remove the reciprocal from ${toChar ? displayName(toChar) : "Unknown"}?`,
        ]) : null,
      ],
      [
        el("button", { class: "btn-danger", onclick: () => {
          appData.relationships = appData.relationships.filter(r => {
            if (r.id === rel.id) return false;
            if (recip && check.checked && r.id === recip.id) return false;
            return true;
          });
          save("relationships", appData.relationships);
          close();
        }}, ["Delete"]),
        el("button", { class: "btn-secondary", onclick: () => showEdit() }, ["Back"]),
      ]
    );
  }
}
