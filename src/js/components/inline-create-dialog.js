import { el } from "../dom.js";

// fields: [{ name, label, type: "text"|"select", required?, autofocus?, options?, default? }]
export function openInlineCreateDialog({ title, fields, onSubmit }) {
  const backdrop = el("div", { class: "dialog-backdrop" });
  document.body.append(backdrop);

  function close() {
    backdrop.remove();
    document.removeEventListener("keydown", onEsc);
  }

  function onEsc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onEsc);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });

  const inputs = {};

  const fieldEls = fields.map(f => {
    let input;
    if (f.type === "select") {
      input = el("select", { class: "dialog-select" });
      for (const opt of (f.options ?? [])) {
        const optEl = el("option", { value: opt }, [opt]);
        if (opt === (f.default ?? f.options[0])) optEl.selected = true;
        input.append(optEl);
      }
    } else {
      input = el("input", {
        type: f.type ?? "text",
        class: "dialog-input",
        placeholder: f.label ?? "",
      });
    }
    inputs[f.name] = input;
    return el("div", { class: "dialog-field" }, [
      el("span", { class: "dialog-field-label" }, [f.label]),
      input,
    ]);
  });

  const autofocusField = fields.find(f => f.autofocus);
  if (autofocusField) {
    requestAnimationFrame(() => inputs[autofocusField.name]?.focus());
  }

  async function submit() {
    for (const f of fields) {
      if (f.required && !(inputs[f.name].value ?? "").trim()) {
        inputs[f.name].focus();
        return;
      }
    }
    const values = Object.fromEntries(
      fields.map(f => [f.name, (inputs[f.name].value ?? "").trim()])
    );
    await onSubmit(values);
    close();
  }

  for (const f of fields) {
    if ((f.type ?? "text") === "text") {
      inputs[f.name].addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      });
    }
  }

  const createBtn = el("button", { class: "btn-primary", onclick: submit }, ["Create"]);

  backdrop.append(el("div", { class: "dialog icd-dialog" }, [
    el("div", { class: "dialog-double-rule" }),
    el("h2", { class: "dialog-title" }, [title]),
    el("div", { class: "dialog-double-rule" }),
    el("div", { class: "dialog-body" }, fieldEls),
    el("div", { class: "dialog-footer" }, [
      createBtn,
      el("button", { class: "btn-secondary", onclick: close }, ["Cancel"]),
    ]),
  ]));
}
