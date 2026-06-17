import { el, clear } from "../dom.js";
import { save } from "../storage.js";
import {
  displayName,
  STRUCTURAL_TYPES, STRUCTURAL_PAIRS,
  SOCIAL_LABELS, PLATONIC_FEELINGS, ROMANTIC_FEELINGS,
} from "../schema.js";
import { createCombobox } from "../components/combobox.js";

function fieldRow(labelText, control) {
  return el("div", { class: "dialog-field" }, [
    el("span", { class: "dialog-field-label" }, [labelText]),
    control,
  ]);
}

function makeStructuralSelect(selected) {
  const sel = el("select", { class: "dialog-select" });
  sel.append(el("option", { value: "" }, ["— None —"]));
  for (const t of STRUCTURAL_TYPES) {
    const opt = el("option", { value: t }, [t]);
    if (t === selected) opt.selected = true;
    sel.append(opt);
  }
  return sel;
}

function makeFeelingSelect(options, selected) {
  const sel = el("select", { class: "dialog-select" });
  sel.append(el("option", { value: "" }, ["—"]));
  for (const f of options) {
    const opt = el("option", { value: f }, [f]);
    if (f === selected) opt.selected = true;
    sel.append(opt);
  }
  return sel;
}

function makeSocialLabels(selected = []) {
  const wrap = el("div", { class: "dialog-social-labels" });
  for (const label of SOCIAL_LABELS) {
    const check = el("input", { type: "checkbox", class: "dialog-social-check", value: label });
    check.checked = selected.includes(label);
    wrap.append(el("label", { class: "dialog-social-label" }, [check, label]));
  }
  return wrap;
}

function getCheckedSocial(container) {
  return [...container.querySelectorAll(".dialog-social-check")]
    .filter(c => c.checked)
    .map(c => c.value);
}

function findRecip(relationships, rel) {
  return relationships.find(r => r.from === rel.to && r.to === rel.from);
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

    const sortedChars = appData.characters
      .filter(c => c.id !== fromId)
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));

    let toId = "";
    const charCb = createCombobox({
      items: sortedChars.map(c => {
        const dn  = displayName(c);
        const aka = c.aliases?.[0] && c.aliases[0] !== dn ? ` (${c.aliases[0]})` : "";
        return { value: c.id, label: dn + aka };
      }),
      value: "",
      placeholder: "Search characters…",
      onChange: (val) => { toId = val; errEl.textContent = ""; },
    });

    const structSel   = makeStructuralSelect(null);
    const socialEl    = makeSocialLabels([]);
    const platonicSel = makeFeelingSelect(PLATONIC_FEELINGS, null);
    const romanticSel = makeFeelingSelect(ROMANTIC_FEELINGS, null);
    const notesTa     = el("textarea", { class: "dialog-notes" });
    const errEl       = el("p", { class: "dialog-error" });

    buildBox(
      `Relationship — ${fromChar ? displayName(fromChar) : "?"}`,
      [
        fieldRow("Character", charCb),
        fieldRow("Structural type", structSel),
        fieldRow("Social labels", socialEl),
        fieldRow("Platonic feeling", platonicSel),
        fieldRow("Romantic feeling", romanticSel),
        fieldRow("Notes (optional)", notesTa),
        errEl,
      ],
      [
        el("button", { class: "btn-primary", onclick: () => {
          if (!toId) { errEl.textContent = "Select a character."; return; }
          const now = new Date().toISOString();
          const structType = structSel.value || null;

          const edge = {
            id: crypto.randomUUID(),
            from: fromId, to: toId,
            structuralType: structType,
            socialLabels:   getCheckedSocial(socialEl),
            platonic:       platonicSel.value || null,
            romantic:       romanticSel.value || null,
            notes:          notesTa.value.trim(),
            createdAt: now, updatedAt: now,
          };
          appData.relationships.push(edge);

          // Auto-create reciprocal if structural type is set.
          if (structType && STRUCTURAL_PAIRS[structType]) {
            appData.relationships.push({
              id: crypto.randomUUID(),
              from: toId, to: fromId,
              structuralType: STRUCTURAL_PAIRS[structType],
              socialLabels:   [],
              platonic:       null,
              romantic:       null,
              notes:          "",
              createdAt: now, updatedAt: now,
            });
          }

          save("relationships", appData.relationships);
          close();
        }}, ["Save"]),
        el("button", { class: "btn-secondary", onclick: close }, ["Cancel"]),
      ]
    );
  }

  function showEdit() {
    const rel      = appData.relationships.find(r => r.id === existingId);
    if (!rel) { close(); return; }
    const fromChar = appData.characters.find(c => c.id === fromId);
    const toChar   = appData.characters.find(c => c.id === rel.to);

    const oldStructuralType = rel.structuralType;

    const structSel   = makeStructuralSelect(rel.structuralType);
    const socialEl    = makeSocialLabels(rel.socialLabels ?? []);
    const platonicSel = makeFeelingSelect(PLATONIC_FEELINGS, rel.platonic);
    const romanticSel = makeFeelingSelect(ROMANTIC_FEELINGS, rel.romantic);
    const notesTa     = el("textarea", { class: "dialog-notes" });
    notesTa.value     = rel.notes ?? "";

    buildBox(
      `${fromChar ? displayName(fromChar) : "?"} → ${toChar ? displayName(toChar) : "?"}`,
      [
        fieldRow("Structural type", structSel),
        fieldRow("Social labels", socialEl),
        fieldRow("Platonic feeling", platonicSel),
        fieldRow("Romantic feeling", romanticSel),
        fieldRow("Notes", notesTa),
      ],
      [
        el("button", { class: "btn-primary", onclick: () => {
          const now = new Date().toISOString();
          const newStructType = structSel.value || null;

          rel.structuralType = newStructType;
          rel.socialLabels   = getCheckedSocial(socialEl);
          rel.platonic       = platonicSel.value || null;
          rel.romantic       = romanticSel.value || null;
          rel.notes          = notesTa.value.trim();
          rel.updatedAt      = now;

          // If structural type changed, update the reciprocal's structural type.
          if (newStructType !== oldStructuralType) {
            const recip = findRecip(appData.relationships, rel);
            if (recip) {
              recip.structuralType = newStructType ? (STRUCTURAL_PAIRS[newStructType] ?? null) : null;
              recip.updatedAt = now;
            }
          }

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
    const recip  = findRecip(appData.relationships, rel);
    const check  = el("input", { type: "checkbox" });
    check.checked = !!recip;

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
